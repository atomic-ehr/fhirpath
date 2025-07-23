import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';
import { ContextManager } from '../../interpreter/context';
import { isTruthy } from '../utils';

export const whereFunction: Function = {
  name: 'where',
  kind: 'function',
  
  syntax: {
    notation: 'where(criteria)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'criteria',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, criteria) => {
    const results: any[] = [];
    if (!criteria) {
      throw new Error('where() requires a predicate expression');
    }

    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = ContextManager.setIteratorContext(context, item, i);
      const result = interpreter.evaluate(criteria, [item], iterContext);
      
      if (isTruthy(result.value)) {
        results.push(item);
      }
    }

    return { value: results, context };
  },
  
  compile: (compiler, input, args) => {
    const criteria = args[0];
    if (!criteria) {
      throw new Error('where() requires a predicate expression');
    }
    
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        const results: any[] = [];
        
        for (let i = 0; i < inputValue.length; i++) {
          const item = inputValue[i];
          const iterCtx = {
            ...ctx,
            focus: [item],
            env: {
              ...ctx.env,
              $index: i,
              $this: [item]
            }
          };
          const predicateResult = criteria.fn(iterCtx);
          
          if (isTruthy(predicateResult)) {
            results.push(item);
          }
        }
        
        return results;
      },
      type: input.type,
      isSingleton: false,
      source: `${input.source || ''}.where(${criteria.source || ''})`
    };
  }
};

export const selectFunction: Function = {
  name: 'select',
  kind: 'function',
  
  syntax: {
    notation: 'select(expression)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'expression',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'any',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: function(analyzer, input, args) {
    // First run default validation
    defaultFunctionAnalyze.call(this, analyzer, input, args);
    
    // For select(), the output type is determined by the expression result
    const expressionInfo = args[0];
    if (!expressionInfo) {
      return { type: analyzer.resolveType('Any'), isSingleton: false };
    }
    
    // select() always returns a collection
    return { type: expressionInfo.type, isSingleton: false };
  },
  
  evaluate: (interpreter, context, input, expression) => {
    const results: any[] = [];
    if (!expression) {
      throw new Error('select() requires an expression');
    }

    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = ContextManager.setIteratorContext(context, item, i);
      const result = interpreter.evaluate(expression, [item], iterContext);
      results.push(...result.value);
    }

    return { value: results, context };
  },
  
  compile: (compiler, input, args) => {
    const expression = args[0];
    if (!expression) {
      throw new Error('select() requires an expression');
    }
    
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        const results: any[] = [];
        
        for (let i = 0; i < inputValue.length; i++) {
          const item = inputValue[i];
          const iterCtx = {
            ...ctx,
            focus: [item],
            env: {
              ...ctx.env,
              $index: i,
              $this: [item]
            }
          };
          const exprResult = expression.fn(iterCtx);
          results.push(...exprResult);
        }
        
        return results;
      },
      type: expression.type,
      isSingleton: false,
      source: `${input.source || ''}.select(${expression.source || ''})`
    };
  }
};

export const ofTypeFunction: Function = {
  name: 'ofType',
  kind: 'function',
  
  syntax: {
    notation: 'ofType(type)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'type',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, typeNode) => {
    const results: any[] = [];
    
    // Extract type name from AST node
    let typeName: string;
    if (typeNode && typeNode.type === 11) { // TypeReference (correct enum value)
      typeName = typeNode.typeName;
    } else if (typeNode && typeNode.type === 1) { // TypeOrIdentifier
      typeName = typeNode.name;
    } else {
      throw new Error('ofType() requires a type reference');
    }
    
    for (const item of input) {
      if (isOfType(item, typeName)) {
        results.push(item);
      }
    }
    
    return { value: results, context };
  },
  
  compile: (compiler, input, args) => {
    // The TypeSystem module with isOfType helper
    const { TypeSystem } = require('../utils/type-system');
    
    // The argument should be a TypeReference node compiled to return the type name
    const typeArg = args[0];
    if (!typeArg) {
      throw new Error('ofType() requires a type reference');
    }
    
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        const results: any[] = [];
        
        // Get the type name
        let typeName: string;
        try {
          const typeResult = typeArg.fn(ctx);
          if (typeResult.length === 1 && typeof typeResult[0] === 'string') {
            typeName = typeResult[0];
          } else {
            throw new Error('Type reference must evaluate to a string');
          }
        } catch (e: any) {
          // If it's a type reference that cannot be evaluated, extract from source
          if (typeArg.source && /^[A-Z]/.test(typeArg.source)) {
            typeName = typeArg.source;
          } else {
            throw new Error(`Cannot determine type name: ${e.message}`);
          }
        }
        
        // Filter by type
        for (const item of inputValue) {
          if (TypeSystem.isType(item, typeName)) {
            results.push(item);
          }
        }
        
        return results;
      },
      type: input.type,
      isSingleton: false,
      source: `${input.source || ''}.ofType(${typeArg.source || ''})`
    };
  }
};

export const repeatFunction: Function = {
  name: 'repeat',
  kind: 'function',
  
  syntax: {
    notation: 'repeat(expression)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'expression',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, expression) => {
    let current = input;
    const seen = new Set();
    
    while (current.length > 0) {
      const nextResults: any[] = [];
      
      for (let i = 0; i < current.length; i++) {
        const item = current[i];
        const itemKey = JSON.stringify(item);
        
        if (!seen.has(itemKey)) {
          seen.add(itemKey);
          const iterContext = ContextManager.setIteratorContext(context, item, i);
          const result = interpreter.evaluate(expression, [item], iterContext);
          nextResults.push(...result.value);
        }
      }
      
      current = nextResults;
    }
    
    return { value: Array.from(seen).map(key => JSON.parse(key as string)), context };
  },
  
  compile: defaultFunctionCompile
};

// Helper function for type checking
function isOfType(item: any, typeName: string): boolean {
  // Handle FHIR resource types
  if (item && typeof item === 'object' && item.resourceType === typeName) {
    return true;
  }
  
  // Handle primitive types
  switch (typeName) {
    case 'String':
      return typeof item === 'string';
    case 'Boolean':
      return typeof item === 'boolean';
    case 'Integer':
      return typeof item === 'number' && Number.isInteger(item);
    case 'Decimal':
      return typeof item === 'number';
    default:
      return false;
  }
}