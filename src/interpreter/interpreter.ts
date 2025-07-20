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
import { Operators } from './operators';
import { FunctionRegistry } from './functions';

/**
 * FHIRPath Interpreter - evaluates AST nodes following the stream-processing model.
 * Every node is a processing unit: (input, context) → (output, new context)
 */
export class Interpreter {
  /**
   * Main evaluation method - dispatches to specific node handlers
   */
  evaluate(node: ASTNode, input: any[], context: Context): EvaluationResult {
    try {
      switch (node.type) {
        case NodeType.Literal:
          return this.evaluateLiteral(node as LiteralNode, input, context);
        
        case NodeType.Identifier:
          return this.evaluateIdentifier(node as IdentifierNode, input, context);
        
        case NodeType.TypeOrIdentifier:
          return this.evaluateTypeOrIdentifier(node as TypeOrIdentifierNode, input, context);
        
        case NodeType.Variable:
          return this.evaluateVariable(node as VariableNode, input, context);
        
        case NodeType.Binary:
          return this.evaluateBinary(node as BinaryNode, input, context);
        
        case NodeType.Unary:
          return this.evaluateUnary(node as UnaryNode, input, context);
        
        case NodeType.Function:
          return this.evaluateFunction(node as FunctionNode, input, context);
        
        case NodeType.Collection:
          return this.evaluateCollection(node as CollectionNode, input, context);
        
        case NodeType.Index:
          return this.evaluateIndex(node as IndexNode, input, context);
        
        case NodeType.Union:
          return this.evaluateUnion(node as UnionNode, input, context);
        
        case NodeType.MembershipTest:
          return this.evaluateMembershipTest(node as MembershipTestNode, input, context);
        
        case NodeType.TypeCast:
          return this.evaluateTypeCast(node as TypeCastNode, input, context);
        
        case NodeType.TypeReference:
          return this.evaluateTypeReference(node as TypeReferenceNode, input, context);
        
        default:
          throw new EvaluationError(
            `Unknown node type: ${(node as any).type}`,
            node.position
          );
      }
    } catch (error) {
      // Add position information if not already present
      if (error instanceof EvaluationError && !error.position && node.position) {
        error.position = node.position;
      }
      throw error;
    }
  }

  // Phase 2 implementations will go here
  private evaluateLiteral(node: LiteralNode, input: any[], context: Context): EvaluationResult {
    // Literals ignore input and return their value as a collection
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
      // Special environment variables
      switch (node.name) {
        case '$this':
          value = context.env.$this || [];
          break;
        case '$index':
          value = context.env.$index !== undefined ? [context.env.$index] : [];
          break;
        case '$total':
          value = context.env.$total || [];
          break;
        default:
          throw new EvaluationError(`Unknown special variable: ${node.name}`, node.position);
      }
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

    // For other operators, evaluate left first, then right with threaded context
    // This ensures variables defined on the left are available on the right
    const leftResult = this.evaluate(node.left, input, context);
    const rightResult = this.evaluate(node.right, input, leftResult.context);

    let value: any[];
    
    // Arithmetic operators
    if ([TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH, 
         TokenType.DIV, TokenType.MOD].includes(node.operator)) {
      value = Operators.arithmetic(node.operator, leftResult.value, rightResult.value);
    }
    // Comparison operators
    else if ([TokenType.EQ, TokenType.NEQ, TokenType.LT, TokenType.GT,
              TokenType.LTE, TokenType.GTE].includes(node.operator)) {
      value = Operators.comparison(node.operator, leftResult.value, rightResult.value);
    }
    // Logical operators
    else if ([TokenType.AND, TokenType.OR, TokenType.XOR, TokenType.IMPLIES].includes(node.operator)) {
      value = Operators.logical(node.operator, leftResult.value, rightResult.value);
    }
    // TODO: Other operators (union, contains, in, etc.)
    else {
      throw new EvaluationError(`Binary operator not yet implemented: ${node.operator}`, node.position);
    }

    // Return result with threaded context
    return { value, context: rightResult.context };
  }

  private evaluateUnary(node: UnaryNode, input: any[], context: Context): EvaluationResult {
    // Evaluate operand
    const operandResult = this.evaluate(node.operand, input, context);

    let value: any[];
    
    switch (node.operator) {
      case TokenType.NOT:
        value = Operators.logical(TokenType.NOT, operandResult.value);
        break;
        
      case TokenType.PLUS:
        // Unary plus - just return the value
        value = operandResult.value;
        break;
        
      case TokenType.MINUS:
        // Unary minus - negate numbers
        if (operandResult.value.length === 0) {
          value = [];
        } else {
          const num = CollectionUtils.toSingleton(operandResult.value);
          if (typeof num !== 'number') {
            throw new EvaluationError('Unary minus requires a number', node.position);
          }
          value = [-num];
        }
        break;
        
      default:
        throw new EvaluationError(`Unknown unary operator: ${node.operator}`, node.position);
    }

    return { value, context: operandResult.context };
  }

  private evaluateFunction(node: FunctionNode, input: any[], context: Context): EvaluationResult {
    return FunctionRegistry.evaluate(this, node, input, context);
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
    // TODO: Implement indexing
    throw new EvaluationError('Index operation not yet implemented', node.position);
  }

  private evaluateUnion(node: UnionNode, input: any[], context: Context): EvaluationResult {
    // Union combines results from all operands
    // Each operand is evaluated with the same input and context
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
    // TODO: Implement 'is' operator
    throw new EvaluationError('Membership test (is) not yet implemented', node.position);
  }

  private evaluateTypeCast(node: TypeCastNode, input: any[], context: Context): EvaluationResult {
    // TODO: Implement 'as' operator
    throw new EvaluationError('Type cast (as) not yet implemented', node.position);
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

  // Create context if not provided
  const evalContext = context || ContextManager.create(CollectionUtils.toCollection(input));

  // Create interpreter and evaluate
  const interpreter = new Interpreter();
  const result = interpreter.evaluate(ast, CollectionUtils.toCollection(input), evalContext);

  return result.value;
}