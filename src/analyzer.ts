import type { 
  ASTNode, 
  BinaryNode, 
  IdentifierNode, 
  LiteralNode, 
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
import { Errors, toDiagnostic, ErrorCodes } from './errors';
import { isCursorNode, CursorContext } from './cursor-nodes';
import type { AnyCursorNode } from './cursor-nodes';
import { ScopeManager } from './scope-manager';

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
  private diagnostics: Diagnostic[] = [];
  private variables: Set<string> = new Set(['$this', '$index', '$total', 'context', 'resource', 'rootResource']);
  private modelProvider?: ModelProvider;
  private userVariableTypes: Map<string, TypeInfo> = new Map();
  private systemVariableTypes: ScopeManager<TypeInfo>;
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
    this.systemVariableTypes = new ScopeManager<TypeInfo>();
    // Initialize global system variables
    this.systemVariableTypes.set('$this', { type: 'Any', singleton: false });
    this.systemVariableTypes.set('$index', { type: 'Integer', singleton: true });
    this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
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
      
      // Combine types from both branches
      const type = this.combineUnionTypes(leftResult.type, rightResult.type);
      
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
      // Find a matching signature
      let matchingSignature: OperatorSignature | null = null;
      for (const sig of operatorDef.signatures) {
        // Check if types match (with some flexibility for Any)
        const leftTypeMatches = sig.left.type === 'Any' || leftResult.type.type === 'Any' || 
                           sig.left.type === leftResult.type.type ||
                           (sig.left.type === 'Decimal' && leftResult.type.type === 'Integer');
        const rightTypeMatches = sig.right.type === 'Any' || rightResult.type.type === 'Any' || 
                            sig.right.type === rightResult.type.type ||
                            (sig.right.type === 'Decimal' && rightResult.type.type === 'Integer');
        
        // Also check singleton requirements
        const leftSingletonMatches = !sig.left.singleton || leftResult.type.singleton;
        const rightSingletonMatches = !sig.right.singleton || rightResult.type.singleton;
        
        if (leftTypeMatches && rightTypeMatches && leftSingletonMatches && rightSingletonMatches) {
          matchingSignature = sig;
          break;
        }
      }
      
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
      let resultType: TypeInfo;
      if (matchingSignature.result === 'leftType') {
        resultType = leftResult.type;
      } else if (matchingSignature.result === 'rightType') {
        resultType = rightResult.type;
      } else if (typeof matchingSignature.result === 'object') {
        resultType = matchingSignature.result;
      } else {
        resultType = { type: 'Any', singleton: false };
      }
      
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

    // If function has custom analyze method, use it
    if (funcDef.analyze) {
      const result = funcDef.analyze(context, node.arguments);
      // Handle both async and sync analyze methods
      return result instanceof Promise ? await result : result;
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
      // Try to find a matching signature based on input type AND parameters
      let matchingSignature: FunctionSignature | null = null;
      const actualInput = context.inputType;
      
      for (const sig of funcDef.signatures) {
        // Check input type first
        let inputMatches = true;
        if (sig.input) {
          const expectedInput = sig.input;
          
          // Check both singleton and type requirements
          const singletonMatch = !expectedInput.singleton || actualInput.singleton;
          const typeMatch = expectedInput.type === 'Any' || actualInput.type === 'Any' || 
                           expectedInput.type === actualInput.type ||
                           (expectedInput.type === 'Decimal' && actualInput.type === 'Integer');
          
          inputMatches = singletonMatch && typeMatch;
        }
        
        if (!inputMatches) continue;
        
        // Check parameter types
        let paramsMatch = true;
        if (sig.parameters) {
          for (let i = 0; i < argTypes.length; i++) {
            const param = sig.parameters[i];
            const argType = argTypes[i];
            if (param && argType && !param.expression) {
              // Skip empty arguments - they'll propagate empty at runtime
              const isEmptyArg = argType.isEmpty || (argType.type === 'Any' && !argType.singleton);
              if (isEmptyArg && !funcDef.doesNotPropagateEmpty) {
                continue; // Empty will propagate, so this signature could work
              }
              
              const expectedType = param.type;
              const typeMatch = expectedType.type === 'Any' || argType.type === 'Any' ||
                               expectedType.type === argType.type ||
                               (expectedType.type === 'Decimal' && argType.type === 'Integer');
              const singletonMatch = !expectedType.singleton || argType.singleton;
              
              if (!typeMatch || !singletonMatch) {
                paramsMatch = false;
                break;
              }
            }
          }
        }
        
        if (paramsMatch) {
          matchingSignature = sig;
          break;
        }
      }
      
      if (!matchingSignature) {
        // Check if input is empty and function propagates empty
        const inputIsEmpty = actualInput.isEmpty || 
                           (actualInput.type === 'Any' && !actualInput.singleton);
        if (inputIsEmpty && !funcDef.doesNotPropagateEmpty) {
          // Empty input will propagate through - no error needed
          // The empty propagation logic above will handle this
        } else {
          // Try to find if there's a signature that matches the input but not the parameters
          let inputMatchingSignature: FunctionSignature | null = null;
          for (const sig of funcDef.signatures) {
            let inputMatches = true;
            if (sig.input) {
              const expectedInput = sig.input;
              const singletonMatch = !expectedInput.singleton || actualInput.singleton;
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
    
    // Determine result type from function signature
    let resultType = context.inputType;
    let matchingSignature: FunctionSignature | null = null;
    
    if (funcDef.signatures && funcDef.signatures.length > 0) {
      // Find matching signature (same logic as above)
      const actualInput = context.inputType;
      
      for (const sig of funcDef.signatures) {
        if (sig.input) {
          const expectedInput = sig.input;
          
          const singletonMatch = !expectedInput.singleton || actualInput.singleton;
          const typeMatch = expectedInput.type === 'Any' || actualInput.type === 'Any' || 
                           expectedInput.type === actualInput.type ||
                           (expectedInput.type === 'Decimal' && actualInput.type === 'Integer');
          
          if (singletonMatch && typeMatch) {
            matchingSignature = sig;
            break;
          }
        } else {
          matchingSignature = sig;
          break;
        }
      }
      
      // Use matching signature or first as fallback
      const signature = matchingSignature || funcDef.signatures[0];
      
      if (signature) {
        if (signature.result === 'inputType') {
          resultType = context.inputType;
        } else if (signature.result === 'inputTypeSingleton') {
          // Make the input type a singleton
          resultType = { ...context.inputType, singleton: true };
        } else if (typeof signature.result === 'object') {
          resultType = signature.result;
        }
      }
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
        diagnostics.push(this.createError(node, Errors.unknownUserVariable(varName).message, ErrorCodes.UNKNOWN_USER_VARIABLE));
        return { type: { type: 'Any', singleton: false }, diagnostics };
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
      
      // If property not found and we have a concrete type, report warning
      // FHIRPath returns empty for unknown properties, not an error
      if (context.inputType.namespace && context.inputType.name && 
          context.inputType.modelContext) {
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
      
      // Try as a type name (for types starting with uppercase)
      if (/^[A-Z]/.test(name)) {
        const typeInfo = await context.modelProvider.getType(name);
        if (typeInfo) {
          return {
            type: typeInfo,
            diagnostics,
            context
          };
        }
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

  /**
   * Analyzes unary operators.
   */
  private async analyzeUnary(node: UnaryNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const operandResult = await this.analyzeNode(node.operand, context);
    // For now, preserve operand type
    return operandResult;
  }

  /**
   * Analyzes index operations.
   */
  private async analyzeIndex(node: IndexNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const exprResult = await this.analyzeNode(node.expression, context);
    const indexResult = await this.analyzeNode(node.index, context);
    
    return {
      type: exprResult.type, // Indexing preserves collection element type
      diagnostics: [...exprResult.diagnostics, ...indexResult.diagnostics]
    };
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
    
    // Check if this is an empty collection
    const isEmpty = node.elements.length === 0;
    
    for (const element of node.elements) {
      const elemResult = await this.analyzeNode(element, context);
      diagnostics.push(...elemResult.diagnostics);
      
      if (this.stoppedAtCursor) {
        return { type: { type: 'Any', singleton: false }, diagnostics };
      }
    }
    
    return {
      type: { type: 'Any', singleton: false, isEmpty },
      diagnostics
    };
  }

  /**
   * Analyzes membership test (is operator).
   */
  private async analyzeMembershipTest(node: MembershipTestNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const exprResult = await this.analyzeNode(node.expression, context);
    
    return {
      type: { type: 'Boolean', singleton: true },
      diagnostics: exprResult.diagnostics
    };
  }

  /**
   * Analyzes type cast (as operator).
   */
  private async analyzeTypeCast(node: TypeCastNode, context: AnalysisContext): Promise<InternalAnalysisResult> {
    const exprResult = await this.analyzeNode(node.expression, context);
    
    // Type cast changes the type
    const targetType: TypeInfo = { 
      type: node.targetType as TypeName, 
      singleton: exprResult.type.singleton 
    };
    
    return {
      type: targetType,
      diagnostics: exprResult.diagnostics
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

  /**
   * Helper to combine types from union branches.
   */
  private combineUnionTypes(left: TypeInfo, right: TypeInfo): TypeInfo {
    // Union always produces a collection (never singleton)
    // If both sides have the same type, preserve it
    if (left.type === right.type) {
      return { type: left.type, singleton: false };
    }
    
    // If types are compatible (e.g., Integer and Decimal), use the broader type
    if ((left.type === 'Integer' && right.type === 'Decimal') ||
        (left.type === 'Decimal' && right.type === 'Integer')) {
      return { type: 'Decimal', singleton: false };
    }
    
    // Otherwise, return Any for mixed types
    return { type: 'Any', singleton: false };
  }

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
    
    // For backward compatibility with old annotateAST approach
    // TODO: Remove this once all callers are updated
    // We need to run annotateAST even in cursor mode to get model-based type information
    // Populate userVariableTypes for the old visitor pattern
    this.userVariableTypes.clear();
    if (userVariables) {
      Object.keys(userVariables).forEach(name => {
        const value = userVariables[name];
        if (value !== undefined && value !== null) {
          this.userVariableTypes.set(name, this.inferValueType(value));
        }
      });
    }
    await this.annotateAST(ast, inputType);
    
    // Clear diagnostics from old visitor pattern if we're using new context-flow
    // The new context-flow diagnostics are more accurate for variable scoping
    this.diagnostics = [];
    
    return {
      diagnostics: result.diagnostics,
      ast,
      type: result.type,
      userVariables: result.context?.userVariables || initialContext.userVariables,
      stoppedAtCursor: this.cursorMode ? this.stoppedAtCursor : undefined,
      cursorContext: this.cursorMode ? this.cursorContext : undefined
    };
  }

  private visitNode(node: ASTNode): void {
    // Check for cursor node in cursor mode
    if (this.cursorMode && isCursorNode(node)) {
      this.stoppedAtCursor = true;
      this.cursorContext = {
        cursorNode: node as AnyCursorNode,
        typeBeforeCursor: (node as any).typeInfo
      };
      return; // Short-circuit
    }
    
    // Handle error nodes - process them for diagnostics but don't traverse
    if (node.type === 'Error') {
      // Diagnostics already added in annotateAST
      return;
    }
    
    // If we've already stopped at cursor, don't continue
    if (this.stoppedAtCursor) {
      return;
    }
    
    switch (node.type) {
      case NodeType.Binary:
        this.visitBinaryOperator(node as BinaryNode);
        break;
      case NodeType.Identifier:
        this.visitIdentifier(node as IdentifierNode);
        break;
      case NodeType.Function:
        this.visitFunctionCall(node as FunctionNode);
        break;
      case NodeType.Index:
        const indexNode = node as IndexNode;
        this.visitNode(indexNode.expression);
        this.visitNode(indexNode.index);
        break;
      case NodeType.Collection:
        (node as CollectionNode).elements.forEach(el => this.visitNode(el));
        break;
      case NodeType.Unary:
        this.visitNode((node as UnaryNode).operand);
        break;
      case NodeType.MembershipTest:
        this.visitMembershipTest(node as MembershipTestNode);
        break;
      case NodeType.TypeCast:
        this.visitTypeCast(node as TypeCastNode);
        break;
      case NodeType.Variable:
        this.validateVariable((node as VariableNode).name, node);
        break;
      case NodeType.Literal:
      case NodeType.TypeOrIdentifier:
      case NodeType.TypeReference:
        // These are always valid
        break;
    }
  }

  private visitBinaryOperator(node: BinaryNode): void {
    this.visitNode(node.left);
    
    // Track defineVariable for validation - collect all variables defined in the chain
    if (node.operator === '.') {
      const definedVars = this.collectDefinedVariables(node.left);
      if (definedVars.size > 0) {
        // Track which variables were already known
        const previouslyKnown = new Set<string>();
        definedVars.forEach(varName => {
          if (this.variables.has(varName)) {
            previouslyKnown.add(varName);
          }
          this.variables.add(varName);
        });
        
        // Visit right side with new variables in scope
        this.visitNode(node.right);
        
        // Restore previous state
        definedVars.forEach(varName => {
          if (!previouslyKnown.has(varName)) {
            this.variables.delete(varName);
          }
        });
        return;
      }
    }
    
    // Special handling for dot operator with function on right side
    if (node.operator === '.' && node.right.type === NodeType.Function) {
      const funcNode = node.right as FunctionNode;
      if (funcNode.name.type === NodeType.Identifier) {
        const funcName = (funcNode.name as IdentifierNode).name;
        const func = registry.getFunction(funcName);
        if (func && func.signatures && func.signatures.length > 0 && node.left.typeInfo) {
          // Check if any signature matches the input type
          let matchFound = false;
          let expectedTypes: string[] = [];
          
          for (const signature of func.signatures) {
            if (signature.input) {
              if (this.isTypeCompatible(node.left.typeInfo, signature.input)) {
                matchFound = true;
                break;
              }
              expectedTypes.push(this.typeToString(signature.input));
            } else {
              // If any signature has no input constraint, it matches
              matchFound = true;
              break;
            }
          }
          
          if (!matchFound) {
            const inputTypeStr = this.typeToString(node.left.typeInfo);
            const firstSignature = func.signatures[0];
            
            if (!firstSignature) return;
            
            // Check if this is specifically a singleton/collection mismatch
            const inputIsCollection = !node.left.typeInfo.singleton;
            const expectedIsSingleton = firstSignature.input?.singleton;
            
            // Check if the base types are compatible (same type or subtype)
            const typesCompatible = firstSignature.input && (
              node.left.typeInfo.type === firstSignature.input.type ||
              this.isSubtypeOf(node.left.typeInfo.type, firstSignature.input.type)
            );
            
            if (inputIsCollection && expectedIsSingleton && typesCompatible) {
              // Compatible base types but collection vs singleton mismatch
              this.diagnostics.push(
                toDiagnostic(Errors.singletonTypeRequired(funcName, inputTypeStr, funcNode.range))
              );
            } else {
              // Function received invalid operand type - report as runtime error
              this.diagnostics.push(
                toDiagnostic(Errors.invalidOperandType(funcName + '()', inputTypeStr, funcNode.range))
              );
            }
          }
        }
      }
    }
    
    this.visitNode(node.right);
    
    // For dot operator, we don't need to check operator types
    if (node.operator === '.') {
      return;
    }
    
    const op = registry.getOperatorDefinition(node.operator);
    if (!op) {
      this.diagnostics.push(
        toDiagnostic(Errors.unknownOperator(node.operator, node.range))
      );
      return;
    }
    
    // Type check if we have type information
    if (node.left.typeInfo && node.right.typeInfo) {
      this.checkBinaryOperatorTypes(node, op);
    }
  }

  private visitIdentifier(node: IdentifierNode): void {
    this.validateVariable(node.name, node);
  }

  private visitFunctionCall(node: FunctionNode): void {
    if (node.name.type === NodeType.Identifier) {
      const funcName = (node.name as IdentifierNode).name;
      
      // Special handling for iif lazy evaluation
      if (funcName === 'iif') {
        this.handleIifFunction(node);
        return;
      }
      
      // Check if this is a type operation that requires ModelProvider
      if (funcName === 'ofType' && !this.modelProvider) {
        // Check if the type argument is a primitive type
        const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
        let isPrimitive = false;
        
        if (node.arguments.length > 0) {
          const typeArg = node.arguments[0]!;
          if (typeArg.type === NodeType.Identifier) {
            isPrimitive = primitiveTypes.includes((typeArg as IdentifierNode).name);
          } else if ((typeArg as any).type === NodeType.TypeOrIdentifier || (typeArg as any).type === NodeType.TypeReference) {
            isPrimitive = primitiveTypes.includes((typeArg as any).name);
          }
        }
        
        if (!isPrimitive) {
          this.diagnostics.push(
            toDiagnostic(Errors.modelProviderRequired('ofType', node.range))
          );
        }
      }
      
      // Check ofType with union types
      if (funcName === 'ofType' && node.typeInfo) {
        const inputType = node.typeInfo;
        if (node.arguments.length > 0 && inputType.modelContext && 
            typeof inputType.modelContext === 'object' &&
            'isUnion' in inputType.modelContext && 
            inputType.modelContext.isUnion &&
            'choices' in inputType.modelContext &&
            Array.isArray(inputType.modelContext.choices)) {
          
          // Extract target type from argument
          let targetType: string | undefined;
          const typeArg = node.arguments[0]!;
          if (typeArg.type === NodeType.Identifier) {
            targetType = (typeArg as IdentifierNode).name;
          } else if ((typeArg as any).type === NodeType.TypeOrIdentifier || (typeArg as any).type === NodeType.TypeReference) {
            targetType = (typeArg as any).name;
          }
          
          if (targetType) {
            const validChoice = inputType.modelContext.choices.find((choice: any) => 
              choice.type === targetType || choice.code === targetType
            );
            
            if (!validChoice) {
              this.diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                code: 'invalid-type-filter',
                message: `Type '${targetType}' is not present in the union type. Available types: ${
                  inputType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
                }`,
                range: node.range
              });
            }
          }
        }
      }
      
      const func = registry.getFunction(funcName);
      
      if (!func) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownFunction(funcName, node.range))
        );
      } else {
        // Check argument count based on signature
        const params = func.signatures?.[0]?.parameters || [];
        const requiredParams = params.filter(p => !p.optional).length;
        const maxParams = params.length;
        
        if (node.arguments.length < requiredParams) {
          this.diagnostics.push(
            toDiagnostic(Errors.wrongArgumentCount(funcName, requiredParams, node.arguments.length, node.range))
          );
        } else if (node.arguments.length > maxParams) {
          this.diagnostics.push(
            toDiagnostic(Errors.wrongArgumentCount(funcName, maxParams, node.arguments.length, node.range))
          );
        }
        
        // Type check arguments if we have type information
        if (node.typeInfo || node.arguments.some(arg => arg.typeInfo)) {
          this.checkFunctionArgumentTypes(node, func);
        }
      }
    }
    
    node.arguments.forEach(arg => this.visitNode(arg));
  }

  private handleIifFunction(node: FunctionNode): void {
    // Validate function exists and has correct arguments
    const func = registry.getFunction('iif');
    if (!func) {
      this.diagnostics.push(
        toDiagnostic(Errors.unknownFunction('iif', node.range))
      );
      return;
    }

    // Check argument count
    const params = func.signatures?.[0]?.parameters || [];
    const requiredParams = params.filter(p => !p.optional).length;
    const maxParams = params.length;
    
    if (node.arguments.length < requiredParams) {
      this.diagnostics.push(
        toDiagnostic(Errors.wrongArgumentCount('iif', requiredParams, node.arguments.length, node.range))
      );
      return;
    } else if (node.arguments.length > maxParams) {
      this.diagnostics.push(
        toDiagnostic(Errors.wrongArgumentCount('iif', maxParams, node.arguments.length, node.range))
      );
      return;
    }

    // Check if condition is a literal boolean
    const conditionArg = node.arguments[0];
    if (!conditionArg) {
      return;
    }

    // Always analyze the condition
    this.visitNode(conditionArg);

    // Check if condition is a literal boolean
    let isLiteralTrue = false;
    let isLiteralFalse = false;
    
    if (conditionArg.type === NodeType.Literal) {
      const literalNode = conditionArg as LiteralNode;
      if (literalNode.value === true) {
        isLiteralTrue = true;
      } else if (literalNode.value === false) {
        isLiteralFalse = true;
      }
    }

    const trueBranch = node.arguments[1];
    const falseBranch = node.arguments[2];

    if (isLiteralTrue) {
      // Condition is literal true - analyze true branch, warn about false branch
      if (trueBranch) {
        this.visitNode(trueBranch);
      }
      if (falseBranch) {
        this.diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: ErrorCodes.UNREACHABLE_CODE,
          message: 'Unreachable code: false branch will never execute',
          source: 'fhirpath',
          range: falseBranch.range
        });
      }
    } else if (isLiteralFalse) {
      // Condition is literal false - warn about true branch, analyze false branch
      if (trueBranch) {
        this.diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: ErrorCodes.UNREACHABLE_CODE,
          message: 'Unreachable code: true branch will never execute',
          source: 'fhirpath',
          range: trueBranch.range
        });
      }
      if (falseBranch) {
        this.visitNode(falseBranch);
      }
    } else {
      // Dynamic condition - analyze both branches
      if (trueBranch) {
        this.visitNode(trueBranch);
      }
      if (falseBranch) {
        this.visitNode(falseBranch);
      }
    }

    // Type check arguments if we have type information
    if (node.typeInfo || node.arguments.some(arg => arg.typeInfo)) {
      this.checkFunctionArgumentTypes(node, func);
    }
  }

  private visitMembershipTest(node: MembershipTestNode): void {
    // Check if ModelProvider is required
    // Basic primitive types can be checked without ModelProvider
    const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (!this.modelProvider && !primitiveTypes.includes(node.targetType)) {
      this.diagnostics.push(
        toDiagnostic(Errors.modelProviderRequired('is', node.range))
      );
    }
    
    // Check 'is' with union types
    if (node.expression.typeInfo) {
      const leftType = node.expression.typeInfo;
      if (leftType.modelContext && 
          typeof leftType.modelContext === 'object' &&
          'isUnion' in leftType.modelContext && 
          leftType.modelContext.isUnion &&
          'choices' in leftType.modelContext &&
          Array.isArray(leftType.modelContext.choices)) {
        
        const targetTypeName = node.targetType;
        const validChoice = leftType.modelContext.choices.find((choice: any) =>
          choice.type === targetTypeName || choice.code === targetTypeName
        );
        
        if (!validChoice) {
          this.diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            code: 'invalid-type-test',
            message: `Type test 'is ${targetTypeName}' will always be false. Type '${targetTypeName}' is not in the union. Available types: ${
              leftType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
            }`,
            range: node.range
          });
        }
      }
    }
    
    this.visitNode(node.expression);
  }

  private visitTypeCast(node: TypeCastNode): void {
    // Check if ModelProvider is required
    // Basic primitive types can be checked without ModelProvider
    const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (!this.modelProvider && !primitiveTypes.includes(node.targetType)) {
      this.diagnostics.push(
        toDiagnostic(Errors.modelProviderRequired('as', node.range))
      );
    }
    
    // Check 'as' with union types
    if (node.expression.typeInfo) {
      const leftType = node.expression.typeInfo;
      if (leftType.modelContext && 
          typeof leftType.modelContext === 'object' &&
          'isUnion' in leftType.modelContext && 
          leftType.modelContext.isUnion &&
          'choices' in leftType.modelContext &&
          Array.isArray(leftType.modelContext.choices)) {
        
        const targetTypeName = node.targetType;
        const validChoice = leftType.modelContext.choices.find((choice: any) =>
          choice.type === targetTypeName || choice.code === targetTypeName
        );
        
        if (!validChoice) {
          this.diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            code: 'invalid-type-cast',
            message: `Type cast 'as ${targetTypeName}' may fail. Type '${targetTypeName}' is not guaranteed in the union. Available types: ${
              leftType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
            }`,
            range: node.range
          });
        }
      }
    }
    
    this.visitNode(node.expression);
  }

  // Unified variable validation to eliminate duplication
  private validateVariable(name: string, node: ASTNode): void {
    if (name.startsWith('$')) {
      if (!this.variables.has(name)) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownVariable(name, node.range))
        );
      }
    } else if (name.startsWith('%')) {
      const varName = name.substring(1);
      if (!this.variables.has(varName)) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownUserVariable(name, node.range))
        );
      }
    }
  }
  
  private collectDefinedVariables(node: ASTNode): Set<string> {
    const vars = new Set<string>();
    
    // If this is a defineVariable call, extract the variable name
    if (node.type === NodeType.Function) {
      const funcNode = node as FunctionNode;
      if (funcNode.name.type === NodeType.Identifier && 
          (funcNode.name as IdentifierNode).name === 'defineVariable' &&
          funcNode.arguments.length >= 1) {
        const nameArg = funcNode.arguments[0];
        if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
          vars.add(nameArg.value as string);
        }
      }
    }
    
    // If this is a binary dot operator, collect from left side recursively
    if (node.type === NodeType.Binary) {
      const binaryNode = node as BinaryNode;
      if (binaryNode.operator === '.') {
        // Collect from left side
        const leftVars = this.collectDefinedVariables(binaryNode.left);
        leftVars.forEach(v => vars.add(v));
        
        // Check if right side is also defineVariable
        if (binaryNode.right.type === NodeType.Function) {
          const rightFunc = binaryNode.right as FunctionNode;
          if (rightFunc.name.type === NodeType.Identifier && 
              (rightFunc.name as IdentifierNode).name === 'defineVariable' &&
              rightFunc.arguments.length >= 1) {
            const nameArg = rightFunc.arguments[0];
            if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
              vars.add(nameArg.value as string);
            }
          }
        }
      }
    }
    
    return vars;
  }
  
  private collectDefinedVariablesWithTypes(node: ASTNode): Map<string, TypeInfo> {
    const varsWithTypes = new Map<string, TypeInfo>();
    
    // If this is a defineVariable call, extract the variable name and type
    if (node.type === NodeType.Function) {
      const funcNode = node as FunctionNode;
      if (funcNode.name.type === NodeType.Identifier && 
          (funcNode.name as IdentifierNode).name === 'defineVariable' &&
          funcNode.arguments.length >= 1) {
        const nameArg = funcNode.arguments[0];
        if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
          const varName = nameArg.value as string;
          let varType: TypeInfo;
          
          if (funcNode.arguments.length >= 2 && funcNode.arguments[1]!.typeInfo) {
            // Has value expression - use its type
            varType = funcNode.arguments[1]!.typeInfo;
          } else if (node.typeInfo) {
            // No value expression - uses input as value (defineVariable returns input)
            varType = node.typeInfo;
          } else {
            varType = { type: 'Any', singleton: false };
          }
          
          varsWithTypes.set(varName, varType);
        }
      }
    }
    
    // If this is a binary dot operator, collect from entire chain
    if (node.type === NodeType.Binary) {
      const binaryNode = node as BinaryNode;
      if (binaryNode.operator === '.') {
        // Collect from left side recursively
        const leftVars = this.collectDefinedVariablesWithTypes(binaryNode.left);
        leftVars.forEach((type, name) => varsWithTypes.set(name, type));
        
        // Check if right side is also defineVariable
        if (binaryNode.right.type === NodeType.Function) {
          const rightFunc = binaryNode.right as FunctionNode;
          if (rightFunc.name.type === NodeType.Identifier && 
              (rightFunc.name as IdentifierNode).name === 'defineVariable' &&
              rightFunc.arguments.length >= 1) {
            const nameArg = rightFunc.arguments[0];
            if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
              const varName = nameArg.value as string;
              let varType: TypeInfo;
              
              if (rightFunc.arguments.length >= 2 && rightFunc.arguments[1]!.typeInfo) {
                varType = rightFunc.arguments[1]!.typeInfo;
              } else if (binaryNode.typeInfo) {
                varType = binaryNode.typeInfo;
              } else {
                varType = { type: 'Any', singleton: false };
              }
              
              varsWithTypes.set(varName, varType);
            }
          }
        }
      }
    }
    
    return varsWithTypes;
  }


  // Type inference methods
  private async inferType(node: ASTNode, inputType?: TypeInfo): Promise<TypeInfo> {
    // Handle error nodes
    if (node.type === 'Error') {
      return this.inferErrorNodeType(node as ErrorNode, inputType);
    }
    
    switch (node.type) {
      case NodeType.Literal:
        return this.inferLiteralType(node as LiteralNode);
        
      case NodeType.Binary:
        return await this.inferBinaryType(node as BinaryNode, inputType);
        
      case NodeType.Unary:
        return this.inferUnaryType(node as UnaryNode);
        
      case NodeType.Function:
        return await this.inferFunctionType(node as FunctionNode, inputType);
        
      case NodeType.Identifier:
        return await this.inferIdentifierType(node as IdentifierNode, inputType);
        
      case NodeType.Variable:
        return this.inferVariableType(node as VariableNode);
        
      case NodeType.Collection:
        return await this.inferCollectionType(node as CollectionNode);
        
      case NodeType.TypeCast:
        return await this.inferTypeCastType(node as TypeCastNode);
        
      case NodeType.MembershipTest:
        return { type: 'Boolean', singleton: true };
        
      case NodeType.TypeOrIdentifier:
        return await this.inferTypeOrIdentifierType(node as TypeOrIdentifierNode, inputType);
        
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  private inferErrorNodeType(errorNode: ErrorNode, inputType?: TypeInfo): TypeInfo {
    // For error nodes, return a generic type that allows partial analysis to continue
    // This enables type checking for valid parts of broken expressions
    return { type: 'Any', singleton: false };
  }
  
  private inferLiteralType(node: LiteralNode): TypeInfo {
    switch (node.valueType) {
      case 'string':
        return { type: 'String', singleton: true };
      case 'number':
        const num = node.value as number;
        return { 
          type: Number.isInteger(num) ? 'Integer' : 'Decimal', 
          singleton: true 
        };
      case 'boolean':
        return { type: 'Boolean', singleton: true };
      case 'date':
        return { type: 'Date', singleton: true };
      case 'datetime':
        return { type: 'DateTime', singleton: true };
      case 'time':
        return { type: 'Time', singleton: true };
      case 'null':
        return { type: 'Any', singleton: false }; // Empty collection
      default:
        return { type: 'Any', singleton: true };
    }
  }
  
  private async inferBinaryType(node: BinaryNode, inputType?: TypeInfo): Promise<TypeInfo> {
    const operator = registry.getOperatorDefinition(node.operator);
    if (!operator) {
      return { type: 'Any', singleton: false };
    }
    
    // For navigation (dot operator), we need special handling
    if (node.operator === '.') {
      return await this.inferNavigationType(node, inputType);
    }
    
    // Infer types of operands
    const leftType = await this.inferType(node.left, inputType);
    const rightType = await this.inferType(node.right, inputType);
    
    // Find matching signature
    for (const sig of operator.signatures) {
      if (this.isTypeCompatible(leftType, sig.left) && 
          this.isTypeCompatible(rightType, sig.right)) {
        return this.resolveResultType(sig.result, inputType, leftType, rightType);
      }
    }
    
    // Default to first signature's result type
    const defaultResult = operator.signatures[0]?.result || { type: 'Any', singleton: false };
    return this.resolveResultType(defaultResult, inputType, leftType, rightType);
  }
  
  private async inferNavigationType(node: BinaryNode, inputType?: TypeInfo): Promise<TypeInfo> {
    const leftType = await this.inferType(node.left, inputType);
    
    // If the right side is a function, return the function's type
    if (node.right.type === NodeType.Function) {
      return await this.inferType(node.right, leftType);
    }
    
    // If we have a model provider and the right side is an identifier
    if (this.modelProvider && node.right.type === NodeType.Identifier) {
      const propertyName = (node.right as IdentifierNode).name;
      
      // Use getElementType to navigate the property
      const resultType = await this.modelProvider.getElementType(leftType, propertyName);
      if (resultType) {
        return resultType;
      }
      
      // If property not found and we have a concrete type from model provider, report error
      // Skip diagnostics for union types - they may have dynamic properties
      if (leftType.namespace && leftType.name && leftType.modelContext && 
          !(leftType.modelContext as any).isUnion) {
        // Use warning instead of error for unknown properties on FHIR types
        // FHIRPath returns empty for unknown properties, not an error
        this.diagnostics.push(
          toDiagnostic(
            Errors.unknownProperty(propertyName, `${leftType.namespace}.${leftType.name}`, node.right.range),
            DiagnosticSeverity.Warning
          )
        );
      }
    }
    
    // Default navigation behavior
    return { type: 'Any', singleton: false };
  }
  
  private inferUnaryType(node: UnaryNode): TypeInfo {
    const operator = registry.getOperatorDefinition(node.operator);
    if (!operator) {
      return { type: 'Any', singleton: false };
    }
    
    // Unary operators typically have one signature
    const signature = operator.signatures[0];
    if (signature && typeof signature.result === 'object') {
      return signature.result;
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private async inferFunctionType(node: FunctionNode, inputType?: TypeInfo): Promise<TypeInfo> {
    if (node.name.type !== NodeType.Identifier) {
      return { type: 'Any', singleton: false };
    }
    
    const funcName = (node.name as IdentifierNode).name;
    const func = registry.getFunction(funcName);
    
    if (!func) {
      return { type: 'Any', singleton: false };
    }
    
    // Use custom inference if provided
    if (func.inferResultType) {
      return await func.inferResultType(this, node, inputType);
    }
    
    // Special handling for descendants function
    // Returns Any type due to combinatorial explosion of possible types
    if (funcName === 'descendants') {
      return { type: 'Any', singleton: false };
    }
    
    // Special handling for functions with dynamic result types
    // Use first matching signature's result type
    const matchingSignature = func.signatures?.find(sig => 
      !sig.input || !inputType || this.isTypeCompatible(inputType, sig.input)
    ) || func.signatures?.[0];
    
    if (!matchingSignature) {
      return { type: 'Any', singleton: false };
    }
    
    if (matchingSignature.result === 'inputType') {
      // Functions like where() return the same type as input but always as collection
      return inputType ? { ...inputType, singleton: false } : { type: 'Any', singleton: false };
    } else if (matchingSignature.result === 'inputTypeSingleton') {
      // Functions like first(), last() return the same type as input but as singleton
      return inputType ? { ...inputType, singleton: true } : { type: 'Any', singleton: true };
    } else if (matchingSignature.result === 'parameterType' && node.arguments.length > 0) {
      // Functions like select() return the type of the first parameter expression as collection
      const paramType = await this.inferType(node.arguments[0]!, inputType);
      return { ...paramType, singleton: false };
    } else if (typeof matchingSignature.result === 'object') {
      return matchingSignature.result;
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private async inferIdentifierType(node: IdentifierNode, inputType?: TypeInfo): Promise<TypeInfo> {
    // First, try to navigate from input type (most common case)
    if (inputType && this.modelProvider) {
      const elementType = await this.modelProvider.getElementType(inputType, node.name);
      if (elementType) {
        return elementType;
      }
    }
    
    // Only check if it's a type name if it starts with uppercase (FHIR convention)
    // or if there's no input type context
    // Skip common FHIRPath keywords and function names that aren't types
    const fhirPathKeywords = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity', 'ofType'];
    if (this.modelProvider && (!inputType || /^[A-Z]/.test(node.name)) && !fhirPathKeywords.includes(node.name)) {
      // Try to get type from model provider
      const typeInfo = await this.modelProvider.getType(node.name);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private async inferTypeOrIdentifierType(node: TypeOrIdentifierNode, inputType?: TypeInfo): Promise<TypeInfo> {
    // TypeOrIdentifier can be either a type name or a property navigation
    
    // First, try navigation from input type (most common case)
    if (inputType && this.modelProvider) {
      const elementType = await this.modelProvider.getElementType(inputType, node.name);
      if (elementType) {
        return elementType;
      }
    }
    
    // Then check if it's a type name (only for uppercase names or no input context)
    // Skip common FHIRPath keywords and function names that aren't types
    const fhirPathKeywords = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity', 'ofType'];
    if (this.modelProvider && (!inputType || /^[A-Z]/.test(node.name)) && !fhirPathKeywords.includes(node.name)) {
      // Try to get type from model provider
      const typeInfo = await this.modelProvider.getType(node.name);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferVariableType(node: VariableNode): TypeInfo {
    // System variables - check temporary context
    if (node.name.startsWith('$')) {
      const systemType = this.systemVariableTypes.get(node.name);
      if (systemType) {
        return systemType;
      }
      return { type: 'Any', singleton: false };
    }
    
    // Special FHIRPath environment variables
    if (node.name === '%context' || node.name === '%resource' || node.name === '%rootResource') {
      return { type: 'Any', singleton: false }; // These return the original input
    }
    
    // User-defined variables - check with or without % prefix
    let varName = node.name;
    if (varName.startsWith('%')) {
      varName = varName.substring(1);
    }
    
    const userType = this.userVariableTypes.get(varName);
    if (userType) {
      return userType;
    }
    
    return { type: 'Any', singleton: true };
  }
  
  private async inferCollectionType(node: CollectionNode): Promise<TypeInfo> {
    if (node.elements.length === 0) {
      return { type: 'Any', singleton: false };
    }
    
    // Infer types of all elements
    const elementTypes = await Promise.all(node.elements.map(el => this.inferType(el)));
    
    // If all elements have the same type, use that
    const firstType = elementTypes[0];
    if (firstType) {
      const allSameType = elementTypes.every(t => 
        t.type === firstType.type && 
        t.namespace === firstType.namespace && 
        t.name === firstType.name
      );
      
      if (allSameType) {
        return { ...firstType, singleton: false };
      }
    }
    
    // Otherwise, it's a heterogeneous collection
    return { type: 'Any', singleton: false };
  }
  
  private async inferTypeCastType(node: TypeCastNode): Promise<TypeInfo> {
    const targetType = node.targetType;
    
    // If we have a model provider, try to get the type
    if (this.modelProvider) {
      const typeInfo = await this.modelProvider.getType(targetType);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    // Otherwise, check if it's a FHIRPath primitive type
    const fhirPathTypes = ['String', 'Boolean', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (fhirPathTypes.includes(targetType)) {
      return { type: targetType as TypeName, singleton: true };
    }
    
    return { type: 'Any', singleton: true };
  }
  
  private isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean {
    // Exact match
    if (source.type === target.type && source.singleton === target.singleton) {
      return true;
    }
    
    // Any is compatible with everything
    if (source.type === 'Any' || target.type === 'Any') {
      return true;
    }
    
    // Singleton can be promoted to collection
    if (source.singleton && !target.singleton && source.type === target.type) {
      return true;
    }
    
    // Type hierarchy compatibility
    if (this.isSubtypeOf(source.type, target.type)) {
      // Check singleton compatibility
      if (source.singleton === target.singleton || (source.singleton && !target.singleton)) {
        return true;
      }
    }
    
    // Numeric type compatibility
    if (this.isNumericType(source.type) && this.isNumericType(target.type)) {
      // Integer can be used where Decimal is expected
      if (source.type === 'Integer' && target.type === 'Decimal') {
        return source.singleton !== undefined && target.singleton !== undefined && 
               (source.singleton === target.singleton || (source.singleton && !target.singleton));
      }
    }
    
    return false;
  }
  
  private isSubtypeOf(source: TypeName, target: TypeName): boolean {
    // Basic subtyping rules
    if (source === target) return true;
    if (target === 'Any') return true;
    
    // Integer is a subtype of Decimal
    if (source === 'Integer' && target === 'Decimal') return true;
    
    // Model-specific subtyping would be checked via ModelProvider
    // For now, we don't have other subtyping rules
    return false;
  }
  
  private isNumericType(type: TypeName): boolean {
    return type === 'Integer' || type === 'Decimal' || type === 'Quantity';
  }
  
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
      return { type: Number.isInteger(value) ? 'Integer' : 'Decimal', singleton: true };
    } else if (typeof value === 'boolean') {
      return { type: 'Boolean', singleton: true };
    } else if (value instanceof Date) {
      return { type: 'DateTime', singleton: true };
    } else {
      return { type: 'Any', singleton: true };
    }
  }
  
  private resolveResultType(
    resultSpec: TypeInfo | 'inputType' | 'leftType' | 'rightType',
    inputType?: TypeInfo,
    leftType?: TypeInfo,
    rightType?: TypeInfo
  ): TypeInfo {
    if (typeof resultSpec !== 'string') {
      return resultSpec;
    }
    
    switch (resultSpec) {
      case 'inputType':
        return inputType || { type: 'Any', singleton: false };
      case 'leftType':
        // For union-like operators, result is always a collection
        return leftType ? { ...leftType, singleton: false } : { type: 'Any', singleton: false };
      case 'rightType':
        return rightType ? { ...rightType, singleton: false } : { type: 'Any', singleton: false };
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  private checkBinaryOperatorTypes(node: BinaryNode, operator: import('./types').OperatorDefinition): void {
    const leftType = node.left.typeInfo!;
    const rightType = node.right.typeInfo!;
    
    // Find if any signature matches
    let foundMatch = false;
    for (const sig of operator.signatures) {
      if (this.isTypeCompatible(leftType, sig.left) && 
          this.isTypeCompatible(rightType, sig.right)) {
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      const leftTypeStr = this.typeToString(leftType);
      const rightTypeStr = this.typeToString(rightType);
      this.diagnostics.push(
        toDiagnostic(Errors.operatorTypeMismatch(node.operator, leftTypeStr, rightTypeStr, node.range))
      );
    }
  }
  
  private checkFunctionArgumentTypes(node: FunctionNode, func: import('./types').FunctionDefinition): void {
    const params = func.signatures?.[0]?.parameters || [];
    
    for (let i = 0; i < Math.min(node.arguments.length, params.length); i++) {
      const arg = node.arguments[i]!;
      const param = params[i]!;
      
      if (arg.typeInfo && !param.expression) {
        // For non-expression parameters, check type compatibility
        if (!this.isTypeCompatible(arg.typeInfo, param.type)) {
          const argTypeStr = this.typeToString(arg.typeInfo);
          const paramTypeStr = this.typeToString(param.type);
          this.diagnostics.push(
            toDiagnostic(Errors.argumentTypeMismatch(i + 1, func.name, paramTypeStr, argTypeStr, arg.range))
          );
        }
      }
    }
  }
  
  private typeToString(type: TypeInfo): string {
    const singletonStr = type.singleton ? '' : '[]';
    if (type.namespace && type.name) {
      return `${type.namespace}.${type.name}${singletonStr}`;
    }
    return `${type.type}${singletonStr}`;
  }
  
  /**
   * Infer the expected type at a cursor position based on context
   */
  private inferExpectedTypeForCursor(cursorNode: AnyCursorNode, inputType?: TypeInfo): TypeInfo | undefined {
    const context = cursorNode.context;
    
    switch (context) {
      case CursorContext.Identifier:
        // After dot, expecting a member of the input type
        return inputType;
        
      case CursorContext.Type:
        // After is/as/ofType, expecting a type name
        return { type: 'System.String' as TypeName, singleton: true };
        
      case CursorContext.Argument:
        // In function argument, would need to look up function signature
        // For now, return Any
        return { type: 'Any' as TypeName, singleton: false };
        
      case CursorContext.Index:
        // In indexer, expecting Integer
        return { type: 'Integer' as TypeName, singleton: true };
        
      case CursorContext.Operator:
        // Between expressions, could be any operator
        // Return the input type as context
        return inputType;
        
      default:
        return undefined;
    }
  }

  /**
   * Annotate AST with type information
   */
  private async annotateAST(node: ASTNode, inputType?: TypeInfo): Promise<void> {
    // Check for cursor node in cursor mode
    if (this.cursorMode && isCursorNode(node)) {
      this.stoppedAtCursor = true;
      
      const cursorNode = node as AnyCursorNode;
      let functionCallContext;

      if (cursorNode.context === CursorContext.Argument) {
        const funcInfo = this.findFunctionForCursor(cursorNode);
        if (funcInfo) {
          functionCallContext = {
            definition: funcInfo.funcDef,
            argumentIndex: funcInfo.argIndex,
          };
        }
      }

      this.cursorContext = {
        cursorNode: cursorNode,
        typeBeforeCursor: inputType,
        expectedType: this.inferExpectedTypeForCursor(cursorNode, inputType),
        functionCall: functionCallContext,
      };
      // Still attach a type to the cursor node for consistency
      (node as any).typeInfo = inputType || { type: 'Any', singleton: false };
      return; // Short-circuit
    }
    
    // If we've already stopped at cursor, don't continue
    if (this.stoppedAtCursor) {
      return;
    }
    
    // Handle error nodes
    if (node.type === 'Error') {
      const errorNode = node as ErrorNode;
      // Infer a reasonable type for error nodes
      node.typeInfo = this.inferErrorNodeType(errorNode, inputType);
      // Add diagnostic for the error
      this.diagnostics.push({
        severity: errorNode.severity || DiagnosticSeverity.Error,
        message: errorNode.message,
        range: errorNode.range,
        code: errorNode.code?.toString() || 'FP5003',
        source: 'fhirpath'
      });
      return;
    }
    
    // Infer and attach type info
    node.typeInfo = await this.inferType(node, inputType);

    // Recursively annotate children
    switch (node.type) {
      case NodeType.Binary:
        const binaryNode = node as BinaryNode;
        await this.annotateAST(binaryNode.left, inputType);
        
        // If we stopped at cursor, don't continue
        if (this.stoppedAtCursor) {
          break;
        }
        
        // Check if right side is a cursor node - if so, set type from left
        if (this.cursorMode && isCursorNode(binaryNode.right)) {
          this.stoppedAtCursor = true;
          this.cursorContext = {
            cursorNode: binaryNode.right as AnyCursorNode,
            typeBeforeCursor: binaryNode.left.typeInfo || { type: 'Any', singleton: false },
            expectedType: this.inferExpectedTypeForCursor(binaryNode.right as AnyCursorNode, binaryNode.left.typeInfo)
          };
          // Still attach type to cursor node
          (binaryNode.right as any).typeInfo = binaryNode.left.typeInfo || { type: 'Any', singleton: false };
          break;
        }
        
        // For navigation, pass the left's type as input to the right
        if (binaryNode.operator === '.') {
          // Collect all variables defined in the left side chain
          const definedVarsWithTypes = this.collectDefinedVariablesWithTypes(binaryNode.left);
          
          if (definedVarsWithTypes.size > 0) {
            // Save current variable types
            const savedTypes = new Map<string, TypeInfo>();
            definedVarsWithTypes.forEach((type, varName) => {
              const currentType = this.userVariableTypes.get(varName);
              if (currentType) {
                savedTypes.set(varName, currentType);
              }
              this.userVariableTypes.set(varName, type);
            });
            
            // Annotate right side with new variables in scope
            await this.annotateAST(binaryNode.right, binaryNode.left.typeInfo);
            
            // Restore previous types
            definedVarsWithTypes.forEach((_, varName) => {
              const savedType = savedTypes.get(varName);
              if (savedType) {
                this.userVariableTypes.set(varName, savedType);
              } else {
                this.userVariableTypes.delete(varName);
              }
            });
          } else {
            // No defineVariable in chain, proceed normally
            await this.annotateAST(binaryNode.right, binaryNode.left.typeInfo);
          }
        } else {
          await this.annotateAST(binaryNode.right, inputType);
        }
        break;
        
      case NodeType.Unary:
        const unaryNode = node as UnaryNode;
        await this.annotateAST(unaryNode.operand, inputType);
        break;
        
      case NodeType.Function:
        const funcNode = node as FunctionNode;
        await this.annotateAST(funcNode.name, inputType);
        
        // Special handling for aggregate function arguments
        if (funcNode.name.type === NodeType.Identifier && 
            (funcNode.name as IdentifierNode).name === 'aggregate') {
          // Aggregate establishes both $this and $total
          if (funcNode.arguments.length >= 1) {
            const itemType = inputType ? { ...inputType, singleton: true } : { type: 'Any' as TypeName, singleton: true };
            
            this.systemVariableTypes.enterScope();
            this.systemVariableTypes.set('$this', itemType);
            
            if (funcNode.arguments.length >= 2) {
              await this.annotateAST(funcNode.arguments[1]!, inputType);
              const initType = funcNode.arguments[1]!.typeInfo;
              
              if (initType) {
                this.systemVariableTypes.set('$total', initType);
              } else {
                this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
              }
              
              await this.annotateAST(funcNode.arguments[0]!, inputType);
              
              for (const arg of funcNode.arguments.slice(2)) {
                await this.annotateAST(arg, inputType);
                if (this.stoppedAtCursor) break;
              }
            } else {
              this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
              await this.annotateAST(funcNode.arguments[0]!, inputType);
              
              const aggregatorType = funcNode.arguments[0]!.typeInfo;
              if (aggregatorType) {
                this.systemVariableTypes.set('$total', aggregatorType);
                await this.annotateAST(funcNode.arguments[0]!, inputType);
              }
            }
            
            this.systemVariableTypes.leaveScope();
          }
        } else {
          // Special handling for functions that pass their input as context to arguments
          const funcName = funcNode.name.type === NodeType.Identifier ? 
            (funcNode.name as IdentifierNode).name : null;
          
          if (funcName && ['where', 'select', 'all', 'exists'].includes(funcName)) {
            const elementType = inputType ? { ...inputType, singleton: true } : { type: 'Any' as TypeName, singleton: true };
            
            this.systemVariableTypes.enterScope();
            this.systemVariableTypes.set('$this', elementType);
            this.systemVariableTypes.set('$index', { type: 'Integer', singleton: true });
            
            for (const arg of funcNode.arguments) {
              await this.annotateAST(arg, inputType);
              if (this.stoppedAtCursor) break;
            }
            
            this.systemVariableTypes.leaveScope();
          } else {
            // Regular function argument annotation
            for (const arg of funcNode.arguments) {
              await this.annotateAST(arg, inputType);
              if (this.stoppedAtCursor) break;
            }
          }
        }
        break;
        
      case NodeType.Collection:
        const collNode = node as CollectionNode;
        for (const el of collNode.elements) {
          await this.annotateAST(el, inputType);
          if (this.stoppedAtCursor) break;
        }
        break;
        
      case NodeType.TypeCast:
        const castNode = node as TypeCastNode;
        await this.annotateAST(castNode.expression, inputType);
        break;
        
      case NodeType.MembershipTest:
        const memberNode = node as MembershipTestNode;
        await this.annotateAST(memberNode.expression, inputType);
        break;
        
      case NodeType.Index:
        const indexNode = node as IndexNode;
        await this.annotateAST(indexNode.expression, inputType);
        if (!this.stoppedAtCursor) {
          await this.annotateAST(indexNode.index, inputType);
        }
        break;
        
      case NodeType.TypeOrIdentifier:
        // TypeOrIdentifier doesn't have children to annotate
        break;
    }
  }

  private findFunctionForCursor(cursorNode: AnyCursorNode): { funcDef: import('./types').FunctionDefinition, argIndex: number } | undefined {
    let currentNode = (cursorNode as any).parent as ASTNode | undefined;
    while (currentNode) {
      if (currentNode.type === NodeType.Function) {
        const funcNode = currentNode as FunctionNode;
        if (funcNode.name.type === NodeType.Identifier) {
          const funcName = (funcNode.name as IdentifierNode).name;
          const funcDef = registry.getFunction(funcName);
          if (funcDef) {
            const argIndex = funcNode.arguments.findIndex(arg => arg === cursorNode);
            return { funcDef, argIndex: argIndex !== -1 ? argIndex : 0 };
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return undefined;
  }
}
