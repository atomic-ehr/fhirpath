import type { 
  ASTNode, 
  BinaryNode, 
  IdentifierNode, 
  LiteralNode, 
  TemporalLiteralNode,
  FunctionNode, 
  Diagnostic, 
  AnalysisResult, 
  UnaryNode, 
  IndexNode, 
  CollectionNode, 
  MembershipTestNode, 
  TypeCastNode, 
  TypeInfo, 
  ModelProvider,
  VariableNode,
  TypeName,
  ErrorNode,
  InternalAnalysisResult,
  QuantityNode
} from './types';
import { NodeType, DiagnosticSeverity, AnalysisContext } from './types';
import type { OperatorSignature, FunctionSignature } from './types';
import type { FunctionDefinition } from './types';
import { registry } from './registry';
import { matchOperatorSignature, matchFunctionSignature, resolveResultType } from './analyzer/type-compat';
import { checkParamTypes, formatType, isEmptyCollection, isUnionType, getUnionChoices, validateUnionChoice } from './analyzer/utils';
import { Errors, toDiagnostic, ErrorCodes } from './errors';
import { isCursorNode, CursorContext } from './parser/cursor-nodes';
import type { AnyCursorNode } from './parser/cursor-nodes';
import { Parser, type ParserOptions } from './parser';

export interface AnalyzerOptions {
  cursorMode?: boolean;
}

export interface AnalysisResultWithCursor extends AnalysisResult {
  stoppedAtCursor?: boolean;
  cursorContext?: {
    typeBeforeCursor?: TypeInfo;
    expectedType?: TypeInfo;
    cursorNode?: AnyCursorNode;
    functionCall?: {
      definition: import('./types').FunctionDefinition;
      argumentIndex: number;
    };
  };
}

export class Analyzer {
  private modelProvider?: ModelProvider;
  private cursorMode: boolean = false;
  private stoppedAtCursor: boolean = false;
  private cursorContext?: {
    typeBeforeCursor?: TypeInfo;
    expectedType?: TypeInfo;
    cursorNode?: AnyCursorNode;
    functionCall?: {
      definition: import('./types').FunctionDefinition;
      argumentIndex: number;
    };
  };

  constructor(modelProvider?: ModelProvider) {
    this.modelProvider = modelProvider;
  }

  /**
   * Parse and analyze a FHIRPath expression end-to-end, returning an AnalysisResult
   * and structured diagnostics. Supports optional error recovery (LSP mode).
   */
  static async analyzeExpression(
    expression: string,
    options: {
      variables?: Record<string, unknown>;
      modelProvider?: ModelProvider;
      inputType?: TypeInfo;
      errorRecovery?: boolean;
      parserOptions?: ParserOptions;
    } = {}
  ): Promise<AnalysisResultWithCursor> {
    const parserOptions: ParserOptions | undefined = options.errorRecovery
      ? { mode: 'lsp', errorRecovery: true, ...(options.parserOptions || {}) }
      : options.parserOptions;

    const parser = new Parser(expression, parserOptions);
    const parseResult = parser.parse();

    // If error recovery is not enabled and there are parse errors, surface the first one.
    if (!options.errorRecovery && parseResult.errors.length > 0) {
      // Preserve backward compatibility; analyzer doesn't throw custom mapping here.
      throw Errors.invalidSyntax(parseResult.errors[0]!.message);
    }

    const analyzer = new Analyzer(options.modelProvider);
    const result = await analyzer.analyze(
      parseResult.ast,
      options.variables,
      options.inputType,
      { cursorMode: !!parserOptions?.mode && parserOptions.mode === 'lsp' }
    );

    return result;
  }

  /**
   * Main entry point for context-flow analysis.
   * Analyzes a node with the given context.
   */
  private async analyzeNode(node: ASTNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    // Handle cursor nodes for completion
    if (isCursorNode(node)) {
      return this.analyzeCursorNode(node as AnyCursorNode, context);
    }

    let result: InternalAnalysisResult;
    
    switch (node.type) {
      case NodeType.Binary:
        result = await this.analyzeBinary(node as BinaryNode, context);
        break;
      case NodeType.Unary:
        result = await this.analyzeUnary(node as UnaryNode, context);
        break;
      case NodeType.Function:
        result = await this.analyzeFunction(node as FunctionNode, context);
        break;
      case NodeType.Variable:
        result = this.analyzeVariable(node as VariableNode, context);
        break;
      case NodeType.Identifier:
        result = await this.analyzeIdentifier(node as IdentifierNode, context);
        break;
      case NodeType.Literal:
        result = this.analyzeLiteral(node as LiteralNode, context);
        break;
      case NodeType.TemporalLiteral:
        result = this.analyzeTemporalLiteral(node as TemporalLiteralNode, context);
        break;
      case NodeType.Index:
        result = await this.analyzeIndex(node as IndexNode, context);
        break;
      case NodeType.Collection:
        result = await this.analyzeCollection(node as CollectionNode, context);
        break;
      case NodeType.MembershipTest:
        result = await this.analyzeMembershipTest(node as MembershipTestNode, context);
        break;
      case NodeType.TypeCast:
        result = await this.analyzeTypeCast(node as TypeCastNode, context);
        break;
      case NodeType.Quantity:
        result = this.analyzeQuantity(node as QuantityNode, context);
        break;
      case 'Error':
        result = this.analyzeError(node as ErrorNode, context);
        break;
      default:
        result = {
          type: { type: 'Any', singleton: false },
          diagnostics: [toDiagnostic(Errors.unknownNodeType(String((node as any)?.type), (node as any)?.range))]
        };
    }
    
    // Annotate the node with type information
    node.typeInfo = result.type;
    
    return result;
  }

