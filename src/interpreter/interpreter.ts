import type { 
  ASTNode, 
  LiteralNode, 
  IdentifierNode, 
  VariableNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  CollectionNode,
  IndexNode,
  UnionNode,
  MembershipTestNode,
  TypeCastNode,
  TypeReferenceNode,
  TypeOrIdentifierNode
} from '../parser/ast';
import { NodeType } from '../parser/ast';
import { TokenType } from '../lexer/token';
import type { Context, EvaluationResult } from './types';
import { EvaluationError, CollectionUtils } from './types';
import { ContextManager } from './context';
import { TypeSystem } from './types/type-system';
import { Registry } from '../registry';
import type { Interpreter as IInterpreter } from '../registry/types';

// Import registry to trigger operation registration
import '../registry';

// Type for node evaluator functions
type NodeEvaluator = (node: any, input: any[], context: Context) => EvaluationResult;

/**
 * FHIRPath Interpreter - evaluates AST nodes following the stream-processing model.
 * Every node is a processing unit: (input, context) → (output, new context)
 * 
 * This refactored version uses object lookup instead of switch statements.
 */
export class Interpreter implements IInterpreter {
  // Object lookup for node evaluators
  private readonly nodeEvaluators: Record<NodeType, NodeEvaluator> = {
    [NodeType.Literal]: this.evaluateLiteral.bind(this),
    [NodeType.Identifier]: this.evaluateIdentifier.bind(this),
    [NodeType.TypeOrIdentifier]: this.evaluateTypeOrIdentifier.bind(this),
    [NodeType.Variable]: this.evaluateVariable.bind(this),
    [NodeType.Binary]: this.evaluateBinary.bind(this),
    [NodeType.Unary]: this.evaluateUnary.bind(this),
    [NodeType.Function]: this.evaluateFunction.bind(this),
    [NodeType.Collection]: this.evaluateCollection.bind(this),
    [NodeType.Index]: this.evaluateIndex.bind(this),
    [NodeType.Union]: this.evaluateUnion.bind(this),
    [NodeType.MembershipTest]: this.evaluateMembershipTest.bind(this),
    [NodeType.TypeCast]: this.evaluateTypeCast.bind(this),
    [NodeType.TypeReference]: this.evaluateTypeReference.bind(this),
  };

  /**
   * Main evaluation method - uses object lookup instead of switch
   */
  evaluate(node: ASTNode, input: any[], context: Context): EvaluationResult {
    try {
      const evaluator = this.nodeEvaluators[node.type];
      
      if (!evaluator) {
        throw new EvaluationError(
          `Unknown node type: ${node.type}`,
          node.position
        );
      }
      
      return evaluator(node, input, context);
    } catch (error) {
      // Add position information if not already present
      if (error instanceof EvaluationError && !error.position && node.position) {
        error.position = node.position;
      }
      throw error;
    }
  }

  private evaluateLiteral(node: LiteralNode, input: any[], context: Context): EvaluationResult {
    // If literal has operation reference from parser
    if (node.operation && node.operation.kind === 'literal') {
      return node.operation.evaluate(this, context, input);
    }
    
    // Fallback for legacy literals
    const value = node.value === null ? [] : [node.value];
    return { value, context };
  }

  private evaluateIdentifier(node: IdentifierNode, input: any[], context: Context): EvaluationResult {
    // Identifier performs property navigation on each item in input
    const results: any[] = [];
    
    for (const item of input) {
      if (item == null || typeof item !== 'object') {
        // Primitives don't have properties - skip
        continue;
      }
      
      const value = item[node.name];
      if (value !== undefined) {
        // Add to results - flatten if array
        if (Array.isArray(value)) {
          results.push(...value);
        } else {
          results.push(value);
        }
      }
      // Missing properties return empty (not added to results)
    }
    
    return { value: results, context };
  }

