import type {
  ASTNode,
  LiteralNode,
  IdentifierNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  VariableNode,
  CollectionNode,
  IndexNode,
  TypeOrIdentifierNode,
  MembershipTestNode,
  TypeCastNode
} from './parser';
import { NodeType } from './parser';
import { Registry } from './registry';
import * as operations from './operations';
import type { EvaluationResult, FunctionEvaluator, NodeEvaluator, OperationEvaluator, RuntimeContext } from './types';

/**
 * Runtime context manager that provides efficient prototype-based context operations
 * for both interpreter and compiler.
 */
export class RuntimeContextManager {
  /**
   * Create a new runtime context
   */
  static create(input: any[], initialVariables?: Record<string, any>): RuntimeContext {
    const context = Object.create(null) as RuntimeContext;
    
    context.input = input;
    context.focus = input;
    
    // Create variables object with null prototype to avoid pollution
    context.variables = Object.create(null);
    
    // Set root context variables with % prefix
    context.variables['%context'] = input;
    context.variables['%resource'] = input;
    context.variables['%rootResource'] = input;
    
    // Add any initial variables (with % prefix for user-defined)
    if (initialVariables) {
      for (const [key, value] of Object.entries(initialVariables)) {
        // Add % prefix if not already present and not a special variable
        const varKey = key.startsWith('$') || key.startsWith('%') ? key : `%${key}`;
        context.variables[varKey] = value;
      }
    }
    
    return context;
  }

  /**
   * Create a child context using prototype inheritance
   * O(1) operation - no copying needed
   */
  static copy(context: RuntimeContext): RuntimeContext {
    // Create child context with parent as prototype
    const newContext = Object.create(context) as RuntimeContext;
    
    // Create child variables that inherit from parent's variables
    newContext.variables = Object.create(context.variables);
    
    // input and focus are inherited through prototype chain
    // Only set them if they need to change
    
    return newContext;
  }

  /**
   * Create a new context with updated input/focus
   */
  static withInput(context: RuntimeContext, input: any[], focus?: any[]): RuntimeContext {
    const newContext = this.copy(context);
    newContext.input = input;
    newContext.focus = focus ?? input;
    return newContext;
  }

  /**
   * Set special variable ($this, $index, $total)
   */
  static setSpecialVariable(context: RuntimeContext, name: string, value: any): RuntimeContext {
    const newContext = this.copy(context);
    const varKey = `$${name}`;
    newContext.variables[varKey] = value;
    
    // Update input/focus for $this
    if (name === 'this' && Array.isArray(value) && value.length === 1) {
      newContext.input = value;
      newContext.focus = value;
    }
    
    return newContext;
  }

  /**
   * Set iterator context ($this, $index)
   */
  static withIterator(
    context: RuntimeContext, 
    item: any, 
    index: number
  ): RuntimeContext {
    let newContext = this.setSpecialVariable(context, 'this', [item]);
    newContext = this.setSpecialVariable(newContext, 'index', index);
    return newContext;
  }

  /**
   * Set a user-defined variable in the context
   */
  static setVariable(context: RuntimeContext, name: string, value: any[], allowRedefinition: boolean = false): RuntimeContext {
    // Check for system variables
    const systemVariables = ['context', 'resource', 'rootResource', 'ucum', 'sct', 'loinc'];
    if (systemVariables.includes(name)) {
      // Silently return original context for system variable redefinition
      return context;
    }
    
    // Add % prefix for user-defined variables
    const varKey = name.startsWith('%') ? name : `%${name}`;
    
    // Check if variable already exists (unless redefinition is allowed)
    if (!allowRedefinition && context.variables && Object.prototype.hasOwnProperty.call(context.variables, varKey)) {
      // Silently return original context for variable redefinition
      return context;
    }
    
    const newContext = this.copy(context);
    newContext.variables[varKey] = value;
    return newContext;
  }

  /**
   * Get a variable from context
   */
  static getVariable(context: RuntimeContext, name: string): any | undefined {
    // Handle special cases
    if (name === '$this' || name === '$index' || name === '$total') {
      return context.variables[name];
    }
    
    // Handle environment variables (with or without % prefix)
    if (name === 'context' || name === '%context') {
      return context.variables['%context'];
    }
    if (name === 'resource' || name === '%resource') {
      return context.variables['%resource'];
    }
    if (name === 'rootResource' || name === '%rootResource') {
      return context.variables['%rootResource'];
    }
    
    // Handle user-defined variables (add % prefix if not present)
    const varKey = name.startsWith('%') ? name : `%${name}`;
    return context.variables[varKey];
  }
}

