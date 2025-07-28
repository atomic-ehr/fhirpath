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

// Runtime context for variable management
export interface RuntimeContext {
  variables: Map<string, any[]>;
  input: any[];  // The original input to the FHIRPath expression
  resource?: any;  // Current resource context
  rootResource?: any;  // Root resource for nested contexts
}

// Evaluation result - everything is a collection
export interface EvaluationResult {
  value: any[];
  context: RuntimeContext;
}

// Node evaluator function type
export type NodeEvaluator = (node: ASTNode, input: any[], context: RuntimeContext) => EvaluationResult;

// Operation evaluator function type  
export type OperationEvaluator = (input: any[], context: RuntimeContext, ...args: any[]) => EvaluationResult;

export class Interpreter {
  private registry: Registry;
  private nodeEvaluators: Record<NodeType, NodeEvaluator>;
  private operationEvaluators: Map<string, OperationEvaluator>;

  constructor(registry?: Registry) {
    this.registry = registry || new Registry();
    this.operationEvaluators = new Map();
    
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
        this.operationEvaluators.set(operation.symbol || operation.name, operation.evaluate);
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
    const variables = new Map<string, any[]>();
    variables.set('$this', input);
    
    return {
      variables,
      input,
      resource: input.length > 0 ? input[0] : undefined,
      rootResource: input.length > 0 ? input[0] : undefined
    };
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

    // Special handling for union operator (preserves original context)
    if (operator === '|') {
      const leftResult = this.evaluate(binary.left, input, context);
      const rightResult = this.evaluate(binary.right, input, context);
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

    // For other operators, check if we need sequential evaluation
    // Some operators may need to pass context from left to right
    const leftResult = this.evaluate(binary.left, input, context);
    
    // For operators that might modify context, use the left's context
    const rightContext = leftResult.context.variables.size > context.variables.size ? leftResult.context : context;
    const rightResult = this.evaluate(binary.right, input, rightContext);

    // Basic implementations for common operators
    switch (operator) {
      case '+':
        return this.evaluatePlus(leftResult.value, rightResult.value, context);
      case '-':
        return this.evaluateMinus(leftResult.value, rightResult.value, context);
      case '*':
        return this.evaluateMultiply(leftResult.value, rightResult.value, context);
      case '/':
        return this.evaluateDivide(leftResult.value, rightResult.value, context);
      case '=':
        return this.evaluateEqual(leftResult.value, rightResult.value, context);
      case '!=':
        return this.evaluateNotEqual(leftResult.value, rightResult.value, context);
      case '<':
        return this.evaluateLessThan(leftResult.value, rightResult.value, context);
      case '>':
        return this.evaluateGreaterThan(leftResult.value, rightResult.value, context);
      case '<=':
        return this.evaluateLessOrEqual(leftResult.value, rightResult.value, context);
      case '>=':
        return this.evaluateGreaterOrEqual(leftResult.value, rightResult.value, context);
      case 'and':
        return this.evaluateAnd(leftResult.value, rightResult.value, context);
      case 'or':
        return this.evaluateOr(leftResult.value, rightResult.value, context);
      default:
        throw new Error(`Unknown binary operator: ${operator}`);
    }
  }

  // Unary operator evaluator
  private evaluateUnary(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const unary = node as UnaryNode;
    const operator = unary.operator;
    
    const operandResult = this.evaluate(unary.operand, input, context);

    switch (operator) {
      case '-':
        return {
          value: operandResult.value.map(v => -v),
          context
        };
      case '+':
        return {
          value: operandResult.value,
          context
        };
      case 'not':
        return this.evaluateNot(operandResult.value, context);
      default:
        throw new Error(`Unknown unary operator: ${operator}`);
    }
  }

  // Variable evaluator
  private evaluateVariable(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const variable = node as VariableNode;
    const name = variable.name;

    // Check if variable exists in context
    if (context.variables.has(name)) {
      return {
        value: context.variables.get(name)!,
        context
      };
    }

    // Special variables
    if (name === '%context') {
      return { value: context.input, context };
    }
    if (name === '%resource') {
      return { value: context.resource ? [context.resource] : [], context };
    }
    if (name === '%rootResource') {
      return { value: context.rootResource ? [context.rootResource] : [], context };
    }

    // Unknown variable returns empty
    return { value: [], context };
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

    // Handle common functions
    switch (funcName) {
      case 'where':
        return this.evaluateWhere(func, input, context);
      case 'select':
        return this.evaluateSelect(func, input, context);
      case 'first':
        return { value: input.length > 0 ? [input[0]] : [], context };
      case 'last':
        return { value: input.length > 0 ? [input[input.length - 1]] : [], context };
      case 'count':
        return { value: [input.length], context };
      case 'exists':
        if (func.arguments.length === 0) {
          return { value: [input.length > 0], context };
        }
        return this.evaluateExists(func, input, context);
      case 'empty':
        return { value: [input.length === 0], context };
      case 'distinct':
        return { value: [...new Set(input)], context };
      case 'iif':
        return this.evaluateIif(func, input, context);
      case 'defineVariable':
        return this.evaluateDefineVariable(func, input, context);
      default:
        throw new Error(`Unknown function: ${funcName}`);
    }
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

  // Iterator function: where
  private evaluateWhere(func: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
    if (func.arguments.length === 0) {
      return { value: input, context };
    }

    const condition = func.arguments[0];
    const results: any[] = [];

    // Process each item with modified context
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      
      // Create temporary context with $this and $index
      const tempContext = {
        ...context,
        variables: new Map(context.variables)
      };
      tempContext.variables.set('$this', [item]);
      tempContext.variables.set('$index', [i]);
      tempContext.variables.set('$total', [input.length]);

      // Evaluate condition with temporary context
      const condResult = this.evaluate(condition!, [item], tempContext);
      
      // Include item if condition is true
      if (condResult.value.length > 0 && condResult.value[0] === true) {
        results.push(item);
      }
    }

    return { value: results, context };  // Original context restored
  }

  // Iterator function: select
  private evaluateSelect(func: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
    if (func.arguments.length === 0) {
      return { value: input, context };
    }

    const expression = func.arguments[0]!;
    const results: any[] = [];

    // Process each item with modified context
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      
      // Create temporary context with $this and $index
      const tempContext = {
        ...context,
        variables: new Map(context.variables)
      };
      tempContext.variables.set('$this', [item]);
      tempContext.variables.set('$index', [i]);
      tempContext.variables.set('$total', [input.length]);

      // Evaluate expression with temporary context
      const exprResult = this.evaluate(expression, [item], tempContext);
      results.push(...exprResult.value);
    }

    return { value: results, context };  // Original context restored
  }