  /**
   * Analyzes binary operators with special handling for union and dot.
   */
  private async analyzeBinary(node: BinaryNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const diagnostics: Diagnostic[] = [];

    // Special handling for union operator - fork context for each branch
    if (node.operator === '|') {
      const leftResult = await this.analyzeNode(node.left, context.fork());
      if (this.stoppedAtCursor) {
        return { type: { type: 'Any', singleton: false }, diagnostics: leftResult.diagnostics };
      }
      
      const rightResult = await this.analyzeNode(node.right, context.fork());
      
      diagnostics.push(...leftResult.diagnostics, ...rightResult.diagnostics);
      
      // Preserve left operand type per operator signature (leftType)
      const type = { ...leftResult.type, singleton: false };
      
      return {
        type,
        diagnostics,
        context // Return original context unchanged - no variable leakage
      };
    }

    // Special handling for dot operator - flow context through
    if (node.operator === '.') {
      // Check if this is actually a namespaced type in an 'is' expression
      // Parser incorrectly creates: (true is System).Boolean instead of: true is System.Boolean
      if (node.left.type === NodeType.MembershipTest && node.right.type === NodeType.Identifier) {
        const membershipTest = node.left as MembershipTestNode;
        const rightIdent = node.right as IdentifierNode;
        // Reconstruct the correct MembershipTest with full type name
        const correctedNode: MembershipTestNode = {
          ...membershipTest,
          targetType: `${membershipTest.targetType}.${rightIdent.name}`
        };
        return await this.analyzeMembershipTest(correctedNode, context);
      }
      
      const leftResult = await this.analyzeNode(node.left, context);
      if (this.stoppedAtCursor) {
        return { type: { type: 'Any', singleton: false }, diagnostics: leftResult.diagnostics };
      }
      
      // Right side gets left's output as input, with any context changes
      const rightContext = (leftResult.context || context).withInputType(leftResult.type);
      const rightResult = await this.analyzeNode(node.right, rightContext);
      
      diagnostics.push(...leftResult.diagnostics, ...rightResult.diagnostics);
      
      return {
        type: rightResult.type,
        diagnostics,
        context: rightResult.context // Propagate context changes (for defineVariable)
      };
    }

    // Handle other binary operators
    const leftResult = await this.analyzeNode(node.left, context);
    if (this.stoppedAtCursor) {
      return { type: { type: 'Any', singleton: false }, diagnostics: leftResult.diagnostics };
    }
    
    // Check if right side is a cursor node - if so, set proper context
    if (this.cursorMode && isCursorNode(node.right)) {
      this.stoppedAtCursor = true;
      this.cursorContext = {
        cursorNode: node.right as AnyCursorNode,
        typeBeforeCursor: leftResult.type,
        expectedType: undefined
      };
      return {
        type: { type: 'Any', singleton: false },
        diagnostics: leftResult.diagnostics
      };
    }
    
    // For most operators, right side evaluates with original context (not left's output)
    const rightResult = await this.analyzeNode(node.right, context);
    
    diagnostics.push(...leftResult.diagnostics, ...rightResult.diagnostics);

    // Get operator definition for type checking
    const operatorDef = registry.getOperatorDefinition(node.operator);
    if (!operatorDef) {
      diagnostics.push(toDiagnostic(Errors.unknownOperator(node.operator, node.range)));
      return {
        type: { type: 'Any', singleton: false },
        diagnostics
      };
    }

    // Check operator signatures for type compatibility
    if (operatorDef.signatures && operatorDef.signatures.length > 0) {
      const matchingSignature = matchOperatorSignature(leftResult.type, rightResult.type, operatorDef) || null;
      if (!matchingSignature) {
        // No matching signature found - report type error
        // But don't report if either side is Any (could be from an error)
        if (leftResult.type.type !== 'Any' && rightResult.type.type !== 'Any') {
          const leftTypeStr = leftResult.type.singleton ? leftResult.type.type : `${leftResult.type.type}[]`;
          const rightTypeStr = rightResult.type.singleton ? rightResult.type.type : `${rightResult.type.type}[]`;
          diagnostics.push(this.createError(
            node,
            `Operator '${node.operator}' cannot be applied to types ${leftTypeStr} and ${rightTypeStr}`,
            ErrorCodes.OPERATOR_TYPE_MISMATCH
          ));
        }
        return {
          type: { type: 'Any', singleton: false },
          diagnostics
        };
      }
      
      // Determine result type from matching signature
      const resultType = resolveResultType(matchingSignature.result as any, {
        input: context.inputType,
        left: leftResult.type,
        right: rightResult.type,
      });
      
      return {
        type: resultType,
        diagnostics
      };
    }

    // If no signatures defined, return Any type
    return {
      type: { type: 'Any', singleton: false },
      diagnostics
    };
  }

