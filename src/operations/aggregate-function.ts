import type { FunctionDefinition, FunctionEvaluator, TypeInfo } from '../types';
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

  // If input is empty and init is provided, return the init value
  if (input.length === 0 && initExpr) {
    return { value: total, context };
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
  doesNotPropagateEmpty: true,  // aggregate with init should return init value for empty input
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
  evaluate,
  async inferResultType(analyzer, node, inputType) {
    // If init parameter is provided, use its type to infer result type
    if (node.arguments.length >= 2) {
      const initType = await (analyzer as any).inferType(node.arguments[1]!, inputType);
      // The result type is the same as init type
      return initType;
    }
    // Without init, we can't fully infer the type without running annotation
    // This is a limitation - the actual type will be set during annotateAST
    if (node.arguments.length >= 1) {
      // We could try to infer, but it would require setting up system variables
      // For now, return Any and let annotateAST handle proper typing
      return { type: 'Any', singleton: false };
    }
    // No arguments at all
    return { type: 'Any', singleton: false };
  },
  async analyze(context, args) {
    const diagnostics: any[] = [];
    const itemType = { ...context.inputType, singleton: true };

    // Determine $total type: from init (arg[1]) if provided; otherwise from aggregator result after first iteration (approximate with Any)
    let totalType = { type: 'Any', singleton: false } as TypeInfo;

    if (args.length >= 2 && args[1]) {
      const initResult = await context
        .withSystemVariable('$this', itemType)
        .withSystemVariable('$index', { type: 'Integer', singleton: true })
        .analyzeNode(args[1]!);
      diagnostics.push(...initResult.diagnostics);
      totalType = initResult.type;
    }

    // Analyze aggregator with $this (item) and $total (init or inferred seed)
    if (args.length >= 1 && args[0]) {
      // If we don't have init, seed $total with a heuristic:
      // - If aggregator contains string operations, seed as String
      // - Else seed as item type
      const containsStringHints = (function hasStringHints(node: any): boolean {
        if (!node) return false;
        if (node.type === 'Literal' && typeof node.value === 'string') return true;
        if (node.type === 'Function' && node.name?.type === 'Identifier' && node.name.name === 'toString') return true;
        if (node.children) return node.children.some((c: any) => hasStringHints(c));
        if (node.arguments) return (node.arguments as any[]).some(a => hasStringHints(a));
        if (node.left && node.right) return hasStringHints(node.left) || hasStringHints(node.right);
        if (node.expression) return hasStringHints(node.expression);
        return false;
      })(args[0]);

      const seededTotal = (args.length < 2)
        ? (containsStringHints ? { type: 'String', singleton: true } as TypeInfo : itemType)
        : totalType;
      let aggregatorCtx = context
        .withSystemVariable('$this', itemType)
        .withSystemVariable('$index', { type: 'Integer', singleton: true })
        .withSystemVariable('$total', seededTotal);

      const firstPass = await aggregatorCtx.analyzeNode(args[0]!);
      diagnostics.push(...firstPass.diagnostics);

      // If no init provided, refine $total type to aggregator result and re-analyze aggregator
      if (args.length < 2) {
        aggregatorCtx = aggregatorCtx.withSystemVariable('$total', firstPass.type);
        const secondPass = await aggregatorCtx.analyzeNode(args[0]!);
        diagnostics.push(...secondPass.diagnostics);
        return { type: secondPass.type, diagnostics, context };
      }

      return { type: firstPass.type, diagnostics, context };
    }

    return { type: context.inputType, diagnostics, context };
  }
};