  // Iterator function: exists
  private evaluateExists(func: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
    const condition = func.arguments[0]!;

    // Process each item with modified context
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      
      // Create temporary context with $this and $index
      const tempContext = {
        ...context,
        variables: new Map(context.variables)
      };
      tempContext.variables.set('$this', [item]);
      tempContext.variables.set('$index', [i]);
      tempContext.variables.set('$total', [input.length]);

      // Evaluate condition with temporary context
      const condResult = this.evaluate(condition, [item], tempContext);
      
      // Return true if any item matches
      if (condResult.value.length > 0 && condResult.value[0] === true) {
        return { value: [true], context };
      }
    }

    return { value: [false], context };
  }

  // Control flow: iif
  private evaluateIif(func: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
    if (func.arguments.length < 3) {
      throw new Error('iif requires 3 arguments');
    }

    // Always evaluate condition
    const condResult = this.evaluate(func.arguments[0]!, input, context);
    
    if (condResult.value.length === 0) {
      // Empty condition - return empty
      return { value: [], context };
    }

    const condition = condResult.value[0];
    
    // Evaluate only the needed branch
    if (condition === true) {
      return this.evaluate(func.arguments[1]!, input, context);
    } else {
      return this.evaluate(func.arguments[2]!, input, context);
    }
  }

  // Context modifier: defineVariable
  private evaluateDefineVariable(func: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
    if (func.arguments.length < 2) {
      throw new Error('defineVariable requires 2 arguments');
    }

    const nameNode = func.arguments[0]! as LiteralNode;
    if (nameNode.valueType !== 'string') {
      throw new Error('Variable name must be a string');
    }

    const varName = nameNode.value as string;
    if (!varName.startsWith('%')) {
      throw new Error('Variable name must start with %');
    }

    // Check if variable already exists - return empty if it does
    if (context.variables.has(varName)) {
      return { value: [], context };
    }

    // Evaluate the value expression with $this set to input
    const tempContext = {
      ...context,
      variables: new Map(context.variables)
    };
    tempContext.variables.set('$this', input);
    
    const valueResult = this.evaluate(func.arguments[1]!, input, tempContext);

    // Create new context with added variable
    const newContext = {
      ...context,
      variables: new Map(context.variables)
    };
    newContext.variables.set(varName, valueResult.value);

    // Pass through input unchanged
    return { value: input, context: newContext };
  }

  // Basic operator implementations
  private evaluatePlus(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    
    const l = left[0];
    const r = right[0];
    
    if (typeof l === 'string' || typeof r === 'string') {
      return { value: [String(l) + String(r)], context };
    }
    
    if (typeof l === 'number' && typeof r === 'number') {
      return { value: [l + r], context };
    }
    
    // For other types, convert to string
    return { value: [String(l) + String(r)], context };
  }

  private evaluateMinus(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] - right[0]], context };
  }

  private evaluateMultiply(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] * right[0]], context };
  }

  private evaluateDivide(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    if (right[0] === 0) {
      return { value: [], context };
    }
    return { value: [left[0] / right[0]], context };
  }

  private evaluateEqual(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] === right[0]], context };
  }

  private evaluateNotEqual(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] !== right[0]], context };
  }

  private evaluateLessThan(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] < right[0]], context };
  }

  private evaluateGreaterThan(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] > right[0]], context };
  }

  private evaluateLessOrEqual(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] <= right[0]], context };
  }

  private evaluateGreaterOrEqual(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [left[0] >= right[0]], context };
  }

  private evaluateAnd(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    // Three-valued logic
    if (left.length === 0 || right.length === 0) {
      if (left.length > 0 && left[0] === false) {
        return { value: [false], context };
      }
      if (right.length > 0 && right[0] === false) {
        return { value: [false], context };
      }
      return { value: [], context };  // Unknown
    }
    return { value: [left[0] && right[0]], context };
  }

  private evaluateOr(left: any[], right: any[], context: RuntimeContext): EvaluationResult {
    // Three-valued logic
    if (left.length === 0 || right.length === 0) {
      if (left.length > 0 && left[0] === true) {
        return { value: [true], context };
      }
      if (right.length > 0 && right[0] === true) {
        return { value: [true], context };
      }
      return { value: [], context };  // Unknown
    }
    return { value: [left[0] || right[0]], context };
  }

  private evaluateNot(operand: any[], context: RuntimeContext): EvaluationResult {
    if (operand.length === 0) {
      return { value: [], context };  // not({}) = {}
    }
    return { value: [!operand[0]], context };
  }
}