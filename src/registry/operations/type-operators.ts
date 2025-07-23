import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';
import type { Analyzer, TypeInfo } from '../types';
import { EvaluationError } from '../../interpreter/types';
import type { Context, EvaluationResult } from '../../interpreter/types';
import type { CompiledExpression } from '../../compiler/types';

// Type operators (is, as) need special handling in the parser
// They are included here for precedence lookup and keyword registration

export const isOperator: Operator = {
  name: 'is',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.IS,
    precedence: 6,
    associativity: 'left',
    notation: 'a is Type',
    special: true  // Requires special parsing
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]): TypeInfo => {
    // Always returns boolean
    return {
      type: analyzer.resolveType('Boolean'),
      isSingleton: input.isSingleton
    };
  },
  evaluate: (interpreter, context, input, leftValue, rightNode) => {
    // For 'is' operator, the right side should be a type name
    // It might come as a TypeOrIdentifierNode or as an array with the type name
    let typeName: string;
    
    if (typeof rightNode === 'string') {
      typeName = rightNode;
    } else if (Array.isArray(rightNode) && rightNode.length === 1) {
      typeName = rightNode[0];
    } else if (rightNode && typeof rightNode === 'object' && 'name' in rightNode) {
      // TypeOrIdentifier node
      typeName = rightNode.name;
    } else {
      throw new Error('is operator requires a type name');
    }
    
    // Import TypeSystem locally to avoid circular dependency
    const { TypeSystem } = require('../utils/type-system');
    
    if (leftValue.length === 0) {
      return { value: [], context };
    }
    
    // Check if all values in the collection match the type
    for (const item of leftValue) {
      if (!TypeSystem.isType(item, typeName)) {
        return { value: [false], context };
      }
    }
    
    return { value: [true], context };
  },
  compile: (compiler, input, args) => {
    // For operators, input is the left expression and args contains [left, right]
    const leftExpr = input;
    const rightExpr = args?.[1];
    
    if (!leftExpr) {
      throw new Error('is operator requires left operand');
    }
    
    if (!rightExpr) {
      throw new Error('is operator requires right operand (type name)');
    }
    
    // Import TypeSystem locally to avoid circular dependency
    const { TypeSystem } = require('../utils/type-system');
    
    // The right side of 'is' should be a type identifier
    // Since type identifiers don't evaluate to values, we need to handle this specially
    
    // Try to determine the type name at compile time
    let staticTypeName: string | undefined;
    
    // Check various possible structures for the type name
    // Check if it has source that looks like a type name
    if ((rightExpr as any).source && /^[A-Z][a-zA-Z]*$/.test((rightExpr as any).source)) {
      staticTypeName = (rightExpr as any).source;
    }
    // If it evaluates to a constant type name
    else {
      // Try to execute it with empty context to see if it returns a type name
      try {
        const result = rightExpr.fn({ input: [], env: {} });
        if (result.length === 1 && typeof result[0] === 'string' && /^[A-Z]/.test(result[0])) {
          staticTypeName = result[0];
        }
      } catch (e) {
        // Ignore errors, fall through to runtime handling
      }
    }
    
    if (staticTypeName) {
      // We know the type name at compile time
      return {
        fn: (ctx) => {
          const left = leftExpr.fn(ctx);
          
          if (left.length === 0) return [];
          
          // Check if all values in the collection match the type
          for (const item of left) {
            if (!TypeSystem.isType(item, staticTypeName)) {
              return [false];
            }
          }
          
          return [true];
        },
        type: compiler.resolveType('Boolean'),
        isSingleton: true
      };
    }
    
    // Fallback: evaluate type name at runtime
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        
        if (left.length === 0) return [];
        
        // Try to evaluate the right expression to get the type name
        let typeName: string;
        try {
          const rightResult = rightExpr.fn(ctx);
          if (rightResult.length === 1 && typeof rightResult[0] === 'string') {
            typeName = rightResult[0];
          } else {
            throw new Error('Type name must be a string');
          }
        } catch (e) {
          // If evaluation fails, it might be because TypeOrIdentifier 
          // is trying to access a non-existent property
          // In that case, assume the identifier name is the type name
          const source = (rightExpr as any).source;
          if (source && /^[A-Z]/.test(source)) {
            typeName = source;
          } else {
            throw new Error(`Cannot determine type name: ${e.message}`);
          }
        }
        
        // Check if all values in the collection match the type
        for (const item of left) {
          if (!TypeSystem.isType(item, typeName)) {
            return [false];
          }
        }
        
        return [true];
      },
      type: compiler.resolveType('Boolean'), 
      isSingleton: true
    };
  }
};

