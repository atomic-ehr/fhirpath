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
import type { CompiledNode } from './types';
import type { Context, EvaluationResult } from '../interpreter/types';
import { EvaluationError, CollectionUtils } from '../interpreter/types';
import { ContextManager } from '../interpreter/context';
// Operators are now in the registry
import { isTruthy } from '../registry/utils';
// Import the global registry to ensure all operations are registered
import '../registry';
import { Registry } from '../registry';

/**
 * FHIRPath to JavaScript Closure Compiler
 * 
 * Transforms FHIRPath AST nodes into JavaScript functions that implement
 * the same stream-processing semantics as the interpreter.
 */
export class Compiler {
  /**
   * Main entry point - compiles an AST into an executable function
   */
  compile(ast: ASTNode): CompiledNode {
    return this.compileNode(ast);
  }

  /**
   * Dispatches to specific compilation methods based on node type
   */
  private compileNode(node: ASTNode): CompiledNode {
    switch (node.type) {
      case NodeType.Literal:
        return this.compileLiteral(node as LiteralNode);
      case NodeType.Identifier:
        return this.compileIdentifier(node as IdentifierNode);
      case NodeType.TypeOrIdentifier:
        return this.compileTypeOrIdentifier(node as TypeOrIdentifierNode);
      case NodeType.Variable:
        return this.compileVariable(node as VariableNode);
      case NodeType.Binary:
        return this.compileBinary(node as BinaryNode);
      case NodeType.Unary:
        return this.compileUnary(node as UnaryNode);
      case NodeType.Function:
        return this.compileFunction(node as FunctionNode);
      case NodeType.Collection:
        return this.compileCollection(node as CollectionNode);
      case NodeType.Index:
        return this.compileIndex(node as IndexNode);
      case NodeType.Union:
        return this.compileUnion(node as UnionNode);
      case NodeType.MembershipTest:
        return this.compileMembershipTest(node as MembershipTestNode);
      case NodeType.TypeCast:
        return this.compileTypeCast(node as TypeCastNode);
      case NodeType.TypeReference:
        return this.compileTypeReference(node as TypeReferenceNode);
      default:
        throw new EvaluationError(
          `Unknown node type: ${(node as any).type}`,
          node.position
        );
    }
  }

