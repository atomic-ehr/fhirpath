import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';
import { ContextManager } from '../../interpreter/context';
import { isTruthy } from '../utils';

export const aggregateFunction: Function = {
  name: 'aggregate',
  kind: 'function',
  
  syntax: {
    notation: 'aggregate(aggregator, init)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'aggregator',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      },
      {
        name: 'init',
        kind: 'value',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: true
      }
    ],
    output: {
      type: 'preserve-parameter',
      parameterIndex: 0,
      cardinality: 'any'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, aggregatorExpr, init) => {
    if (!aggregatorExpr) {
      throw new Error('aggregate() requires an aggregator expression');
    }
    
    let total = init !== undefined ? init : [];
    
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = {
        ...ContextManager.setIteratorContext(context, item, i),
        env: {
          ...context.env,
          $this: [item],
          $index: i,
          $total: total
        }
      };
      
      const result = interpreter.evaluate(aggregatorExpr, [item], iterContext);
      total = result.value;
    }
    
    return { value: total, context };
  },
  
  compile: defaultFunctionCompile
};

export const childrenFunction: Function = {
  name: 'children',
  kind: 'function',
  
  syntax: {
    notation: 'children()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const results: any[] = [];
    
    for (const item of input) {
      if (item && typeof item === 'object') {
        for (const key of Object.keys(item)) {
          if (!key.startsWith('_')) {
            const value = item[key];
            if (Array.isArray(value)) {
              results.push(...value);
            } else if (value !== null && value !== undefined) {
              results.push(value);
            }
          }
        }
      }
    }
    
    return { value: results, context };
  },
  
  compile: defaultFunctionCompile
};

export const descendantsFunction: Function = {
  name: 'descendants',
  kind: 'function',
  
  syntax: {
    notation: 'descendants()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const results: any[] = [];
    const seen = new Set();
    
    function collectDescendants(items: any[]) {
      for (const item of items) {
        if (item && typeof item === 'object') {
          const key = JSON.stringify(item);
          if (!seen.has(key)) {
            seen.add(key);
            results.push(item);
            
            const children: any[] = [];
            for (const prop of Object.keys(item)) {
              if (!prop.startsWith('_')) {
                const value = item[prop];
                if (Array.isArray(value)) {
                  children.push(...value);
                } else if (value !== null && value !== undefined && typeof value === 'object') {
                  children.push(value);
                }
              }
            }
            collectDescendants(children);
          }
        }
      }
    }
    
    const children: any[] = [];
    for (const item of input) {
      if (item && typeof item === 'object') {
        for (const key of Object.keys(item)) {
          if (!key.startsWith('_')) {
            const value = item[key];
            if (Array.isArray(value)) {
              children.push(...value);
            } else if (value !== null && value !== undefined) {
              children.push(value);
            }
          }
        }
      }
    }
    
    collectDescendants(children);
    return { value: results, context };
  },
  
  compile: defaultFunctionCompile
};

export const iifFunction: Function = {
  name: 'iif',
  kind: 'function',
  
  syntax: {
    notation: 'iif(condition, then, else)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'condition',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      },
      {
        name: 'then',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      },
      {
        name: 'else',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'any',
      cardinality: 'any'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, condition, thenBranch, elseBranch) => {
    const condResult = interpreter.evaluate(condition, input, context);
    
    if (isTruthy(condResult.value)) {
      return interpreter.evaluate(thenBranch, input, condResult.context);
    } else {
      return interpreter.evaluate(elseBranch, input, condResult.context);
    }
  },
  
  compile: defaultFunctionCompile
};

export const defineVariableFunction: Function = {
  name: 'defineVariable',
  kind: 'function',
  
  syntax: {
    notation: 'defineVariable(name, value)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'name',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      },
      {
        name: 'value',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'preserve-input'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, nameValue, valueExpr) => {
    // Extract the string value from the name parameter
    let varName: string;
    
    // nameValue comes as evaluated value (array) when param.kind !== 'expression'
    if (Array.isArray(nameValue) && nameValue.length === 1 && typeof nameValue[0] === 'string') {
      varName = nameValue[0];
    } else if (typeof nameValue === 'string') {
      varName = nameValue;
    } else {
      throw new Error('defineVariable() requires a string literal as the first parameter');
    }
    
    const result = interpreter.evaluate(valueExpr, input, context);
    const newContext = ContextManager.setVariable(result.context, varName, result.value);
    return { value: input, context: newContext };
  },
  
  compile: defaultFunctionCompile
};

export const traceFunction: Function = {
  name: 'trace',
  kind: 'function',
  
  syntax: {
    notation: 'trace(name, selector)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'name',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: true
      },
      {
        name: 'selector',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: true
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'preserve-input'
    },
    propagatesEmpty: false,
    deterministic: false
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, nameExpr, selectorExpr) => {
    let values = input;
    
    if (selectorExpr) {
      const result = interpreter.evaluate(selectorExpr, input, context);
      values = result.value;
    }
    
    console.log(`[TRACE] ${nameExpr || 'trace'}:`, values);
    
    return { value: input, context };
  },
  
  compile: defaultFunctionCompile
};

export const checkFunction: Function = {
  name: 'check',
  kind: 'function',
  
  syntax: {
    notation: 'check(error, condition)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'error',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      },
      {
        name: 'condition',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'preserve-input'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, errorExpr, conditionExpr) => {
    const condResult = interpreter.evaluate(conditionExpr, input, context);
    
    if (!isTruthy(condResult.value)) {
      const errorResult = interpreter.evaluate(errorExpr, input, condResult.context);
      const errorMessage = errorResult.value.join('');
      throw new Error(`Check failed: ${errorMessage}`);
    }
    
    return { value: input, context: condResult.context };
  },
  
  compile: defaultFunctionCompile
};