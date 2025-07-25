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
import type { EvaluationResult } from '../interpreter/types';
import { EvaluationError, CollectionUtils } from '../interpreter/types';
import { RuntimeContextManager } from '../runtime/context';
import { isTruthy, toSingleton } from '../registry/utils';
import type { Compiler as ICompiler, CompiledExpression, TypeRef } from '../registry/types';
import type { RuntimeContext } from '../runtime/context';
// Import the global registry to ensure all operations are registered
import '../registry';
import { Registry } from '../registry';

/**
 * FHIRPath to JavaScript Closure Compiler
 * 
 * Transforms FHIRPath AST nodes into JavaScript functions that implement
 * the same stream-processing semantics as the interpreter.
 */
export class Compiler implements ICompiler {
  /**
   * Main entry point - compiles an AST into an executable function
   */
  compile(node: ASTNode, input?: CompiledExpression): CompiledExpression {
    const compiled = this.compileNode(node);
    
    // Wrap the compiled function to ensure $this is set
    return {
      ...compiled,
      fn: (ctx: RuntimeContext) => {
        // Ensure $this is set if not already present
        if (!RuntimeContextManager.getVariable(ctx, '$this')) {
          ctx = RuntimeContextManager.setSpecialVariable(ctx, 'this', ctx.input);
        }
        return compiled.fn(ctx);
      }
    };
  }
  
  /**
   * Resolve a type name to a TypeRef
   */
  resolveType(typeName: string): TypeRef {
    // For now, return a simple type reference
    // In the future, this should use a model provider
    return { type: typeName } as TypeRef;
  }

  /**
   * Dispatches to specific compilation methods based on node type
   */
  private compileNode(node: ASTNode): CompiledExpression {
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
  private compileLiteral(node: LiteralNode): CompiledExpression {
    const value = node.value;
    
    // Check if literal is an operation reference
    if (typeof value === 'string') {
      const operation = Registry.get(value);
      if (operation && operation.kind === 'literal') {
        return operation.compile(this, { fn: () => [], type: this.resolveType('Any'), isSingleton: false }, []);
      }
    }
    
    // Return a compiled expression for the literal value
    return {
      fn: (ctx: RuntimeContext) => value === null ? [] : [value],
      type: this.resolveType(this.getLiteralType(value)),
      isSingleton: true,
      source: JSON.stringify(value)
    };
  }
  
  private getLiteralType(value: any): string {
    if (value === null || value === undefined) return 'Any';
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Integer' : 'Decimal';
    }
    return 'Any';
  }

  /**
   * Compiles an identifier node - performs property navigation
   */
  private compileIdentifier(node: IdentifierNode): CompiledExpression {
    const name = node.name;
    
    return {
      fn: (ctx: RuntimeContext) => {
        const input = ctx.focus || ctx.input || [];
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
        
        return results;
      },
      type: this.resolveType('Any'), // Would need type inference in a real implementation
      isSingleton: false,
      source: name
    };
  }

  /**
   * Compiles a TypeOrIdentifier node - handles both type filtering and property navigation
   */
  private compileTypeOrIdentifier(node: TypeOrIdentifierNode): CompiledExpression {
    const name = node.name;
    
    return {
      fn: (ctx: RuntimeContext) => {
        const input = ctx.focus || ctx.input || [];
        
        // First, check if this is a type filter (e.g., Patient in Patient.name)
        // Check if any input items have this as their resourceType
        const hasMatchingResourceType = input.some((item: any) => 
          item && typeof item === 'object' && item.resourceType === name
        );
        
        if (hasMatchingResourceType) {
          // This is a type filter - return only items matching this resourceType
          return input.filter((item: any) =>
            item && typeof item === 'object' && item.resourceType === name
          );
        }
        
        // Not a type filter, treat as property navigation
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
        
        return results;
      },
      type: this.resolveType('Any'),
      isSingleton: false,
      source: name
    };
  }