  /**
   * Analyzes function calls, delegating to function's analyze method if available.
  */
  private async analyzeFunction(node: FunctionNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const diagnostics: Diagnostic[] = [];

    const functionName = this.getFunctionName(node);
    if (!functionName) {
      diagnostics.push(this.createError(node.name, 'Invalid function name', ErrorCodes.INVALID_SYNTAX));
      return { type: { type: 'Any', singleton: false }, diagnostics };
    }

    const funcDef = registry.getFunction(functionName);
    if (!funcDef) {
      diagnostics.push(toDiagnostic(Errors.unknownFunction(functionName, node.range)));
      return { type: { type: 'Any', singleton: false }, diagnostics };
    }

    const arity = this.validateArity(funcDef, node, functionName);
    diagnostics.push(...arity.diagnostics);

    // Early union rules for ofType/is/as
    diagnostics.push(...this.validateUnionTypeFilters(functionName, node, context));

    // Custom analyze
    if (funcDef.analyze) {
      const result = funcDef.analyze(context, node.arguments);
      const analysisResult = result instanceof Promise ? await result : result;
      return {
        ...analysisResult,
        diagnostics: [...diagnostics, ...analysisResult.diagnostics]
      };
    }

    // Default path: analyze args
    const argAnalysis = await this.analyzeArguments(funcDef, node, context, functionName);
    diagnostics.push(...argAnalysis.diagnostics);
    if (this.stoppedAtCursor) {
      return { type: { type: 'Any', singleton: false }, diagnostics };
    }

    // Signature matching and diagnostics
    const signatureResult = this.matchAndDiagnoseSignature(
      funcDef,
      context.inputType,
      argAnalysis.argTypes,
      node,
      functionName,
      arity.hasError
    );
    diagnostics.push(...signatureResult.diagnostics);
    if (signatureResult.earlyReturn) {
      return { type: signatureResult.earlyReturn, diagnostics };
    }

    // Empty propagation
    if (this.propagatesEmpty(funcDef, context.inputType, argAnalysis.argTypes)) {
      return {
        type: { type: 'Any', singleton: false, isEmpty: true },
        diagnostics,
        context
      };
    }

    // Result inference
    let resultType = await this.inferFunctionResultType(
      funcDef,
      node,
      context,
      argAnalysis.argTypes,
      signatureResult.match
    );

    if (functionName === 'where') {
      resultType = { ...resultType, singleton: false };
    }

    return { type: resultType, diagnostics, context };
  }

  private getFunctionName(node: FunctionNode): string | null {
    if (node.name.type === NodeType.Identifier) {
      return (node.name as IdentifierNode).name;
    }
    return null;
  }

  private validateArity(
    funcDef: FunctionDefinition,
    node: FunctionNode,
    functionName: string
  ): { diagnostics: Diagnostic[]; hasError: boolean } {
    const diagnostics: Diagnostic[] = [];
    let hasError = false;
    if (funcDef.signatures && funcDef.signatures.length > 0) {
      const signature = funcDef.signatures[0];
      if (signature) {
        const params = signature.parameters || [];
        const requiredCount = params.filter(p => !p.optional).length;
        const maxCount = params.length;
        const actualCount = node.arguments.length;

        if (actualCount < requiredCount) {
          diagnostics.push(
            this.createError(
              node,
              `${functionName} expects at least ${requiredCount} argument${requiredCount !== 1 ? 's' : ''}, got ${actualCount}`,
              ErrorCodes.WRONG_ARGUMENT_COUNT
            )
          );
          hasError = true;
        } else if (actualCount > maxCount) {
          diagnostics.push(
            this.createError(
              node,
              `${functionName} expects at most ${maxCount} argument${maxCount !== 1 ? 's' : ''}, got ${actualCount}`,
              ErrorCodes.WRONG_ARGUMENT_COUNT
            )
          );
          hasError = true;
        }
      }
    }
    return { diagnostics, hasError };
  }

