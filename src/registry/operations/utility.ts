import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';
import { RuntimeContextManager } from '../../runtime/context';
import { isTruthy } from '../utils';
import { isDebugContext, addTrace } from '../../runtime/debug-context';

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
      let iterContext = RuntimeContextManager.withIterator(context, item, i);
      iterContext = RuntimeContextManager.setSpecialVariable(iterContext, 'total', total);
      
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
    notation: 'iif(condition, then [, else])'
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
  
  evaluate: (interpreter, context, input, condition, thenBranch, elseBranch) => {
    // Per spec: if input has multiple values, return empty
    if (input.length > 1) {
      return { value: [], context };
    }
    
    // Set up context with $this = input
    let condContext = RuntimeContextManager.copy(context);
    if (input.length === 1) {
      condContext = RuntimeContextManager.setSpecialVariable(condContext, 'this', input[0]);
    }
    
    const condResult = interpreter.evaluate(condition, input, condContext);
    
    // Per spec: if condition is empty, treat as false
    if (condResult.value.length === 0) {
      if (elseBranch) {
        return interpreter.evaluate(elseBranch, input, condResult.context);
      } else {
        // Two-parameter form: no else branch means return empty
        return { value: [], context };
      }
    }
    
    // Per spec: if condition is not boolean singleton, return empty
    if (condResult.value.length !== 1 || typeof condResult.value[0] !== 'boolean') {
      return { value: [], context };
    }
    
    if (condResult.value[0] === true) {
      return interpreter.evaluate(thenBranch, input, condResult.context);
    } else {
      if (elseBranch) {
        return interpreter.evaluate(elseBranch, input, condResult.context);
      } else {
        // Two-parameter form: no else branch means return empty
        return { value: [], context };
      }
    }
  },
  
  compile: (compiler, input, args) => {
    const [condExpr, thenExpr, elseExpr] = args;
    
    if (!condExpr || !thenExpr) {
      throw new Error('iif() requires at least condition and then expressions');
    }
    
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        
        // Per spec: if input has multiple values, return empty
        if (inputVal.length > 1) {
          return [];
        }
        
        // Set up context with $this = input
        let condCtx = RuntimeContextManager.withInput(ctx, inputVal);
        if (inputVal.length === 1) {
          condCtx = RuntimeContextManager.setSpecialVariable(condCtx, 'this', inputVal[0]);
        }
        
        const condResult = condExpr.fn(condCtx);
        
        // Per spec: if condition is empty, treat as false
        if (condResult.length === 0) {
          if (elseExpr) {
            const elseCtx = RuntimeContextManager.withInput(ctx, inputVal);
            return elseExpr.fn(elseCtx);
          } else {
            // Two-parameter form: no else branch means return empty
            return [];
          }
        }
        
        // Per spec: if condition is not boolean singleton, return empty
        if (condResult.length !== 1 || typeof condResult[0] !== 'boolean') {
          return [];
        }
        
        if (condResult[0] === true) {
          const thenCtx = RuntimeContextManager.withInput(ctx, inputVal);
          return thenExpr.fn(thenCtx);
        } else {
          if (elseExpr) {
            const elseCtx = RuntimeContextManager.withInput(ctx, inputVal);
            return elseExpr.fn(elseCtx);
          } else {
            // Two-parameter form: no else branch means return empty
            return [];
          }
        }
      },
      type: compiler.resolveType('Any'),
      isSingleton: false,
      source: elseExpr 
        ? `${input.source || ''}.iif(${condExpr.source || ''}, ${thenExpr.source || ''}, ${elseExpr.source || ''})`
        : `${input.source || ''}.iif(${condExpr.source || ''}, ${thenExpr.source || ''})`
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
    
    let value: any[];
    
    if (valueExpr) {
      // Create a new context where $this refers to the input
      let valueContext = RuntimeContextManager.copy(context);
      valueContext = RuntimeContextManager.setSpecialVariable(valueContext, 'this', input);
      
      const result = interpreter.evaluate(valueExpr, input, valueContext);
      value = result.value;
    } else {
      // If no value expression is provided, use the input collection
      value = input;
    }
    
    // Try to set the variable - setVariable will handle redefinition check
    const newContext = RuntimeContextManager.setVariable(context, varName, value);
    
    // If context didn't change, it means redefinition was attempted
    if (newContext === context) {
      return { value: [], context };
    }
    
    return { value: input, context: newContext };
  },
  
  compile: (compiler, input, args) => {
    const [nameExpr, valueExpr] = args;
    
    // For defineVariable, the name should be a literal string
    // Try to extract it at compile time
    let varName: string | undefined;
    
    // The name parameter should evaluate to a constant string
    try {
      const nameResult = nameExpr?.fn(RuntimeContextManager.create([])) || [];
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
        // Check if variable is already defined before evaluating expressions
        const existingValue = RuntimeContextManager.getVariable(ctx, varName);
        if (existingValue !== undefined) {
          // Variable already exists, return empty
          return [];
        }
        
        // Evaluate the input expression
        const inputVal = input.fn(ctx);
        
        let value: any[];
        
        if (valueExpr) {
          // Create context for evaluating the value expression
          // Set $this to the input value
          let valueCtx = RuntimeContextManager.withInput(ctx, inputVal);
          valueCtx = RuntimeContextManager.setSpecialVariable(valueCtx, 'this', inputVal);
          
          // Evaluate the value expression
          value = valueExpr.fn(valueCtx);
        } else {
          // If no value expression is provided, use the input collection
          value = inputVal;
        }
        
        // Set the variable - we already checked it doesn't exist
        const newCtx = RuntimeContextManager.setVariable(ctx, varName, value, true); // allow setting since we checked
        
        // IMPORTANT: For the compiler version, we need to propagate the variable
        // to the parent context by copying the variables object
        Object.assign(ctx.variables, newCtx.variables);
        
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
  
  evaluate: (interpreter, context, input, nameValue, selectorExpr) => {
    // Extract the name from the parameter (it comes as an array when kind is 'value')
    let traceName = 'trace';
    if (nameValue && Array.isArray(nameValue) && nameValue.length > 0) {
      traceName = String(nameValue[0]);
    } else if (typeof nameValue === 'string') {
      traceName = nameValue;
    }
    
    let values = input;
    
    if (selectorExpr) {
      const result = interpreter.evaluate(selectorExpr, input, context);
      values = result.value;
    }
    
    // Check if we're in debug mode
    if (isDebugContext(context)) {
      addTrace(context, traceName, values);
    } else {
      console.log(`[TRACE] ${traceName}:`, values);
    }
    
    return { value: input, context };
  },
  
  compile: (compiler, input, args) => {
    const [nameExpr, selectorExpr] = args;
    
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        
        // Extract the name
        let traceName = 'trace';
        if (nameExpr) {
          const nameResult = nameExpr.fn(ctx);
          if (nameResult.length > 0) {
            traceName = String(nameResult[0]);
          }
        }
        
        let values = inputVal;
        
        if (selectorExpr) {
          // Create context with input for selector evaluation
          const selectorCtx = RuntimeContextManager.withInput(ctx, inputVal);
          values = selectorExpr.fn(selectorCtx);
        }
        
        console.log(`[TRACE] ${traceName}:`, values);
        
        return inputVal;
      },
      type: input.type,
      isSingleton: input.isSingleton,
      source: selectorExpr 
        ? `${input.source || ''}.trace('${nameExpr?.source || ''}', ${selectorExpr.source || ''})`
        : nameExpr
        ? `${input.source || ''}.trace('${nameExpr.source || ''}')`
        : `${input.source || ''}.trace()`
    };
  }
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