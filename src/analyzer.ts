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
  TypeOrIdentifierNode,
  ErrorNode,
  InternalAnalysisResult,
  QuantityNode
} from './types';
import { NodeType, DiagnosticSeverity, AnalysisContext } from './types';
import type { OperatorSignature, FunctionSignature } from './types';
import { registry } from './registry';
import { matchOperatorSignature, matchFunctionSignature, resolveResultType } from './analysis/type-compat';
import { Errors, toDiagnostic, ErrorCodes } from './errors';
import { isCursorNode, CursorContext } from './cursor-nodes';
import type { AnyCursorNode } from './cursor-nodes';

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
      case NodeType.TypeOrIdentifier:
        result = await this.analyzeIdentifier(node as IdentifierNode | TypeOrIdentifierNode, context);
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
          diagnostics: [this.createError(node, `Unknown node type: ${node.type}`)]
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
      diagnostics.push(this.createError(node, `Unknown operator: ${node.operator}`, ErrorCodes.UNKNOWN_OPERATOR));
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
    
    // Get function name
    const functionName = node.name.type === NodeType.Identifier 
      ? (node.name as IdentifierNode).name 
      : null;
    
    if (!functionName) {
      diagnostics.push(this.createError(node.name, 'Invalid function name'));
      return { type: { type: 'Any', singleton: false }, diagnostics };
    }

    // Get function definition
    const funcDef = registry.getFunction(functionName);
    if (!funcDef) {
      diagnostics.push(this.createError(node, `Unknown function: ${functionName}`, ErrorCodes.UNKNOWN_FUNCTION));
      return { type: { type: 'Any', singleton: false }, diagnostics };
    }

    // Check argument count if function has signatures
    let hasArgumentError = false;
    if (funcDef.signatures && funcDef.signatures.length > 0) {
      const signature = funcDef.signatures[0];
      if (signature) {
        const params = signature.parameters || [];
        const requiredCount = params.filter(p => !p.optional).length;
        const maxCount = params.length;
        const actualCount = node.arguments.length;
        
        if (actualCount < requiredCount) {
          diagnostics.push(this.createError(
            node, 
            `${functionName} expects at least ${requiredCount} argument${requiredCount !== 1 ? 's' : ''}, got ${actualCount}`,
            ErrorCodes.WRONG_ARGUMENT_COUNT
          ));
          hasArgumentError = true;
        } else if (actualCount > maxCount) {
          diagnostics.push(this.createError(
            node,
            `${functionName} expects at most ${maxCount} argument${maxCount !== 1 ? 's' : ''}, got ${actualCount}`,
            ErrorCodes.WRONG_ARGUMENT_COUNT
          ));
          hasArgumentError = true;
        }
      }
    }

    // Special validation for type-related functions with union types - must happen before custom analyze
    if (['ofType', 'is', 'as'].includes(functionName) && node.arguments.length > 0) {
      const inputType = context.inputType;
      
      // Check if input is a union type
      if (inputType.modelContext && 
          typeof inputType.modelContext === 'object' &&
          'isUnion' in inputType.modelContext && 
          inputType.modelContext.isUnion &&
          'choices' in inputType.modelContext &&
          Array.isArray(inputType.modelContext.choices)) {
        
        // Extract target type from first argument
        let targetType: string | undefined;
        const typeArg = node.arguments[0]!;
        
        if (typeArg.type === NodeType.TypeOrIdentifier) {
          targetType = (typeArg as TypeOrIdentifierNode).name;
        }
        
        if (targetType) {
          const validChoice = inputType.modelContext.choices.find((choice: any) => 
            choice.type === targetType || choice.code === targetType
          );
          
          if (!validChoice) {
            const availableTypes = inputType.modelContext.choices
              .map((c: any) => c.type || c.code)
              .filter((t: string) => t)
              .join(', ');
            
            if (functionName === 'ofType') {
              diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                code: 'invalid-type-filter',
                message: `Type '${targetType}' is not present in the union type. Available types: ${availableTypes}`,
                range: typeArg.range || node.range
              });
            }
          }
        }
      }
    }
    
    // If function has custom analyze method, use it
    if (funcDef.analyze) {
      const result = funcDef.analyze(context, node.arguments);
      // Handle both async and sync analyze methods
      const analysisResult = result instanceof Promise ? await result : result;
      // Merge our diagnostics with the custom analyze result
      return {
        ...analysisResult,
        diagnostics: [...diagnostics, ...analysisResult.diagnostics]
      };
    }

    // Default function analysis
    // Analyze all arguments and collect their types
    const argTypes: TypeInfo[] = [];
    const signature = funcDef.signatures?.[0];
    const params = signature?.parameters || [];
    
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i]!;
      const param = params[i];
      
      // For functions that expect type names (ofType, is, as), treat identifiers as type references
      // For other expression parameters (like where, select, etc.), analyze them normally
      const typeCheckingFunctions = ['ofType', 'is', 'as'];
      const isTypeParameter = param?.expression && 
                              typeCheckingFunctions.includes(functionName) &&
                              (arg.type === NodeType.Identifier || arg.type === NodeType.TypeOrIdentifier);
      
      if (isTypeParameter) {
        // This is a type reference, not a property access
        argTypes.push({ type: 'TypeReference' as TypeName, singleton: true });
      } else if (param?.expression) {
        // Expression parameters are analyzed with the function's input as context
        // AND with $this set to the item type (singleton version of input)
        // This matches how the interpreter uses withIterator for each item
        const itemType = { ...context.inputType, singleton: true };
        const exprContext = context
          .withSystemVariable('$this', itemType)
          .withSystemVariable('$index', { type: 'Integer', singleton: true });
        
        const argResult = await this.analyzeNode(arg, exprContext);
        diagnostics.push(...argResult.diagnostics);
        argTypes.push(argResult.type);
        
        if (this.stoppedAtCursor) {
          return { type: { type: 'Any', singleton: false }, diagnostics };
        }
      } else {
        // Normal parameters should be analyzed with $this as input
        // (they're independent expressions evaluated from the root context)
        const thisType = context.systemVariables.get('$this') || context.inputType;
        const argContext = context.withInputType(thisType);
        const argResult = await this.analyzeNode(arg, argContext);
        diagnostics.push(...argResult.diagnostics);
        argTypes.push(argResult.type);
        
        if (this.stoppedAtCursor) {
          return { type: { type: 'Any', singleton: false }, diagnostics };
        }
      }
    }

    // Check input type compatibility only if no argument errors
    if (!hasArgumentError && funcDef.signatures && funcDef.signatures.length > 0) {
      const matchingSignature = matchFunctionSignature(context.inputType, argTypes, funcDef) || null;
      
      if (!matchingSignature) {
        // Check if input is empty and function propagates empty
        const actualInput = context.inputType;
        const inputIsEmpty = actualInput.isEmpty || (actualInput.type === 'Any' && !actualInput.singleton);
        if (inputIsEmpty && !funcDef.doesNotPropagateEmpty) {
          // Empty input will propagate through
          // But still check if arguments have type errors for better diagnostics
          // Use the first signature to check parameter types
          const sig = funcDef.signatures[0];
          if (sig && sig.parameters) {
            for (let i = 0; i < argTypes.length; i++) {
              const param = sig.parameters[i];
              const argType = argTypes[i];
              if (param && argType && !param.expression) {
                // Skip empty arguments - they will propagate empty
                const isEmptyArg = argType.isEmpty || (argType.type === 'Any' && !argType.singleton);
                if (isEmptyArg) {
                  continue; // Empty arguments propagate, no error needed
                }
                
                const expectedType = param.type;
                const typeMatch = expectedType.type === 'Any' || argType.type === 'Any' ||
                                 expectedType.type === argType.type ||
                                 (expectedType.type === 'Decimal' && argType.type === 'Integer');
                const singletonMatch = !expectedType.singleton || argType.singleton;
                
                if (!typeMatch || !singletonMatch) {
                  const argTypeStr = argType.singleton ? argType.type : `${argType.type}[]`;
                  const expectedTypeStr = expectedType.singleton ? expectedType.type : `${expectedType.type}[]`;
                  diagnostics.push(this.createError(
                    node.arguments[i]!,
                    `Argument ${i + 1} of ${functionName}(): expected ${expectedTypeStr}, got ${argTypeStr}`,
                    ErrorCodes.ARGUMENT_TYPE_MISMATCH
                  ));
                }
              }
            }
          }
        } else {
          // Try to find if there's a signature that matches the input but not the parameters
          let inputMatchingSignature: FunctionSignature | null = null;
          for (const sig of funcDef.signatures) {
            let inputMatches = true;
            if (sig.input) {
              const expectedInput = sig.input;
              const singletonMatch = !expectedInput.singleton || actualInput.singleton === true;
              const typeMatch = expectedInput.type === 'Any' || actualInput.type === 'Any' || 
                               expectedInput.type === actualInput.type ||
                               (expectedInput.type === 'Decimal' && actualInput.type === 'Integer');
              inputMatches = singletonMatch && typeMatch;
            }
            if (inputMatches) {
              inputMatchingSignature = sig;
              break;
            }
          }
          
          // If we found a signature that matches input but not parameters, report parameter errors
          if (inputMatchingSignature && inputMatchingSignature.parameters) {
            // Check which parameter doesn't match
            for (let i = 0; i < argTypes.length; i++) {
              const param = inputMatchingSignature.parameters[i];
              const argType = argTypes[i];
              if (param && argType && !param.expression) {
                const isEmptyArg = argType.isEmpty || (argType.type === 'Any' && !argType.singleton);
                if (!isEmptyArg || funcDef.doesNotPropagateEmpty) {
                  const expectedType = param.type;
                  const typeMatch = expectedType.type === 'Any' || argType.type === 'Any' ||
                                   expectedType.type === argType.type ||
                                   (expectedType.type === 'Decimal' && argType.type === 'Integer');
                  const singletonMatch = !expectedType.singleton || argType.singleton;
                  
                  if (!typeMatch || !singletonMatch) {
                    const argTypeStr = argType.singleton ? argType.type : `${argType.type}[]`;
                    const expectedTypeStr = expectedType.singleton ? expectedType.type : `${expectedType.type}[]`;
                    // Use warning for singleton mismatches (collection where singleton expected)
                    // These are checked at runtime in FHIRPath
                    const isOnlySingletonMismatch = typeMatch && !singletonMatch;
                    diagnostics.push(isOnlySingletonMismatch ? 
                      this.createWarning(
                        node.arguments[i]!,
                        `Argument ${i + 1} of ${functionName}(): expected ${expectedTypeStr}, got ${argTypeStr}`,
                        ErrorCodes.ARGUMENT_TYPE_MISMATCH
                      ) :
                      this.createError(
                        node.arguments[i]!,
                        `Argument ${i + 1} of ${functionName}(): expected ${expectedTypeStr}, got ${argTypeStr}`,
                        ErrorCodes.ARGUMENT_TYPE_MISMATCH
                      )
                    );
                  }
                }
              }
            }
          } else {
            // No signature matches the input type
            const actualTypeStr = actualInput.singleton ? actualInput.type : `${actualInput.type}[]`;
            
            // Check if it's a singleton issue
            const hasSingletonSignature = funcDef.signatures.some(sig => 
              sig.input?.singleton && sig.input.type === actualInput.type
            );
            
            if (hasSingletonSignature && !actualInput.singleton) {
              // It's specifically a singleton mismatch - use the more specific error code
              diagnostics.push(this.createError(
                node,
                `${functionName} expects a singleton value, but received collection type ${actualTypeStr}`,
                ErrorCodes.SINGLETON_REQUIRED
              ));
            } else {
              // Some functions are permissive over non-boolean inputs (ignore non-boolean items)
              const permissive = ['anyFalse', 'anyTrue'];
              if (permissive.includes(functionName)) {
                // Do not add input-type error; let runtime handle.
                // Continue without adding a diagnostic here.
                // Note: result typing is handled later via signatures or defaults.
              } else {
              // List expected types
              const expectedTypes = funcDef.signatures
                .map(sig => sig.input ? 
                  (sig.input.singleton ? sig.input.type : `${sig.input.type}[]`) : 
                  'Any')
                .filter((v, i, a) => a.indexOf(v) === i) // unique
                .join(' or ');
              const errorMessage = `Cannot apply ${functionName}() to ${actualTypeStr}. Function expects ${expectedTypes}.`;
              
              diagnostics.push(this.createError(
                node,
                errorMessage,
                ErrorCodes.INVALID_OPERAND_TYPE
              ));
              }
            }
          }
        }
      } else {
        // Check argument types against the matching signature
        if (matchingSignature.parameters) {
          for (let i = 0; i < argTypes.length; i++) {
            const param = matchingSignature.parameters[i];
            if (param) {
              const argType = argTypes[i];
              if (argType) {
                // Skip type validation for expression parameters (they will be evaluated at runtime)
                // Only validate type for non-expression parameters
                if (!param.expression) {
                  // Check type compatibility
                  const expectedType = param.type;
                  const typeMatch = expectedType.type === 'Any' || argType.type === 'Any' ||
                                   expectedType.type === argType.type ||
                                   (expectedType.type === 'Decimal' && argType.type === 'Integer');
                  const singletonMatch = !expectedType.singleton || argType.singleton;
                  
                  if (!typeMatch || !singletonMatch) {
                  const argTypeStr = argType.singleton ? argType.type : `${argType.type}[]`;
                  const expectedTypeStr = expectedType.singleton ? expectedType.type : `${expectedType.type}[]`;
                  
                  // Check if this is an empty collection - if so, generate warning instead of error
                  const isEmptyCollection = argType.isEmpty || 
                                          (argType.type === 'Any' && !argType.singleton);
                  
                  if (isEmptyCollection && !funcDef.doesNotPropagateEmpty) {
                    // Empty collection will propagate - generate warning
                    diagnostics.push(this.createWarning(
                      node.arguments[i]!,
                      `Argument ${i + 1} of ${functionName}(): expected ${expectedTypeStr}, got empty collection. Result will be empty.`
                    ));
                  } else {
                    // Type mismatch - check if it's only a singleton issue
                    const isOnlySingletonMismatch = typeMatch && !singletonMatch;
                    diagnostics.push(isOnlySingletonMismatch ?
                      this.createWarning(
                        node.arguments[i]!,
                        `Argument ${i + 1} of ${functionName}(): expected ${expectedTypeStr}, got ${argTypeStr}`,
                        ErrorCodes.ARGUMENT_TYPE_MISMATCH
                      ) :
                      this.createError(
                        node.arguments[i]!,
                        `Argument ${i + 1} of ${functionName}(): expected ${expectedTypeStr}, got ${argTypeStr}`,
                        ErrorCodes.ARGUMENT_TYPE_MISMATCH
                      )
                    );
                  }
                  }
                }
              }
            }
          }
        } else {
          // Some existence-like functions accept non-boolean input by ignoring non-boolean values
          const permissive = ['anyFalse', 'anyTrue'];
          if (permissive.includes(functionName)) {
            // Do not error; let runtime semantics decide. Assume Boolean result.
            return { type: { type: 'Boolean', singleton: true }, diagnostics };
          }
        }
      }
    }

    // Check for empty propagation
    // If function propagates empty and input or any argument is empty, result is empty
    if (!funcDef.doesNotPropagateEmpty) {
      // Check if input is empty collection
      const inputIsEmpty = context.inputType.isEmpty || 
                          (context.inputType.type === 'Any' && !context.inputType.singleton);
      
      // Check if any argument is empty collection
      const hasEmptyArgument = argTypes.some(argType => 
        argType.isEmpty || (argType.type === 'Any' && !argType.singleton)
      );
      
      if (inputIsEmpty || hasEmptyArgument) {
        // Function propagates empty - result is empty collection
        return {
          type: { type: 'Any', singleton: false, isEmpty: true },
          diagnostics,
          context // Preserve context even when empty propagates
        };
      }
    }
    
    
    // Determine result type - use custom inference if available
    let resultType = context.inputType;
    
    // Check if function has custom type inference
    if (funcDef.inferResultType) {
      resultType = await funcDef.inferResultType(this, node, context.inputType);
    } else {
      // Use signature-based type inference
      let matchingSignature: FunctionSignature | null = null;
      if (funcDef.signatures && funcDef.signatures.length > 0) {
        matchingSignature = matchFunctionSignature(context.inputType, argTypes, funcDef) || funcDef.signatures[0] || null;
        if (matchingSignature) {
          resultType = resolveResultType(matchingSignature.result as any, {
            input: context.inputType,
            firstParam: argTypes[0],
          });
        }
      }
    }

    // Special-case: where() preserves input type but as collection
    if (functionName === 'where') {
      resultType = { ...resultType, singleton: false };
    }

    return {
      type: resultType,
      diagnostics,
      context // Preserve context with user variables
    };
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
  private async analyzeIdentifier(node: IdentifierNode | TypeOrIdentifierNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
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
      
      // For TypeOrIdentifier nodes with uppercase names, check if it's a type name
      // This handles cases like "Patient.children()" where Patient is a type, not a property
      if (node.type === 'TypeOrIdentifier' && /^[A-Z]/.test(name)) {
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
        diagnostics.push(this.createWarning(
          node,
          `Unknown property '${name}' on type '${context.inputType.namespace}.${context.inputType.name}'`,
          ErrorCodes.UNKNOWN_PROPERTY
        ));
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
        // Check if integer or decimal
        type = Number.isInteger(node.value) 
          ? { type: 'Integer', singleton: true }
          : { type: 'Decimal', singleton: true };
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
    if (!context.modelProvider && !primitiveTypes.includes(node.targetType)) {
      diagnostics.push(toDiagnostic(Errors.modelProviderRequired('is', node.range)));
    }
    
    // Check if testing against a union type
    if (exprResult.type.modelContext && 
        typeof exprResult.type.modelContext === 'object' &&
        'isUnion' in exprResult.type.modelContext && 
        exprResult.type.modelContext.isUnion &&
        'choices' in exprResult.type.modelContext &&
        Array.isArray(exprResult.type.modelContext.choices)) {
      
      const targetType = node.targetType;
      const validChoice = exprResult.type.modelContext.choices.find((choice: any) => 
        choice.type === targetType || choice.code === targetType
      );
      
      if (!validChoice) {
        const availableTypes = exprResult.type.modelContext.choices
          .map((c: any) => c.type || c.code)
          .filter((t: string) => t)
          .join(', ');
        
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: 'invalid-type-test',
          message: `Type test 'is ${targetType}' will always be false - type not present in union. Available types: ${availableTypes}`,
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
    if (exprResult.type.modelContext && 
        typeof exprResult.type.modelContext === 'object' &&
        'isUnion' in exprResult.type.modelContext && 
        exprResult.type.modelContext.isUnion &&
        'choices' in exprResult.type.modelContext &&
        Array.isArray(exprResult.type.modelContext.choices)) {
      
      const targetTypeName = node.targetType;
      const validChoice = exprResult.type.modelContext.choices.find((choice: any) => 
        choice.type === targetTypeName || choice.code === targetTypeName
      );
      
      if (!validChoice) {
        const availableTypes = exprResult.type.modelContext.choices
          .map((c: any) => c.type || c.code)
          .filter((t: string) => t)
          .join(', ');
        
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: 'invalid-type-cast',
          message: `Type cast 'as ${targetTypeName}' may fail - type not present in union. Available types: ${availableTypes}`,
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
      diagnostics: [this.createError(node, node.message)]
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
