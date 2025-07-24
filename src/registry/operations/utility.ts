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
      cardinality: 'collection'
    },
    parameters: [
      {
        name: 'aggregator',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: false
      },
      {
        name: 'init',
        kind: 'value',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: true
      }
    ],
    output: {
      type: 'any',
      cardinality: 'collection'
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
      cardinality: 'collection'
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
      cardinality: 'collection'
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
      cardinality: 'collection'
    },
    parameters: [
      {
        name: 'condition',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: false
      },
      {
        name: 'then',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: false
      },
      {
        name: 'else',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: false
      }
    ],
    output: {
      type: 'any',
      cardinality: 'collection'
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
  
  compile: (compiler, input, args) => {
    const [condExpr, thenExpr, elseExpr] = args;
    
    if (!condExpr || !thenExpr || !elseExpr) {
      throw new Error('iif() requires condition, then, and else expressions');
    }
    
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        const condCtx = { ...ctx, input: inputVal, focus: inputVal };
        const condResult = condExpr.fn(condCtx);
        
        if (isTruthy(condResult)) {
          const thenCtx = { ...ctx, input: inputVal, focus: inputVal };
          return thenExpr.fn(thenCtx);
        } else {
          const elseCtx = { ...ctx, input: inputVal, focus: inputVal };
          return elseExpr.fn(elseCtx);
        }
      },
      type: compiler.resolveType('Any'),
      isSingleton: false,
      source: `${input.source || ''}.iif(${condExpr.source || ''}, ${thenExpr.source || ''}, ${elseExpr.source || ''})`
    };
  }
};

export const defineVariableFunction: Function = {
  name: 'defineVariable',
  kind: 'function',
  
  syntax: {
    notation: 'defineVariable(name [, value])'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'collection'
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
        cardinality: 'collection',
        optional: true
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
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
    
    // Check if the variable is a system variable
    const systemVariables = ['context', 'resource', 'rootResource', 'ucum', 'sct', 'loinc'];
    if (systemVariables.includes(varName)) {
      // Return empty result for system variable redefinition
      return { value: [], context };
    }
    
    // Check if the variable is already defined at the current scope level
    // We only check hasOwnProperty to detect redefinition at the same scope
    if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, varName)) {
      // Return empty result for variable redefinition in the same scope
      return { value: [], context };
    }
    
    let value: any[];
    
    if (valueExpr) {
      // Create a new context where $this refers to the input
      const valueContext = ContextManager.copy(context);
      valueContext.env = { ...valueContext.env, $this: input };
      
      const result = interpreter.evaluate(valueExpr, input, valueContext);
      value = result.value;
      const newContext = ContextManager.setVariable(result.context, varName, value);
      return { value: input, context: newContext };
    } else {
      // If no value expression is provided, use the input collection
      value = input;
      const newContext = ContextManager.setVariable(context, varName, value);
      return { value: input, context: newContext };
    }
  },
  
  compile: (compiler, input, args) => {
    const [nameExpr, valueExpr] = args;
    
    // For defineVariable, the name should be a literal string
    // Try to extract it at compile time
    let varName: string | undefined;
    
    // The name parameter should evaluate to a constant string
    try {
      const nameResult = nameExpr?.fn({ input: [], focus: [], env: {} }) || [];
      if (nameResult.length === 1 && typeof nameResult[0] === 'string') {
        varName = nameResult[0];
      }
    } catch (e) {
      // If we can't evaluate it at compile time, it might be invalid
      throw new Error('defineVariable() requires a string literal as the first parameter');
    }
    
    if (!varName) {
      throw new Error('defineVariable() requires a string literal as the first parameter');
    }
    
    // Return a compiled expression that modifies the context
    return {
      fn: (ctx) => {
        // Check if the variable is a system variable
        const systemVariables = ['context', 'resource', 'rootResource', 'ucum', 'sct', 'loinc'];
        if (systemVariables.includes(varName)) {
          // Return empty result for system variable redefinition
          return [];
        }
        
        // Check if the variable is already defined
        // Since we're modifying ctx.env in place, we need to check if it exists
        if (varName in ctx.env) {
          // Return empty result for variable redefinition
          return [];
        }
        
        // Evaluate the input expression
        const inputVal = input.fn(ctx);
        
        let value: any[];
        
        if (valueExpr) {
          // Create context for evaluating the value expression
          // Set $this to the input value
          const valueCtx = { 
            ...ctx, 
            input: inputVal, 
            focus: inputVal,
            env: { ...ctx.env, $this: inputVal }
          };
          
          // Evaluate the value expression
          value = valueExpr.fn(valueCtx);
        } else {
          // If no value expression is provided, use the input collection
          value = inputVal;
        }
        
        // IMPORTANT: We need to modify the context object that was passed in
        // so that subsequent operations can see the variable
        // This is done by modifying the env object in place
        ctx.env[varName] = value;
        
        // Return the original input (not the value)
        return inputVal;
      },
      type: input.type,
      isSingleton: input.isSingleton,
      source: valueExpr 
        ? `${input.source || ''}.defineVariable('${varName}', ${valueExpr.source || ''})`
        : `${input.source || ''}.defineVariable('${varName}')`
    };
  }
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
      cardinality: 'collection'
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
        cardinality: 'collection',
        optional: true
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
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
      cardinality: 'collection'
    },
    parameters: [
      {
        name: 'error',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: false
      },
      {
        name: 'condition',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'collection',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
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