  /**
   * Compiles a variable node - looks up value from context
   */
  private compileVariable(node: VariableNode): CompiledExpression {
    const name = node.name;
    
    return {
      fn: (ctx: RuntimeContext) => {
        const value = RuntimeContextManager.getVariable(ctx, name);
        
        if (value === undefined) {
          // Special handling for unknown special variables
          if (name.startsWith('$') && !['$this', '$index', '$total'].includes(name)) {
            throw new EvaluationError(`Unknown special variable: ${name}`, node.position);
          }
          return [];
        }
        
        // Ensure we always return an array
        return Array.isArray(value) ? value : [value];
      },
      type: this.resolveType('Any'),
      isSingleton: false,
      source: name
    };
  }

  /**
   * Compiles a binary operator node
   */
  private compileBinary(node: BinaryNode): CompiledExpression {
    const operator = node.operator;
    
    // Handle case where parser incorrectly creates BinaryNode for unary minus
    if (!node.left && !node.right && (node as any).operand) {
      // This is actually a unary operation
      return this.compileUnary(node as any);
    }
    
    // Special handling for dot operator - it's a pipeline
    if (operator === TokenType.DOT) {
      const left = this.compileNode(node.left);
      const right = this.compileNode(node.right);
      
      return {
        fn: (ctx: RuntimeContext) => {
          // Execute left side with the original context
          const leftResult = left.fn(ctx);
          
          // Execute right side with left's result as input
          // Use withInput to maintain prototype chain
          const rightCtx = RuntimeContextManager.withInput(ctx, leftResult);
          return right.fn(rightCtx);
        },
        type: right.type,
        isSingleton: right.isSingleton,
        source: `${left.source || ''}.${right.source || ''}`
      };
    }
    
    // Get operation from registry
    const operation = node.operation || Registry.getByToken(operator, 'infix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError(`Unknown operator: ${operator}`, node.position);
    }
    
    // Compile operands
    const left = this.compileNode(node.left);
    const right = this.compileNode(node.right);
    
    // Use operation's compile method
    // For operators, pass both operands in args array
    return operation.compile(this, left, [left, right]);
  }

  /**
   * Compiles a unary operator node
   */
  private compileUnary(node: UnaryNode): CompiledExpression {
    const operator = node.operator;
    
    // Get operation from registry
    // Don't use node.operation as parser might have assigned wrong operation
    const operation = Registry.getByToken(operator, 'prefix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError(`Unknown unary operator: ${operator}`, node.position);
    }
    
    // Compile operand
    const operand = this.compileNode(node.operand);
    
    // Use operation's compile method
    // For unary operators, pass operand in args array
    return operation.compile(this, operand, [operand]);
  }

  /**
   * Compiles a function call node
   */
  private compileFunction(node: FunctionNode): CompiledExpression {
    // For now, handle only identifier function names
    if (node.name.type !== NodeType.Identifier) {
      throw new EvaluationError('Dynamic function names not yet supported', node.position);
    }
    
    const functionName = (node.name as IdentifierNode).name;
    
    // Check if function is registered
    const operation = Registry.get(functionName);
    if (!operation || operation.kind !== 'function') {
      throw new EvaluationError(`Unknown function: ${functionName}`, node.position);
    }
    
    // Compile arguments
    const compiledArgs = node.arguments.map(arg => this.compileNode(arg));
    
    // Use operation's compile method
    // For functions, the input is passed as the first compiled expression
    const inputExpr: CompiledExpression = {
      fn: (ctx) => ctx.focus || ctx.input || [],
      type: this.resolveType('Any'),
      isSingleton: false
    };
    
    return operation.compile(this, inputExpr, compiledArgs);
  }

  /**
   * Compiles a collection node
   */
  private compileCollection(node: CollectionNode): CompiledExpression {
    const compiledElements = node.elements.map(elem => this.compileNode(elem));
    
    return {
      fn: (ctx: RuntimeContext) => {
        const results: any[] = [];
        
        for (const element of compiledElements) {
          const elementResult = element.fn(ctx);
          results.push(...elementResult);
        }
        
        return results;
      },
      type: this.resolveType('Any'),
      isSingleton: false,
      source: `{${compiledElements.map(e => e.source || '').join(', ')}}`
    };
  }