  /**
   * Compiles a literal node - returns a constant value
   */
  private compileLiteral(node: LiteralNode): CompiledNode {
    const value = node.value;
    const position = node.position;
    
    // Return a closure that returns the literal value
    return (input: any[], context: Context): EvaluationResult => {
      try {
        return { 
          value: value === null ? [] : [value], 
          context 
        };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles an identifier node - performs property navigation
   */
  private compileIdentifier(node: IdentifierNode): CompiledNode {
    const name = node.name;
    const position = node.position;
    
    return (input: any[], context: Context): EvaluationResult => {
      try {
        const results: any[] = [];
        
        for (const item of input) {
          if (item == null || typeof item !== 'object') {
            continue;
          }
          
          const value = item[name];
          if (value !== undefined) {
            if (Array.isArray(value)) {
              results.push(...value);
            } else {
              results.push(value);
            }
          }
        }
        
        return { value: results, context };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles a TypeOrIdentifier node - for now, treat as identifier
   */
  private compileTypeOrIdentifier(node: TypeOrIdentifierNode): CompiledNode {
    return this.compileIdentifier(node as any);
  }

  /**
   * Compiles a variable node - looks up value from context
   */
  private compileVariable(node: VariableNode): CompiledNode {
    const name = node.name;
    const position = node.position;
    
    return (input: any[], context: Context): EvaluationResult => {
      try {
        let value: any[] = [];
        
        if (name.startsWith('$')) {
          // Special environment variables
          switch (name) {
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
              throw new EvaluationError(`Unknown special variable: ${name}`, position);
          }
        } else {
          // User-defined variables (remove % prefix if present)
          const varName = name.startsWith('%') ? name.substring(1) : name;
          value = ContextManager.getVariable(context, varName) || [];
        }
        
        return { value, context };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles a binary operator node
   */
  private compileBinary(node: BinaryNode): CompiledNode {
    const operator = node.operator;
    const position = node.position;
    
    // Special handling for dot operator - it's a pipeline
    if (operator === TokenType.DOT) {
      const left = this.compileNode(node.left);
      const right = this.compileNode(node.right);
      
      return (input: any[], context: Context): EvaluationResult => {
        try {
          const leftResult = left(input, context);
          return right(leftResult.value, leftResult.context);
        } catch (error) {
          if (error instanceof EvaluationError && !error.position) {
            error.position = position;
          }
          throw error;
        }
      };
    }
    
    // Compile left and right operands for other operators
    const left = this.compileNode(node.left);
    const right = this.compileNode(node.right);
    
    // For other operators, evaluate both sides and apply operator
    return (input: any[], context: Context): EvaluationResult => {
      try {
        const leftResult = left(input, context);
        const rightResult = right(input, leftResult.context);
        
        let value: any[];
        
        // Apply the operator based on type
        switch (operator) {
          // Arithmetic operators
          case TokenType.PLUS:
          case TokenType.MINUS:
          case TokenType.STAR:
          case TokenType.SLASH:
          case TokenType.DIV:
          case TokenType.MOD:
            value = Operators.arithmetic(operator, leftResult.value, rightResult.value);
            break;
            
          // Comparison operators
          case TokenType.EQ:
          case TokenType.NEQ:
          case TokenType.LT:
          case TokenType.GT:
          case TokenType.LTE:
          case TokenType.GTE:
            value = Operators.comparison(operator, leftResult.value, rightResult.value);
            break;
            
          // Logical operators
          case TokenType.AND:
          case TokenType.OR:
          case TokenType.XOR:
          case TokenType.IMPLIES:
            value = Operators.logical(operator, leftResult.value, rightResult.value);
            break;
            
          // Membership operators
          case TokenType.IN:
          case TokenType.CONTAINS:
            value = Operators.membership(operator, leftResult.value, rightResult.value);
            break;
            
          // String concatenation
          case TokenType.CONCAT:
            value = Operators.concat(leftResult.value, rightResult.value);
            break;
            
          default:
            throw new EvaluationError(`Binary operator not yet implemented: ${operator}`, position);
        }
        
        return { value, context: rightResult.context };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles a unary operator node
   */
  private compileUnary(node: UnaryNode): CompiledNode {
    const operator = node.operator;
    const position = node.position;
    const operand = this.compileNode(node.operand);
    
    return (input: any[], context: Context): EvaluationResult => {
      try {
        const operandResult = operand(input, context);
        let value: any[];
        
        switch (operator) {
          case TokenType.NOT:
            value = Operators.logical(TokenType.NOT, operandResult.value);
            break;
            
          case TokenType.PLUS:
            value = operandResult.value;
            break;
            
          case TokenType.MINUS:
            if (operandResult.value.length === 0) {
              value = [];
            } else {
              const num = CollectionUtils.toSingleton(operandResult.value);
              if (typeof num !== 'number') {
                throw new EvaluationError('Unary minus requires a number', position);
              }
              value = [-num];
            }
            break;
            
          default:
            throw new EvaluationError(`Unknown unary operator: ${operator}`, position);
        }
        
        return { value, context: operandResult.context };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles a function call node
   */
  private compileFunction(node: FunctionNode): CompiledNode {
    const position = node.position;
    
    // For now, handle only identifier function names
    if (node.name.type !== NodeType.Identifier) {
      throw new EvaluationError('Dynamic function names not yet supported', position);
    }
    
    const functionName = (node.name as IdentifierNode).name;
    
    // Check if function is registered
    const operation = Registry.get(functionName);
    if (!operation || operation.kind !== 'function') {
      throw new EvaluationError(`Unknown function: ${functionName}`, position);
    }
    
    // Compile arguments
    const compiledArgs = node.arguments.map(arg => this.compileNode(arg));
    
    // Special handling for where and select functions - compile them inline for performance
    if (functionName === 'where') {
      if (compiledArgs.length !== 1) {
        throw new EvaluationError('where() requires exactly one argument', position);
      }
      
      const predicate = compiledArgs[0]!; // We know it exists from the check above
      
      return (input: any[], context: Context): EvaluationResult => {
        try {
          const results: any[] = [];
          
          for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const iterContext = ContextManager.setIteratorContext(context, item, i);
            const predResult = predicate([item], iterContext);
            
            if (isTruthy(predResult.value)) {
              results.push(item);
            }
          }
          
          return { value: results, context };
        } catch (error) {
          if (error instanceof EvaluationError && !error.position) {
            error.position = position;
          }
          throw error;
        }
      };
    }
    
    if (functionName === 'select') {
      if (compiledArgs.length !== 1) {
        throw new EvaluationError('select() requires exactly one argument', position);
      }
      
      const expression = compiledArgs[0]!; // We know it exists from the check above
      
      return (input: any[], context: Context): EvaluationResult => {
        try {
          const results: any[] = [];
          
          for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const iterContext = ContextManager.setIteratorContext(context, item, i);
            const exprResult = expression([item], iterContext);
            results.push(...exprResult.value);
          }
          
          return { value: results, context };
        } catch (error) {
          if (error instanceof EvaluationError && !error.position) {
            error.position = position;
          }
          throw error;
        }
      };
    }
    
    // For other functions, use the interpreter's function evaluation for now
    // In future, we can compile more functions inline for better performance
    return (input: any[], context: Context): EvaluationResult => {
      try {
        // Create a temporary interpreter instance to evaluate the function
        const interpreter = new (require('../interpreter/interpreter').Interpreter)();
        // Evaluate the function using the interpreter
        return interpreter.evaluate(node, input, context);
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles a collection node
   */
  private compileCollection(node: CollectionNode): CompiledNode {
    const position = node.position;
    const compiledElements = node.elements.map(elem => this.compileNode(elem));
    
    return (input: any[], context: Context): EvaluationResult => {
      try {
        const results: any[] = [];
        let currentContext = context;
        
        for (const element of compiledElements) {
          const result = element(input, currentContext);
          results.push(...result.value);
          currentContext = result.context;
        }
        
        return { value: results, context: currentContext };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles an index node
   */
  private compileIndex(node: IndexNode): CompiledNode {
    const position = node.position;
    const expression = this.compileNode(node.expression);
    const index = this.compileNode(node.index);
    
    return (input: any[], context: Context): EvaluationResult => {
      try {
        const exprResult = expression(input, context);
        const indexResult = index(exprResult.value, exprResult.context);
        
        if (indexResult.value.length === 0) {
          return { value: [], context: indexResult.context };
        }
        
        const idx = CollectionUtils.toSingleton(indexResult.value);
        if (typeof idx !== 'number' || !Number.isInteger(idx)) {
          throw new EvaluationError('Index must be an integer', position);
        }
        
        if (idx < 0 || idx >= exprResult.value.length) {
          return { value: [], context: indexResult.context };
        }
        
        return { value: [exprResult.value[idx]], context: indexResult.context };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles a union node
   */
  private compileUnion(node: UnionNode): CompiledNode {
    const position = node.position;
    const compiledOperands = node.operands.map(op => this.compileNode(op));
    
    return (input: any[], context: Context): EvaluationResult => {
      try {
        const results: any[] = [];
        let currentContext = context;
        
        for (const operand of compiledOperands) {
          const result = operand(input, currentContext);
          results.push(...result.value);
          currentContext = result.context;
        }
        
        return { value: results, context: currentContext };
      } catch (error) {
        if (error instanceof EvaluationError && !error.position) {
          error.position = position;
        }
        throw error;
      }
    };
  }

  /**
   * Compiles membership test (is operator) - not implemented yet
   */
  private compileMembershipTest(node: MembershipTestNode): CompiledNode {
    throw new EvaluationError('Membership test not yet implemented in compiler', node.position);
  }

  /**
   * Compiles type cast (as operator) - not implemented yet
   */
  private compileTypeCast(node: TypeCastNode): CompiledNode {
    throw new EvaluationError('Type cast not yet implemented in compiler', node.position);
  }

  /**
   * Compiles type reference - should not be evaluated directly
   */
  private compileTypeReference(node: TypeReferenceNode): CompiledNode {
    throw new EvaluationError(`Type reference cannot be evaluated: ${node.typeName}`, node.position);
  }
}

/**
 * Helper function to compile a FHIRPath expression
 */
export function compile(expression: string | ASTNode): CompiledNode {
  // Parse if string
  const ast = typeof expression === 'string' 
    ? require('../parser').parse(expression)
    : expression;
    
  // Create compiler and compile
  const compiler = new Compiler();
  return compiler.compile(ast);
}

/**
 * Helper function to compile and evaluate a FHIRPath expression
 */
export function evaluateCompiled(
  expression: string | ASTNode, 
  input: any, 
  context?: Context
): any[] {
  // Compile the expression
  const compiled = compile(expression);
  
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
  
  // Execute the compiled function
  const result = compiled(inputCollection, evalContext);
  
  return result.value;
}