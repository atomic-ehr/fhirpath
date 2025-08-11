import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../interpreter';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // aggregator expression is required
  if (args.length < 1) {
    throw Errors.invalidOperation('aggregate requires at least one argument (aggregator expression)');
  }

  const aggregatorExpr = args[0]!;
  const initExpr = args[1]; // optional init value

  // Evaluate init value if provided, otherwise start with empty
  let total: any[];
  if (initExpr) {
    const initResult = await evaluator(initExpr, input, context);
    total = initResult.value;
  } else {
    total = [];
  }

  // For each item in the input collection, evaluate the aggregator expression
  for (let index = 0; index < input.length; index++) {
    const item = input[index]!;
    // Create a new context with $this, $index, and $total
    // Note: $this needs unboxed value, but we pass boxed item to evaluator
    const unboxedItem = unbox(item);
    let aggregatorContext = RuntimeContextManager.withIterator(context, unboxedItem, index);
    
    // For the first iteration without init, $total should be empty (not undefined)
    // $total needs to be unboxed values for variable access
    const unboxedTotal = total.map(v => unbox(v));
    aggregatorContext = RuntimeContextManager.setVariable(aggregatorContext, '$total', unboxedTotal);

    // Evaluate the aggregator expression
    const result = await evaluator(aggregatorExpr, [item], aggregatorContext);
    
    // Update $total with the result
    total = result.value;
  }

  return { value: total, context };
};

export const aggregateFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'aggregate',
  category: ['aggregates'],
  description: 'Performs general-purpose aggregation by evaluating the aggregator expression for each element of the input collection',
  examples: [
    'value.aggregate($this + $total, 0)',
    'value.aggregate(iif($total.empty(), $this, iif($this < $total, $this, $total)))',
    'value.aggregate($total + $this, 0) / value.count()'
  ],
  signatures: [{

    name: 'aggregate',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'aggregator', expression: true, type: { type: 'Any', singleton: false } },
      { name: 'init', expression: true, type: { type: 'Any', singleton: false }, optional: true }
    ],
    result: { type: 'Any', singleton: false }
  }],
  evaluate
};