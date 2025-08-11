import type { FunctionDefinition } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';
import { unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Select requires exactly one argument
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('select', 1, args.length);
  }

  const expression = args[0];
  if (!expression) {
    throw Errors.invalidOperation('select requires a projection expression');
  }
  
  const results: any[] = [];

  // Process each boxed item with modified context
  for (let i = 0; i < input.length; i++) {
    const boxedItem = input[i];
    if (!boxedItem) continue;
    
    const item = unbox(boxedItem);
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);

    // Evaluate expression with temporary context (passing boxed item)
    const exprResult = evaluator(expression, [boxedItem], tempContext);
    // Results are already boxed
    results.push(...exprResult.value);
  }

  return { value: results, context };  // Original context restored
};

export const selectFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'select',
  category: ['collection'],
  description: 'Evaluates the projection expression for each item in the input collection. The result of each evaluation is added to the output collection. If the evaluation results in a collection with multiple items, all items are added to the output collection (collections resulting from evaluation of projection are flattened). This means that if the evaluation for an element results in the empty collection ({ }), no element is added to the result, and that if the input collection is empty ({ }), the result is empty as well.',
  examples: [
    'Bundle.entry.select(resource as Patient)',
    'Bundle.entry.select((resource as Patient).telecom.where(system = \'phone\'))',
    'Patient.name.where(use = \'usual\').select(given.first() + \' \' + family)'
  ],
  signatures: [{

    name: 'select',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'projection', type: { type: 'Any', singleton: false }, expression: true },
    ],
    result: 'parameterType' as any,
  }],
  evaluate
};