  private validateUnionTypeFilters(
    functionName: string,
    node: FunctionNode,
    context: AnalysisContext
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    if (!['ofType', 'is', 'as'].includes(functionName) || node.arguments.length === 0) {
      return diagnostics;
    }
    const inputType = context.inputType;
    if (!isUnionType(inputType)) {
      return diagnostics;
    }
    const typeArg = node.arguments[0]!;
    let targetType: string | undefined;
    if (typeArg.type === NodeType.Identifier) {
      targetType = (typeArg as IdentifierNode).name;
    }
    if (!targetType) {
      return diagnostics;
    }
    const diag = validateUnionChoice(inputType, targetType, typeArg.range || node.range, 'invalid-type-filter', 'Type');
    if (diag && functionName === 'ofType') diagnostics.push(diag);
    return diagnostics;
  }

  private async analyzeArguments(
    funcDef: FunctionDefinition,
    node: FunctionNode,
    context: AnalysisContext,
    functionName: string
  ): Promise<{ argTypes: TypeInfo[]; diagnostics: Diagnostic[] }> {
    const diagnostics: Diagnostic[] = [];
    const argTypes: TypeInfo[] = [];
    const signature = funcDef.signatures?.[0];
    const params = signature?.parameters || [];

    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i]!;
      const param = params[i];
      const isTypeParameter = !!param?.typeReference;

      if (isTypeParameter) {
        argTypes.push({ type: 'TypeReference' as TypeName, singleton: true });
        continue;
      }

      if (param?.expression) {
        const itemType = { ...context.inputType, singleton: true };
        const exprContext = context
          .withSystemVariable('$this', itemType)
          .withSystemVariable('$index', { type: 'Integer', singleton: true });
        const argResult = await this.analyzeNode(arg, exprContext);
        diagnostics.push(...argResult.diagnostics);
        argTypes.push(argResult.type);
        if (this.stoppedAtCursor) {
          break;
        }
        continue;
      }

