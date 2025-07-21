import { FunctionRegistry } from './registry';
import { ContextManager } from '../context';
import { isTruthy } from '../helpers';

// Core control flow functions

// Standalone function implementations
export const iifFn = (interpreter: any, context: any, input: any[], condition: any, thenBranch: any, elseBranch: any) => {
  // Evaluate condition
  const condResult = interpreter.evaluate(condition, input, context);
  
  // Check if condition is truthy
  if (isTruthy(condResult.value)) {
    // Evaluate then branch
    return interpreter.evaluate(thenBranch, input, condResult.context);
  } else {
    // Evaluate else branch
    return interpreter.evaluate(elseBranch, input, condResult.context);
  }
};

export const defineVariableFn = (interpreter: any, context: any, input: any[], name: string, valueExpr: any) => {
  // Evaluate the value expression
  const result = interpreter.evaluate(valueExpr, input, context);
  
  // Add variable to context
  const newContext = ContextManager.setVariable(result.context, name, result.value);
  
  return { value: input, context: newContext };
};

export const traceFn = (interpreter: any, context: any, input: any[], nameExpr: string, selectorExpr?: any) => {
  let values = input;
  
  if (selectorExpr) {
    const result = interpreter.evaluate(selectorExpr, input, context);
    values = result.value;
  }
  
  console.log(`[TRACE] ${nameExpr}:`, values);
  
  return { value: input, context };
};

export const checkFn = (interpreter: any, context: any, input: any[], errorExpr: any, conditionExpr: any) => {
  // Evaluate condition
  const condResult = interpreter.evaluate(conditionExpr, input, context);
  
  if (!isTruthy(condResult.value)) {
    // Evaluate error message
    const errorResult = interpreter.evaluate(errorExpr, input, condResult.context);
    const errorMessage = errorResult.value.join('');
    throw new Error(`Check failed: ${errorMessage}`);
  }
  
  return { value: input, context: condResult.context };
};

// Register functions with new signature

// iif(condition, then, else) - conditional expression
FunctionRegistry.register({
  name: 'iif',
  arguments: [
    {
      name: 'condition',
      type: 'expression',
      evaluationMode: 'lazy'
    },
    {
      name: 'then',
      type: 'expression',
      evaluationMode: 'lazy'
    },
    {
      name: 'else',
      type: 'expression',
      evaluationMode: 'lazy'
    }
  ],
  evaluate: iifFn
});

// defineVariable(name, value) - defines a variable in context
FunctionRegistry.register({
  name: 'defineVariable',
  arguments: [
    {
      name: 'name',
      type: 'string'
    },
    {
      name: 'value',
      type: 'expression',
      evaluationMode: 'lazy'
    }
  ],
  evaluate: defineVariableFn
});

// trace([name, ] [selector]) - debug tracing
FunctionRegistry.register({
  name: 'trace',
  arguments: [
    {
      name: 'name',
      type: 'string',
      optional: true,
      defaultValue: 'trace'
    },
    {
      name: 'selector',
      type: 'expression',
      optional: true,
      evaluationMode: 'lazy'
    }
  ],
  evaluate: traceFn
});

// check(error, condition) - assertion
FunctionRegistry.register({
  name: 'check',
  arguments: [
    {
      name: 'error',
      type: 'expression',
      evaluationMode: 'lazy'
    },
    {
      name: 'condition',
      type: 'expression',
      evaluationMode: 'lazy'
    }
  ],
  evaluate: checkFn
});