  /**
   * Compiles an index node
   */
  private compileIndex(node: IndexNode): CompiledExpression {
    const expression = this.compileNode(node.expression);
    const index = this.compileNode(node.index);
    
    return {
      fn: (ctx: RuntimeContext) => {
        const exprResult = expression.fn(ctx);
        // Evaluate index in the original context
        const indexResult = index.fn(ctx);
        
        if (indexResult.length === 0) {
          return [];
        }
        
        const idx = toSingleton(indexResult);
        if (typeof idx !== 'number' || !Number.isInteger(idx)) {
          throw new EvaluationError('Index must be an integer', node.position);
        }
        
        if (idx < 0 || idx >= exprResult.length) {
          return [];
        }
        
        return [exprResult[idx]];
      },
      type: expression.type,
      isSingleton: true,
      source: `${expression.source || ''}[${index.source || ''}]`
    };
  }

  /**
   * Compiles a union node
   */
  private compileUnion(node: UnionNode): CompiledExpression {
    const compiledOperands = node.operands.map(op => this.compileNode(op));
    
    return {
      fn: (ctx: RuntimeContext) => {
        const results: any[] = [];
        const seen = new Set();
        
        for (const operand of compiledOperands) {
          // Create a fresh context copy for each operand
          // This prevents variable definitions from leaking between branches
          const operandCtx = RuntimeContextManager.copy(ctx);
          const operandResult = operand.fn(operandCtx);
          
          // Remove duplicates
          for (const item of operandResult) {
            const key = JSON.stringify(item);
            if (!seen.has(key)) {
              seen.add(key);
              results.push(item);
            }
          }
        }
        
        return results;
      },
      type: this.resolveType('Any'),
      isSingleton: false,
      source: compiledOperands.map(o => o.source || '').join(' | ')
    };
  }

  /**
   * Compiles membership test (is operator)
   */
  private compileMembershipTest(node: MembershipTestNode): CompiledExpression {
    // Get the 'is' operator from registry
    const operation = Registry.getByToken(TokenType.IS, 'infix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError('is operator not found in registry', node.position);
    }
    
    const expression = this.compileNode(node.expression);
    const typeExpr: CompiledExpression = {
      fn: () => [node.targetType],
      type: this.resolveType('String'),
      isSingleton: true,
      source: node.targetType
    };
    
    try {
      return operation.compile(this, expression, [expression, typeExpr]);
    } catch (error: any) {
      // If the error doesn't have position, add it from the node
      if (error instanceof EvaluationError && !error.position) {
        error.position = node.position;
      }
      throw error;
    }
  }

  /**
   * Compiles type cast (as operator)
   */
  private compileTypeCast(node: TypeCastNode): CompiledExpression {
    // Get the 'as' operator from registry
    const operation = Registry.getByToken(TokenType.AS, 'infix');
    if (!operation || operation.kind !== 'operator') {
      throw new EvaluationError('as operator not found in registry', node.position);
    }
    
    const expression = this.compileNode(node.expression);
    const typeExpr: CompiledExpression = {
      fn: () => [node.targetType],
      type: this.resolveType('String'),
      isSingleton: true,
      source: node.targetType
    };
    
    try {
      return operation.compile(this, expression, [typeExpr]);
    } catch (error: any) {
      // If the error doesn't have position, add it from the node
      if (error instanceof EvaluationError && !error.position) {
        error.position = node.position;
      }
      throw error;
    }
  }

  /**
   * Compiles type reference - should not be evaluated directly
   */
  private compileTypeReference(node: TypeReferenceNode): CompiledExpression {
    // Type references are used in ofType() and similar functions
    // They should compile to return the type name as a string
    const typeName = node.typeName;
    return {
      fn: (ctx: RuntimeContext) => [typeName],
      type: this.resolveType('String'),
      isSingleton: true,
      source: typeName
    };
  }
}

/**
 * Helper function to compile a FHIRPath expression
 */
export function compile(expression: string | ASTNode): CompiledExpression {
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
  context?: RuntimeContext
): any[] {
  // Compile the expression
  const compiled = compile(expression);
  
  // Convert input to collection
  const inputCollection = CollectionUtils.toCollection(input);
  
  // Create runtime context
  const runtimeContext: RuntimeContext = context || RuntimeContextManager.create(inputCollection);
  
  // Execute the compiled function
  return compiled.fn(runtimeContext);
}