export const asOperator: Operator = {
  name: 'as',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.AS,
    precedence: 6,
    associativity: 'left',
    notation: 'a as Type',
    special: true  // Requires special parsing
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'preserve-input',
      cardinality: 'preserve-input'
    },
    propagatesEmpty: true
  },
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]): TypeInfo => {
    // Returns the target type (determined by parser)
    // This is a placeholder - actual type is set by parser
    return {
      type: analyzer.resolveType('Any'),
      isSingleton: input.isSingleton
    };
  },
  evaluate: (interpreter, context, input, leftValue, rightNode) => {
    // For 'as' operator, the right side should be a type name
    let typeName: string;
    
    if (typeof rightNode === 'string') {
      typeName = rightNode;
    } else if (Array.isArray(rightNode) && rightNode.length === 1) {
      typeName = rightNode[0];
    } else if (rightNode && typeof rightNode === 'object' && 'name' in rightNode) {
      // TypeOrIdentifier node
      typeName = rightNode.name;
    } else {
      throw new Error('as operator requires a type name');
    }
    
    // Import TypeSystem locally to avoid circular dependency
    const { TypeSystem } = require('../utils/type-system');
    
    // Filter values that match the type
    const results: any[] = [];
    for (const item of leftValue) {
      if (TypeSystem.isType(item, typeName)) {
        results.push(item);
      }
    }
    
    return { value: results, context };
  },
  compile: (compiler, input, args) => {
    // For operators, input is the left expression and args contains [left, right]
    const leftExpr = input;
    const rightExpr = args?.[1];
    
    if (!leftExpr || !rightExpr) {
      throw new Error('as operator requires two arguments');
    }
    
    // Similar to 'is', extract type name
    let typeName: string | undefined;
    
    if ((rightExpr as any).typeName) {
      typeName = (rightExpr as any).typeName;
    } else if ((rightExpr as any).source && (rightExpr as any).source.match(/^[A-Z]\w*$/)) {
      typeName = (rightExpr as any).source;
    }
    
    if (typeName) {
      // Import TypeSystem locally to avoid circular dependency
      const { TypeSystem } = require('../utils/type-system');
      
      return {
        fn: (ctx) => {
          const left = leftExpr.fn(ctx);
          
          // Filter values that match the type
          const results: any[] = [];
          for (const item of left) {
            if (TypeSystem.isType(item, typeName)) {
              results.push(item);
            }
          }
          
          return results;
        },
        type: compiler.resolveType(typeName),
        isSingleton: false
      };
    }
    
    // Fallback: dynamic type checking
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        
        // Extract type name from right result
        let typeNameValue: string;
        if (right.length === 1 && typeof right[0] === 'string') {
          typeNameValue = right[0];
        } else {
          throw new Error('as operator requires a type name');
        }
        
        // Import TypeSystem locally to avoid circular dependency
        const { TypeSystem } = require('../utils/type-system');
        
        // Filter values that match the type
        const results: any[] = [];
        for (const item of left) {
          if (TypeSystem.isType(item, typeNameValue)) {
            results.push(item);
          }
        }
        
        return results;
      },
      type: leftExpr.type,
      isSingleton: false
    };
  }
};

// Export type operators
export const typeOperators = [
  isOperator,
  asOperator
];