export class Interpreter {
  private registry: Registry;
  private nodeEvaluators: Record<NodeType, NodeEvaluator>;
  private operationEvaluators: Map<string, OperationEvaluator>;
  private functionEvaluators: Map<string, FunctionEvaluator>;

  constructor(registry?: Registry) {
    this.registry = registry || new Registry();
    this.operationEvaluators = new Map();
    this.functionEvaluators = new Map();
    
    // Initialize node evaluators using object dispatch pattern
    this.nodeEvaluators = {
      [NodeType.Literal]: this.evaluateLiteral.bind(this),
      [NodeType.Identifier]: this.evaluateIdentifier.bind(this),
      [NodeType.TypeOrIdentifier]: this.evaluateTypeOrIdentifier.bind(this),
      [NodeType.Binary]: this.evaluateBinary.bind(this),
      [NodeType.Unary]: this.evaluateUnary.bind(this),
      [NodeType.Function]: this.evaluateFunction.bind(this),
      [NodeType.Variable]: this.evaluateVariable.bind(this),
      [NodeType.Collection]: this.evaluateCollection.bind(this),
      [NodeType.Index]: this.evaluateIndex.bind(this),
      [NodeType.MembershipTest]: this.evaluateMembershipTest.bind(this),
      [NodeType.TypeCast]: this.evaluateTypeCast.bind(this),
      [NodeType.EOF]: () => ({ value: [], context: {} as RuntimeContext }),
      [NodeType.TypeReference]: () => ({ value: [], context: {} as RuntimeContext })
    };

    // Register operation evaluators
    this.registerOperationEvaluators();
  }

  private registerOperationEvaluators(): void {
    // Register evaluators from operations modules
    for (const [name, operation] of Object.entries(operations)) {
      if (typeof operation === 'object' && 'evaluate' in operation) {
        if ('symbol' in operation) {
          // It's an operator
          // Skip unary operators here - they're handled differently
          if (name === 'unaryMinusOperator' || name === 'unaryPlusOperator') {
            continue;
          }
          this.operationEvaluators.set(operation.symbol, operation.evaluate);
        } else if ('signature' in operation && !('symbol' in operation)) {
          // It's a function
          this.functionEvaluators.set(operation.name, operation.evaluate);
        }
      }
    }
  }

  // Main evaluate method
  evaluate(node: ASTNode, input: any[] = [], context?: RuntimeContext): EvaluationResult {
    // Initialize context if not provided
    if (!context) {
      context = this.createInitialContext(input);
    }

    // Ensure input is always an array
    if (!Array.isArray(input)) {
      input = input === null || input === undefined ? [] : [input];
    }

    // Dispatch to appropriate evaluator
    const evaluator = this.nodeEvaluators[node.type];
    if (!evaluator) {
      throw new Error(`Unknown node type: ${node.type}`);
    }

    return evaluator(node, input, context);
  }

  private createInitialContext(input: any[]): RuntimeContext {
    const context = RuntimeContextManager.create(input);
    // Set $this to initial input
    context.variables['$this'] = input;
    return context;
  }

  // Literal node evaluator
  private evaluateLiteral(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const literal = node as LiteralNode;
    return {
      value: [literal.value],
      context
    };
  }

  // Identifier node evaluator
  private evaluateIdentifier(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const identifier = node as IdentifierNode;
    const name = identifier.name;

    // Navigate property on each item in input
    const results: any[] = [];
    for (const item of input) {
      if (item && typeof item === 'object' && name in item) {
        const value = item[name];
        if (Array.isArray(value)) {
          results.push(...value);
        } else if (value !== null && value !== undefined) {
          results.push(value);
        }
      }
    }

    return {
      value: results,
      context
    };
  }

  // TypeOrIdentifier node evaluator (handles Patient, Observation, etc.)
  private evaluateTypeOrIdentifier(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const typeOrId = node as TypeOrIdentifierNode;
    const name = typeOrId.name;

    // First try as type filter
    const filtered = input.filter(item => 
      item && typeof item === 'object' && item.resourceType === name
    );

    if (filtered.length > 0) {
      return { value: filtered, context };
    }

    // Otherwise treat as identifier
    return this.evaluateIdentifier(node, input, context);
  }