  private evaluateTypeOrIdentifier(node: TypeOrIdentifierNode, input: any[], context: Context): EvaluationResult {
    // TypeOrIdentifier can act as either a type reference or property navigation
    // For now, treat it as an identifier
    return this.evaluateIdentifier(node as any, input, context);
  }

  private evaluateVariable(node: VariableNode, input: any[], context: Context): EvaluationResult {
    // Variables ignore input and return value from context
    let value: any[] = [];
    
    if (node.name.startsWith('$')) {
      // Special environment variables - use object lookup
      const envVarHandlers: Record<string, () => any[]> = {
        '$this': () => context.env.$this || [],
        '$index': () => context.env.$index !== undefined ? [context.env.$index] : [],
        '$total': () => context.env.$total || [],
      };
      
      const handler = envVarHandlers[node.name];
      if (!handler) {
        throw new EvaluationError(`Unknown special variable: ${node.name}`, node.position);
      }
      value = handler();
    } else {
      // User-defined variables (remove % prefix if present)
      const varName = node.name.startsWith('%') ? node.name.substring(1) : node.name;
      value = ContextManager.getVariable(context, varName) || [];
    }
    
    return { value, context };
  }

  private evaluateBinary(node: BinaryNode, input: any[], context: Context): EvaluationResult {
    // Special handling for dot operator - it's a pipeline
    if (node.operator === TokenType.DOT) {
      // Phase 1: Evaluate left with original input/context
      const leftResult = this.evaluate(node.left, input, context);
      
      // Phase 2: Evaluate right with left's output as input
      const rightResult = this.evaluate(node.right, leftResult.value, leftResult.context);
      
      return rightResult;
    }

    // Get operation from registry (binary operators are infix)
    const operation = node.operation || Registry.getByToken(node.operator, 'infix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError(`Unknown operator: ${node.operator}`, node.position);
    }
    
    // Evaluate operands
    const leftResult = this.evaluate(node.left, input, context);
    const rightResult = this.evaluate(node.right, input, leftResult.context);
    
    // Use operation's evaluate method
    return operation.evaluate(this, rightResult.context, input, leftResult.value, rightResult.value);
  }

  private evaluateUnary(node: UnaryNode, input: any[], context: Context): EvaluationResult {
    // Get operation from registry (unary operators are prefix)
    const operation = node.operation || Registry.getByToken(node.operator, 'prefix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError(`Unknown unary operator: ${node.operator}`, node.position);
    }
    
    // Evaluate operand
    const operandResult = this.evaluate(node.operand, input, context);
    
    // Use operation's evaluate method
    return operation.evaluate(this, operandResult.context, input, operandResult.value);
  }

  private evaluateFunction(node: FunctionNode, input: any[], context: Context): EvaluationResult {
    // Extract function name
    let funcName: string;
    if (node.name.type === NodeType.Identifier) {
      funcName = (node.name as IdentifierNode).name;
    } else {
      throw new EvaluationError('Complex function names not yet supported', node.position);
    }
    
    // Get function from registry
    const operation = Registry.get(funcName);
    if (!operation || operation.kind !== 'function') {
      throw new EvaluationError(`Unknown function: ${funcName}`, node.position);
    }
    
    // Check propagateEmptyInput flag
    if (operation.signature.propagatesEmpty && input.length === 0) {
      return { value: [], context };
    }
    
    // Evaluate arguments based on parameter definitions
    const evaluatedArgs: any[] = [];
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i];
      const param = operation.signature.parameters[i];
      
