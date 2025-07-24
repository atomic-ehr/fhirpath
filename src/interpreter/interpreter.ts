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
import { TypeSystem } from '../registry/utils/type-system';
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
      // Ensure $this is set in the context if not already present
      if (!context.env.$this) {
        context = {
          ...context,
          env: {
            ...context.env,
            $this: input
          }
        };
      }

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
    // Check if this identifier could be a resource type name
    // Resource types in FHIR typically start with uppercase
    if (node.name[0] === node?.name?.[0]?.toUpperCase()) {
      // Check if any input items have this as their resourceType
      const hasMatchingResourceType = input.some(item =>
        item && typeof item === 'object' && item.resourceType === node.name
      );

      if (hasMatchingResourceType) {
        // This is a type filter - return only items matching this resourceType
        const filtered = input.filter(item =>
          item && typeof item === 'object' && item.resourceType === node.name
        );
        return { value: filtered, context };
      }
    }

    // Regular property navigation
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

    // First, check if this is a known type name (e.g., Patient, Observation)
    // In FHIR context, type names match resourceType values
    const possibleTypeName = node.name;

    // Check if any input items have this as their resourceType
    const hasMatchingResourceType = input.some(item =>
      item && typeof item === 'object' && item.resourceType === possibleTypeName
    );

    if (hasMatchingResourceType) {
      // This is a type filter - return only items matching this resourceType
      const filtered = input.filter(item =>
        item && typeof item === 'object' && item.resourceType === possibleTypeName
      );
      return { value: filtered, context };
    }

    // Not a type filter, treat as property navigation
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

    // Handle case where parser incorrectly creates BinaryNode for unary minus
    if (!node.left && !node.right && (node as any).operand) {
      // This is actually a unary operation
      const unaryOp = Registry.getByToken(node.operator, 'prefix');
      if (unaryOp && unaryOp.kind === 'operator') {
        const operandResult = this.evaluate((node as any).operand, input, context);
        return unaryOp.evaluate(this, operandResult.context, input, operandResult.value);
      }
    }

    // Get operation from registry (binary operators are infix)
    const operation = node.operation || Registry.getByToken(node.operator, 'infix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError(`Unknown operator: ${node.operator}`, node.position);
    }

    if (!node.left || !node.right) {
      throw new EvaluationError(`Binary operator ${node.operator} missing operands`, node.position);
    }

    // Special handling for union operator - both sides should use the same context
    if (node.operator === TokenType.PIPE) {
      const leftResult = this.evaluate(node.left, input, context);
      const rightResult = this.evaluate(node.right, input, context); // Use original context, not leftResult.context

      // Use operation's evaluate method
      return operation.evaluate(this, context, input, leftResult.value, rightResult.value);
    }

    // Normal operators - context flows from left to right
    const leftResult = this.evaluate(node.left, input, context);
    const rightResult = this.evaluate(node.right, input, leftResult.context);

    // Use operation's evaluate method
    return operation.evaluate(this, rightResult.context, input, leftResult.value, rightResult.value);
  }

  private evaluateUnary(node: UnaryNode, input: any[], context: Context): EvaluationResult {
    // Get operation from registry (unary operators are prefix)
    // Don't use node.operation as parser might have assigned wrong operation
    const operation = Registry.getByToken(node.operator, 'prefix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError(`Unknown unary operator: ${node.operator}`, node.position);
    }

    // Evaluate operand
    const operandResult = this.evaluate(node.operand, input, context);

    // Use operation's evaluate method
    return operation.evaluate(this, operandResult.context, input, operandResult.value);
  }

  private evaluateFunction(node: FunctionNode, input: any[], context: Context): EvaluationResult {
    // Extract function name and handle method call syntax
    let funcName: string;
    let functionInput = input;

    if (node.name.type === NodeType.Identifier) {
      funcName = (node.name as IdentifierNode).name;
    } else if (node.name.type === NodeType.Binary && (node.name as BinaryNode).operator === TokenType.DOT) {
      // Method call syntax: expression.function(args)
      const binaryNode = node.name as BinaryNode;

      // Evaluate the left side to get the input
      const leftResult = this.evaluate(binaryNode.left, input, context);
      functionInput = leftResult.value;
      context = leftResult.context;

      // Get the function name from the right side
      if (binaryNode.right.type === NodeType.Identifier) {
        funcName = (binaryNode.right as IdentifierNode).name;
      } else {
        throw new EvaluationError('Invalid method call syntax', node.position);
      }
    } else {
      throw new EvaluationError('Complex function names not yet supported', node.position);
    }

    // Check for custom functions first
    if (context.customFunctions && funcName in context.customFunctions) {
      const customFunc = context.customFunctions[funcName];

      // Evaluate all arguments
      const evaluatedArgs: any[] = [];
      for (const arg of node.arguments) {
        const argResult = this.evaluate(arg, functionInput, context);
        evaluatedArgs.push(argResult.value);
        context = argResult.context;
      }

      // Call custom function
      const result = customFunc!(context, functionInput, ...evaluatedArgs);
      return { value: result, context };
    }

    // Get function from registry
    const operation = Registry.get(funcName);
    if (!operation || operation.kind !== 'function') {
      throw new EvaluationError(`Unknown function: ${funcName}`, node.position);
    }

    // Check propagateEmptyInput flag
    if (operation.signature.propagatesEmpty && functionInput.length === 0) {
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
        const argResult = this.evaluate(arg!, functionInput, context);
        evaluatedArgs.push(argResult.value);
        context = argResult.context;
      }
    }

    // Use operation's evaluate method
    return operation.evaluate(this, context, functionInput, ...evaluatedArgs);
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

    // Evaluate the index expression in the original context
    const indexResult = this.evaluate(node.index, input, context);

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
    // Each operand should be evaluated with the SAME original context
    // to prevent variable definitions from leaking between branches
    const results: any[] = [];
    const seen = new Set();

    for (const operand of node.operands) {
      // Always use the original context for each operand
      const result = this.evaluate(operand, input, context);

      // Remove duplicates
      for (const item of result.value) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(item);
        }
      }
    }

    // Return the original context, not a modified one
    return { value: results, context };
  }

  private evaluateMembershipTest(node: MembershipTestNode, input: any[], context: Context): EvaluationResult {
    // Evaluate the expression to get values to test
    const exprResult = this.evaluate(node.expression, input, context);

    // Empty collection: is returns empty
    if (exprResult.value.length === 0) {
      return { value: [], context: exprResult.context };
    }

    // Check if ALL values match the type
    for (const value of exprResult.value) {
      if (!TypeSystem.isType(value, node.targetType)) {
        return { value: [false], context: exprResult.context };
      }
    }

    // All values match the type
    return { value: [true], context: exprResult.context };
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