  // Binary operator evaluator
  private evaluateBinary(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const binary = node as BinaryNode;
    const operator = binary.operator;

    // Special handling for dot operator (sequential pipeline)
    if (operator === '.') {
      // Evaluate left with current input/context
      const leftResult = this.evaluate(binary.left, input, context);
      // Use left's output as right's input, and left's context flows to right
      return this.evaluate(binary.right, leftResult.value, leftResult.context);
    }

    // Special handling for union operator (each side gets fresh context from original)
    if (operator === '|') {
      // Each side of union should have its own variable scope
      // Variables defined on left side should not be visible on right side
      const leftResult = this.evaluate(binary.left, input, context);
      const rightResult = this.evaluate(binary.right, input, context); // Use original context, not leftResult.context
      
      // Merge the results
      const unionEvaluator = this.operationEvaluators.get('union');
      if (unionEvaluator) {
        return unionEvaluator(input, context, leftResult.value, rightResult.value);
      }
      
      // Fallback if union evaluator not found
      return {
        value: [...leftResult.value, ...rightResult.value],
        context  // Original context preserved
      };
    }

    // Get operation evaluator
    const evaluator = this.operationEvaluators.get(operator);
    if (evaluator) {
      // Most operators evaluate arguments in parallel with same input/context
      const leftResult = this.evaluate(binary.left, input, context);
      const rightResult = this.evaluate(binary.right, input, context);
      return evaluator(input, context, leftResult.value, rightResult.value);
    }

    // If no evaluator found, throw error
    throw new Error(`No evaluator found for binary operator: ${operator}`);
  }

  // Unary operator evaluator
  private evaluateUnary(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const unary = node as UnaryNode;
    const operator = unary.operator;
    
    const operandResult = this.evaluate(unary.operand, input, context);

    // Check for unary operation evaluators
    let evaluator: OperationEvaluator | undefined;
    if (operator === '-' && operations.unaryMinusOperator?.evaluate) {
      evaluator = operations.unaryMinusOperator.evaluate;
    } else if (operator === '+' && operations.unaryPlusOperator?.evaluate) {
      evaluator = operations.unaryPlusOperator.evaluate;
    }

    if (evaluator) {
      return evaluator(input, context, operandResult.value);
    }

    // If no evaluator found, throw error
    throw new Error(`No evaluator found for unary operator: ${operator}`);
  }

  // Variable evaluator
  private evaluateVariable(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const variable = node as VariableNode;
    const name = variable.name;

    const value = RuntimeContextManager.getVariable(context, name);
    
    if (value !== undefined) {
      // Ensure value is always an array
      const arrayValue = Array.isArray(value) ? value : [value];
      return { value: arrayValue, context };
    }

    // According to FHIRPath spec: attempting to access an undefined environment variable will result in an error
    throw new Error(`Variable '${name}' is not defined in the current scope`);
  }

  // Collection evaluator
  private evaluateCollection(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const collection = node as CollectionNode;
    const results: any[] = [];

    for (const element of collection.elements) {
      const result = this.evaluate(element, input, context);
      results.push(...result.value);
    }

    return { value: results, context };
  }

  // Function evaluator
  private evaluateFunction(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const func = node as FunctionNode;
    const funcName = (func.name as IdentifierNode).name;

    // Check if function is registered with an evaluator
    const functionEvaluator = this.functionEvaluators.get(funcName);
    if (functionEvaluator) {
      return functionEvaluator(input, context, func.arguments, this.evaluate.bind(this));
    }

    // No function found in registry
    throw new Error(`Unknown function: ${funcName}`);
  }

  // Index evaluator
  private evaluateIndex(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const indexNode = node as IndexNode;
    const exprResult = this.evaluate(indexNode.expression, input, context);
    const indexResult = this.evaluate(indexNode.index, input, context);

    if (indexResult.value.length === 0 || exprResult.value.length === 0) {
      return { value: [], context };
    }

    const index = indexResult.value[0];
    if (typeof index === 'number' && index >= 0 && index < exprResult.value.length) {
      return { value: [exprResult.value[index]], context };
    }

    return { value: [], context };
  }

  // Type membership test (is operator)
  private evaluateMembershipTest(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const test = node as MembershipTestNode;
    const exprResult = this.evaluate(test.expression, input, context);
    
    // Simple type checking
    const results = exprResult.value.map(item => {
      switch (test.targetType) {
        case 'String': return typeof item === 'string';
        case 'Boolean': return typeof item === 'boolean';
        case 'Integer': return Number.isInteger(item);
        case 'Decimal': return typeof item === 'number';
        default: return false;
      }
    });

    return { value: results, context };
  }

  // Type cast (as operator)
  private evaluateTypeCast(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const cast = node as TypeCastNode;
    const exprResult = this.evaluate(cast.expression, input, context);
    
    // For now, just return the values as-is
    // In a real implementation, would perform type conversion
    return { value: exprResult.value, context };
  }


}