      const thisType = context.systemVariables.get('$this') || context.inputType;
      const argContext = context.withInputType(thisType);
      const argResult = await this.analyzeNode(arg, argContext);
      diagnostics.push(...argResult.diagnostics);
      argTypes.push(argResult.type);
      if (this.stoppedAtCursor) {
        break;
      }
    }

    return { argTypes, diagnostics };
  }

  private matchAndDiagnoseSignature(
    funcDef: FunctionDefinition,
    actualInput: TypeInfo,
    argTypes: TypeInfo[],
    node: FunctionNode,
    functionName: string,
    hasArityError: boolean
  ): { match: FunctionSignature | null; diagnostics: Diagnostic[]; earlyReturn?: TypeInfo } {
    const diagnostics: Diagnostic[] = [];
    let match: FunctionSignature | null = null;

    if (!hasArityError && funcDef.signatures && funcDef.signatures.length > 0) {
      match = matchFunctionSignature(actualInput, argTypes, funcDef) || null;

      if (!match) {
        const inputIsEmpty = isEmptyCollection(actualInput);
        if (inputIsEmpty && !funcDef.doesNotPropagateEmpty) {
          const sig = funcDef.signatures[0];
          if (sig) {
            diagnostics.push(
              ...checkParamTypes(sig, argTypes, node.arguments, {
                warnOnSingletonOnly: false,
                doesNotPropagateEmpty: !!funcDef.doesNotPropagateEmpty,
                treatEmptyAsWarning: true,
                errorCode: ErrorCodes.ARGUMENT_TYPE_MISMATCH,
              })
            );
          }
        } else {
          let inputMatchingSignature: FunctionSignature | null = null;
          for (const sig of funcDef.signatures) {
            let inputMatches = true;
            if (sig.input) {
              const expectedInput = sig.input;
              const singletonMatch = !expectedInput.singleton || actualInput.singleton === true;
              const typeMatch =
                expectedInput.type === 'Any' ||
                actualInput.type === 'Any' ||
                expectedInput.type === actualInput.type ||
                (expectedInput.type === 'Decimal' && actualInput.type === 'Integer');
              inputMatches = singletonMatch && typeMatch;
            }
            if (inputMatches) {
              inputMatchingSignature = sig;
              break;
            }
          }

          if (inputMatchingSignature && inputMatchingSignature.parameters) {
            diagnostics.push(
              ...checkParamTypes(inputMatchingSignature, argTypes, node.arguments, {
                warnOnSingletonOnly: true,
                doesNotPropagateEmpty: !!funcDef.doesNotPropagateEmpty,
                errorCode: ErrorCodes.ARGUMENT_TYPE_MISMATCH,
              })
            );
          } else {
            const actualTypeStr = actualInput.singleton ? actualInput.type : `${actualInput.type}[]`;
            const hasSingletonSignature = funcDef.signatures.some(sig => sig.input?.singleton && sig.input.type === actualInput.type);
            const permissive = ['anyFalse', 'anyTrue'];
            if (hasSingletonSignature && !actualInput.singleton) {
              diagnostics.push(
                this.createError(
                  node,
                  `${functionName} expects a singleton value, but received collection type ${actualTypeStr}`,
                  ErrorCodes.SINGLETON_REQUIRED
                )
              );
            } else if (!permissive.includes(functionName)) {
              const expectedTypes = funcDef.signatures
                .map(sig => (sig.input ? (sig.input.singleton ? sig.input.type : `${sig.input.type}[]`) : 'Any'))
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(' or ');
              diagnostics.push(
                this.createError(
                  node,
                  `Cannot apply ${functionName}() to ${actualTypeStr}. Function expects ${expectedTypes}.`,
                  ErrorCodes.INVALID_OPERAND_TYPE
                )
              );
            }
          }
        }
      } else {
        if (match.parameters) {
          diagnostics.push(
            ...checkParamTypes(match, argTypes, node.arguments, {
              warnOnSingletonOnly: true,
              doesNotPropagateEmpty: !!funcDef.doesNotPropagateEmpty,
              errorCode: ErrorCodes.ARGUMENT_TYPE_MISMATCH,
            })
          );
        } else {
          const permissive = ['anyFalse', 'anyTrue'];
          if (permissive.includes(functionName)) {
            return { match, diagnostics, earlyReturn: { type: 'Boolean', singleton: true } };
          }
        }
      }
    }

    return { match, diagnostics };
  }

  private propagatesEmpty(
    funcDef: FunctionDefinition,
    inputType: TypeInfo,
    argTypes: TypeInfo[]
  ): boolean {
    if (funcDef.doesNotPropagateEmpty) {
      return false;
    }
    const inputIsEmpty = isEmptyCollection(inputType);
    const hasEmptyArgument = argTypes.some(argType => isEmptyCollection(argType));
    return inputIsEmpty || hasEmptyArgument;
  }

  private async inferFunctionResultType(
    funcDef: FunctionDefinition,
    node: FunctionNode,
    context: AnalysisContext,
    argTypes: TypeInfo[],
    matchingSignature: FunctionSignature | null
  ): Promise<TypeInfo> {
    if (funcDef.inferResultType) {
      return funcDef.inferResultType(this, node, context.inputType);
    }
    if (matchingSignature) {
      return resolveResultType(matchingSignature.result as any, {
        input: context.inputType,
        firstParam: argTypes[0],
      });
    }
    return context.inputType;
  }

  /**
   * Analyzes variable references, checking against context.
   */
  private analyzeVariable(node: VariableNode, context: AnalysisContext): InternalAnalysisResult {
    const varName = node.name;
    const diagnostics: Diagnostic[] = [];

    // Check if it's a user variable (starts with %)
    if (varName.startsWith('%')) {
      // Special handling for %context - it's a built-in environment variable
      // that always returns the original input to the evaluation engine
      if (varName === '%context') {
        // %context returns the root input type (the original input to evaluate())
        // In the analyzer, we track this as the initial input type
        return { type: context.inputType, diagnostics, context };
      }
      
      const name = varName.substring(1); // Remove % prefix
      const varType = context.userVariables.get(name);
      
      if (!varType) {
        // If we have dynamic variables in scope, we can't be sure this is an error
        if (context.hasDynamicVariables) {
          diagnostics.push(this.createWarning(node, `Variable '${varName}' may not be defined (dynamic variables in scope)`));
          // Return Any type since we don't know the actual type
          return { type: { type: 'Any', singleton: false }, diagnostics };
        } else {
          // No dynamic variables, so this is definitely an error
          diagnostics.push(this.createError(node, Errors.unknownUserVariable(varName).message, ErrorCodes.UNKNOWN_USER_VARIABLE));
          return { type: { type: 'Any', singleton: false }, diagnostics };
        }
      }
      
      // Attach type info to the node for backward compatibility
      node.typeInfo = varType;
      return { type: varType, diagnostics, context };
    }

    // Check system variables
    const sysVarType = context.systemVariables.get(varName);
    if (sysVarType) {
      // Attach type info to the node for backward compatibility
      node.typeInfo = sysVarType;
      return { type: sysVarType, diagnostics, context };
    }

    // Unknown variable
    diagnostics.push(this.createError(node, `Unknown variable: ${varName}`, ErrorCodes.UNKNOWN_VARIABLE));
    return { type: { type: 'Any', singleton: false }, diagnostics };
  }

  /**
   * Analyzes identifier nodes (property access).
   */
  private async analyzeIdentifier(node: IdentifierNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const name = 'name' in node ? node.name : '';
    const diagnostics: Diagnostic[] = [];
    
    // Try to use model provider for accurate type information
    if (context.modelProvider) {
      // First try to navigate from input type (property access)
      const elementType = await context.modelProvider.getElementType(context.inputType, name);
      if (elementType) {
        return {
          type: elementType,
          diagnostics,
          context
        };
      }
      // Chain-head rule: at the head of a navigation chain, allow treating the
      // identifier as a known type to seed the chain (e.g., Patient.name)
      if ((context as any)._chainHead === true) {
        const typeInfo = await context.modelProvider.getType(name);
        if (typeInfo) {
          return {
            type: typeInfo,
            diagnostics,
            context
          };
        }
      }
      
      // If property not found and we have a concrete non-union type, report warning
      // FHIRPath returns empty for unknown properties, not an error
      const mc: any = context.inputType.modelContext;
      const isUnion = !!(mc && typeof mc === 'object' && 'isUnion' in mc && mc.isUnion);
      if (context.inputType.namespace && context.inputType.name && context.inputType.modelContext && !isUnion) {
        const typeStr = `${context.inputType.namespace}.${context.inputType.name}`;
        diagnostics.push(toDiagnostic(Errors.unknownProperty(name, typeStr, node.range), DiagnosticSeverity.Warning));
        return {
          type: { type: 'Any', singleton: false },
          diagnostics,
          context
        };
      }
    }
    
    // Without a model provider, we can't know the type
    // Return Any type - don't make assumptions
    return {
      type: { type: 'Any', singleton: false },
      diagnostics,
      context
    };
  }

  /**
   * Analyzes literal values.
   */
  private analyzeLiteral(node: LiteralNode, context: AnalysisContext): InternalAnalysisResult {
    let type: TypeInfo;
    
    switch (node.valueType) {
      case 'string':
        type = { type: 'String', singleton: true };
        break;
      case 'number':
        // Number without decimal point is integer
        type = { type: 'Integer', singleton: true };
        break;
      case 'decimal':
        // Number with decimal point is decimal (even if value is whole)
        type = { type: 'Decimal', singleton: true };
        break;
      case 'boolean':
        type = { type: 'Boolean', singleton: true };
        break;
      case 'date':
        type = { type: 'Date', singleton: true };
        break;
      case 'time':
        type = { type: 'Time', singleton: true };
        break;
      case 'datetime':
        type = { type: 'DateTime', singleton: true };
        break;
      default:
        type = { type: 'Any', singleton: true };
    }
    
    return { type, diagnostics: [] };
  }
  
  private analyzeTemporalLiteral(node: TemporalLiteralNode, context: AnalysisContext): InternalAnalysisResult {
    let type: TypeInfo;
    
    switch (node.valueType) {
      case 'date':
        type = { type: 'Date', singleton: true };
        break;
      case 'time':
        type = { type: 'Time', singleton: true };
        break;
      case 'datetime':
        type = { type: 'DateTime', singleton: true };
        break;
      default:
        type = { type: 'Any', singleton: true };
    }
    
    return { type, diagnostics: [] };
  }

  /**
   * Analyzes unary operators.
   */
  private async analyzeUnary(node: UnaryNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const operandResult = await this.analyzeNode(node.operand, context);
    const diagnostics: Diagnostic[] = [...operandResult.diagnostics];
    const opDef = registry.getOperatorDefinition(node.operator);

    if (opDef && opDef.signatures && opDef.signatures.length > 0) {
      // Use first signature's result if defined
      const sig = opDef.signatures[0]!;
      const resultType = typeof sig.result === 'object' ? sig.result : operandResult.type;
      return { type: resultType, diagnostics };
    }

    // Fallback: preserve operand type
    return { type: operandResult.type, diagnostics };
  }

  /**
   * Analyzes index operations.
   */
  private async analyzeIndex(node: IndexNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const exprResult = await this.analyzeNode(node.expression, context);
    const indexResult = await this.analyzeNode(node.index, context);
    const diagnostics: Diagnostic[] = [...exprResult.diagnostics, ...indexResult.diagnostics];

    // Index should be Integer singleton; if unknown, skip strict error
    const idxType = indexResult.type;
    const isIntegerSingleton = idxType.type === 'Integer' && idxType.singleton === true;
    if (!isIntegerSingleton && idxType.type !== 'Any') {
      diagnostics.push(this.createError(node.index, 'Index must be an Integer singleton', ErrorCodes.ARGUMENT_TYPE_MISMATCH));
    }

    // Result is the element type (singleton) of the expression collection
    const exprType = exprResult.type;
    const resultType = { ...exprType, singleton: true };
    return { type: resultType, diagnostics };
  }

  /**
   * Analyzes quantity literals.
   */
  private analyzeQuantity(node: QuantityNode, context: AnalysisContext): InternalAnalysisResult {
    return {
      type: { type: 'Quantity', singleton: true },
      diagnostics: [],
      context
    };
  }

  /**
   * Analyzes collection literals.
   */
  private async analyzeCollection(node: CollectionNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const diagnostics: Diagnostic[] = [];
    const isEmpty = node.elements.length === 0;
    const elementTypes: TypeInfo[] = [];

    for (const element of node.elements) {
      const elemResult = await this.analyzeNode(element, context);
      diagnostics.push(...elemResult.diagnostics);
      elementTypes.push(elemResult.type);
      if (this.stoppedAtCursor) {
        return { type: { type: 'Any', singleton: false }, diagnostics };
      }
    }

    // Infer common element type
    let elementType: TypeInfo = { type: 'Any', singleton: true };
    if (!isEmpty) {
      elementType = elementTypes[0]!;
      for (let i = 1; i < elementTypes.length; i++) {
        const t = elementTypes[i]!;
        if (elementType.type === t.type) {
          // keep; if any is non-singleton, result stays collection anyway
          continue;
        }
        // Promote Integer to Decimal when mixed
        if ((elementType.type === 'Integer' && t.type === 'Decimal') || (elementType.type === 'Decimal' && t.type === 'Integer')) {
          elementType = { type: 'Decimal', singleton: true };
          continue;
        }
        // Unknown/heterogeneous → Any
        elementType = { type: 'Any', singleton: true };
        break;
      }
    }

    return { type: { ...elementType, singleton: false, isEmpty }, diagnostics };
  }

  /**
   * Analyzes membership test (is operator).
   */
  private async analyzeMembershipTest(node: MembershipTestNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const exprResult = await this.analyzeNode(node.expression, context);
    const diagnostics = [...exprResult.diagnostics];

    // ModelProvider requirement for non-primitive target types
    const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
    
    // Normalize System.X types to check if they're primitive
    let targetType = node.targetType;
    if (targetType.startsWith('System.')) {
      targetType = targetType.substring(7); // Remove "System." prefix
    }
    
    if (!context.modelProvider && !primitiveTypes.includes(targetType)) {
      diagnostics.push(toDiagnostic(Errors.modelProviderRequired('is', node.range)));
    }
    
    // Check if testing against a union type
    if (isUnionType(exprResult.type)) {
      const targetType = node.targetType;
      const choices = getUnionChoices(exprResult.type);
      if (choices.length > 0 && !choices.includes(targetType)) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: 'invalid-type-test',
          message: `Type test 'is ${targetType}' will always be false - type not present in union. Available types: ${choices.join(', ')}`,
          range: node.range
        });
      }
    }
    
    return {
      type: { type: 'Boolean', singleton: true },
      diagnostics
    };
  }

  /**
   * Analyzes type cast (as operator).
   */
  private async analyzeTypeCast(node: TypeCastNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const exprResult = await this.analyzeNode(node.expression, context);
    const diagnostics = [...exprResult.diagnostics];

    // ModelProvider requirement for non-primitive target types
    const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (!context.modelProvider && !primitiveTypes.includes(node.targetType)) {
      diagnostics.push(toDiagnostic(Errors.modelProviderRequired('as', node.range)));
    }
    
    // Check if casting from a union type
    if (isUnionType(exprResult.type)) {
      const targetTypeName = node.targetType;
      const choices = getUnionChoices(exprResult.type);
      if (choices.length > 0 && !choices.includes(targetTypeName)) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: 'invalid-type-cast',
          message: `Type cast 'as ${targetTypeName}' may fail - type not present in union. Available types: ${choices.join(', ')}`,
          range: node.range
        });
      }
    }
    
    // Type cast changes the type
    const targetType: TypeInfo = { 
      type: node.targetType as TypeName, 
      singleton: exprResult.type.singleton 
    };
    
    return {
      type: targetType,
      diagnostics
    };
  }

  /**
   * Analyzes error nodes.
   */
  private analyzeError(node: ErrorNode, context: AnalysisContext): InternalAnalysisResult {
    return {
      type: { type: 'Any', singleton: false },
      diagnostics: [this.createError(node, node.message, ErrorCodes.INVALID_SYNTAX)]
    };
  }

  /**
   * Analyzes cursor nodes for completion.
   */
  private analyzeCursorNode(node: AnyCursorNode, context: AnalysisContext): InternalAnalysisResult {
    // Store cursor context for completion
    if (this.cursorMode) {
      this.stoppedAtCursor = true;
      this.cursorContext = {
        typeBeforeCursor: context.inputType,
        cursorNode: node,
        expectedType: undefined,
        functionCall: undefined
      };
      
      // Set expected type based on cursor context
      if (node.context === CursorContext.Index) {
        // Index expects an integer
        this.cursorContext.expectedType = { type: 'Integer', singleton: true };
      } else if (node.context === CursorContext.Argument) {
        // Arguments context - check if we're in a function
        const parent = (node as any).parent;
        if (parent && parent.type === NodeType.Function) {
          const funcNode = parent as FunctionNode;
          if (funcNode.name.type === NodeType.Identifier) {
            const funcName = (funcNode.name as IdentifierNode).name;
            const funcDef = registry.getFunction(funcName);
            if (funcDef) {
              // Find argument index
              const argIndex = funcNode.arguments.indexOf(node);
              this.cursorContext.functionCall = {
                definition: funcDef,
                argumentIndex: argIndex >= 0 ? argIndex : 0
              };
            }
          }
        }
      }
    }
    
    return {
      type: { type: 'Any', singleton: false },
      diagnostics: []
    };
  }

  // Legacy union combiner removed; union handled in analyzeBinary

  /**
   * Helper to create diagnostic errors.
   */
  private createError(node: ASTNode, message: string, code?: string): Diagnostic {
    return {
      range: node.range,
      message,
      severity: DiagnosticSeverity.Error,
      code,
      source: 'fhirpath'
    };
  }
  
  private createWarning(node: ASTNode, message: string, code?: string): Diagnostic {
    return {
      range: node.range,
      message,
      severity: DiagnosticSeverity.Warning,
      code,
      source: 'fhirpath'
    };
  }

  /**
   * Helper method to infer TypeInfo from runtime values (used for user variables).
   */
  private inferValueType(value: any): TypeInfo {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { type: 'Any', singleton: false };
      }
      // Infer from first element
      const elementType = this.inferValueType(value[0]);
      return { ...elementType, singleton: false };
    }
    
    if (typeof value === 'string') {
      return { type: 'String', singleton: true };
    } else if (typeof value === 'number') {
      return Number.isInteger(value) 
        ? { type: 'Integer', singleton: true }
        : { type: 'Decimal', singleton: true };
    } else if (typeof value === 'boolean') {
      return { type: 'Boolean', singleton: true };
    } else if (value instanceof Date) {
      return { type: 'DateTime', singleton: true };
    } else {
      return { type: 'Any', singleton: true };
    }
  }

  async analyze(
    ast: ASTNode, 
    userVariables?: Record<string, any>, 
    inputType?: TypeInfo,
    options?: AnalyzerOptions
  ): Promise<AnalysisResultWithCursor> {
    this.cursorMode = options?.cursorMode ?? false;
    this.stoppedAtCursor = false;
    this.cursorContext = undefined;
    
    // Create initial context with system and user variables
    const systemVars = new Map<string, TypeInfo>();
    // $this should be the input type (the root context), not Any
    systemVars.set('$this', inputType || { type: 'Any', singleton: false });
    systemVars.set('$index', { type: 'Integer', singleton: true });
    systemVars.set('$total', { type: 'Any', singleton: false });
    
    const userVars = new Map<string, TypeInfo>();
    if (userVariables) {
      Object.keys(userVariables).forEach(name => {
        const value = userVariables[name];
        if (value !== undefined && value !== null) {
          userVars.set(name, this.inferValueType(value));
        }
      });
    }
    
    // Create context with analyzeNode callback and model provider
    const initialContext = new AnalysisContext(
      inputType || { type: 'Any', singleton: false },
      systemVars,
      userVars,
      (node, ctx) => this.analyzeNode(node, ctx),
      this.modelProvider
    );
    
    // Run context-flow analysis
    const result = await this.analyzeNode(ast, initialContext);
    
    // Legacy annotateAST/visitor path removed from default analysis to avoid duplication.
    
    return {
      diagnostics: result.diagnostics,
      ast,
      type: result.type,
      userVariables: new Map(result.context?.userVariables || initialContext.userVariables),
      stoppedAtCursor: this.cursorMode ? this.stoppedAtCursor : undefined,
      cursorContext: this.cursorMode ? this.cursorContext : undefined
    };
  }
}
