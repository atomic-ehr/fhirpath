import type { FunctionDefinition } from '../types';
import { Errors } from '../errors';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { RuntimeContextManager } from '../interpreter';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  if (args.length < 2) {
    throw Errors.invalidOperation('iif requires at least 2 arguments');
  }
  
  if (args.length > 3) {
    throw Errors.invalidOperation('iif takes at most 3 arguments');
  }

  // Check for multiple items in input collection
  if (input.length > 1) {
    throw Errors.invalidOperation('iif can only be used on single item or empty collections');
  }

  // Always evaluate condition
  const condExpr = args[0];
  const thenExpr = args[1];
  const elseExpr = args[2]; // Optional
  
  if (!condExpr || !thenExpr) {
    throw Errors.invalidOperation('iif requires condition and true-result arguments');
  }
  
  // When evaluating expressions within iif, ensure $this refers to the input
  // We need to preserve context variables but set $this to the iif input
  // Use RuntimeContextManager to properly handle prototype chain
  let evalContext = RuntimeContextManager.copy(context);
  evalContext = RuntimeContextManager.setVariable(evalContext, '$this', input.map(v => unbox(v)), true);
  
  const condResult = await evaluator(condExpr, input, evalContext);
  
  // Empty condition is treated as false
  if (condResult.value.length === 0) {
    // If no else expression provided, return empty
    if (!elseExpr) {
      return { value: [], context };
    }
    // Otherwise evaluate the else branch
    return await evaluator(elseExpr, input, context);
  }

  const boxedCondition = condResult.value[0];
  if (!boxedCondition) {
    return { value: [], context };
  }
  
  const condition = unbox(boxedCondition);
  
  // Check if condition is a boolean
  if (typeof condition !== 'boolean') {
    // Non-boolean criteria returns empty
    return { value: [], context };
  }
  
  // Evaluate only the needed branch
  if (condition === true) {
    return await evaluator(thenExpr, input, evalContext);
  } else {
    // If no else expression provided, return empty
    if (!elseExpr) {
      return { value: [], context };
    }
    return await evaluator(elseExpr, input, evalContext);
  }
};

export const iifFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'iif',
  category: ['control'],
  description: 'If-then-else expression (immediate if)',
  examples: ['iif(gender = "male", "Mr.", "Ms.")'],
  signatures: [{

    name: 'iif',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'condition', expression: true, type: { type: 'Boolean', singleton: true } },
      { name: 'trueResult', expression: true, type: { type: 'Any', singleton: false } },
      { name: 'falseResult', expression: true, type: { type: 'Any', singleton: false }, optional: true },
    ],
    result: { type: 'Any', singleton: false },
  }],
  evaluate
};