      if (param && param.kind === 'expression') {
        // Pass expression as-is, will be evaluated by the function
        evaluatedArgs.push(arg);
      } else {
        // Evaluate the argument to get its value
        const argResult = this.evaluate(arg, input, context);
        evaluatedArgs.push(argResult.value);
        context = argResult.context;
      }
    }
    
    // Use operation's evaluate method
    return operation.evaluate(this, context, input, ...evaluatedArgs);
  }

  private evaluateCollection(node: CollectionNode, input: any[], context: Context): EvaluationResult {
    // Evaluate each element and combine results
    const results: any[] = [];
    let currentContext = context;

    for (const element of node.elements) {
      const result = this.evaluate(element, input, currentContext);
      results.push(...result.value);
      currentContext = result.context;
    }

    return { value: results, context: currentContext };
  }

  private evaluateIndex(node: IndexNode, input: any[], context: Context): EvaluationResult {
    // Evaluate the expression being indexed
    const exprResult = this.evaluate(node.expression, input, context);
    
    // Evaluate the index expression
    const indexResult = this.evaluate(node.index, exprResult.value, exprResult.context);
    
    // Index must be a single integer
    if (indexResult.value.length === 0) {
      return { value: [], context: indexResult.context };
    }
    
    const index = CollectionUtils.toSingleton(indexResult.value);
    if (typeof index !== 'number' || !Number.isInteger(index)) {
      throw new EvaluationError('Index must be an integer', node.position);
    }
    
    // FHIRPath uses 0-based indexing
    if (index < 0 || index >= exprResult.value.length) {
      // Out of bounds returns empty
      return { value: [], context: indexResult.context };
    }
    
    return { value: [exprResult.value[index]], context: indexResult.context };
  }

  private evaluateUnion(node: UnionNode, input: any[], context: Context): EvaluationResult {
    // Union combines results from all operands
    const results: any[] = [];
    let currentContext = context;

    for (const operand of node.operands) {
      const result = this.evaluate(operand, input, currentContext);
      results.push(...result.value);
      // Thread context through operands
      currentContext = result.context;
    }

    return { value: results, context: currentContext };
  }

  private evaluateMembershipTest(node: MembershipTestNode, input: any[], context: Context): EvaluationResult {
    // Evaluate the expression to get values to test
    const exprResult = this.evaluate(node.expression, input, context);
    
    // For each value, check if it matches the type
    const results: boolean[] = [];
    for (const value of exprResult.value) {
      results.push(TypeSystem.isType(value, node.targetType));
    }
    
    // Return collection of booleans
    return { value: results, context: exprResult.context };
  }

  private evaluateTypeCast(node: TypeCastNode, input: any[], context: Context): EvaluationResult {
    // Evaluate the expression to get values to cast
    const exprResult = this.evaluate(node.expression, input, context);
    
    // For each value, attempt to cast to the target type
    const results: any[] = [];
    for (const value of exprResult.value) {
      // If already the correct type, keep it
      if (TypeSystem.isType(value, node.targetType)) {
        results.push(value);
      }
      // Otherwise, try to cast (returns null if fails)
      else {
        const castValue = TypeSystem.cast(value, node.targetType);
        if (castValue !== null) {
          results.push(castValue);
        }
        // Failed casts are filtered out (not added to results)
      }
    }
    
    // Return filtered collection
    return { value: results, context: exprResult.context };
  }

  private evaluateTypeReference(node: TypeReferenceNode, input: any[], context: Context): EvaluationResult {
    // Type references don't evaluate to values directly
    throw new EvaluationError(`Type reference cannot be evaluated: ${node.typeName}`, node.position);
  }
}

/**
 * Helper function to evaluate a FHIRPath expression
 */
export function evaluateFHIRPath(
  expression: string | ASTNode, 
  input: any, 
  context?: Context
): any[] {
  // Parse if string
  const ast = typeof expression === 'string' 
    ? require('../parser').parse(expression)
    : expression;

  // Convert input to collection
  const inputCollection = CollectionUtils.toCollection(input);

  // Create context if not provided and set initial $this
  let evalContext = context || ContextManager.create(inputCollection);
  
  // Set initial $this to the input collection if not already set
  if (!evalContext.env.$this) {
    evalContext = {
      ...evalContext,
      env: {
        ...evalContext.env,
        $this: inputCollection
      }
    };
  }

  // Create interpreter and evaluate
  const interpreter = new Interpreter();
  const result = interpreter.evaluate(ast, inputCollection, evalContext);

  return result.value;
}