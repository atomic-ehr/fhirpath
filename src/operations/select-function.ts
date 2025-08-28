import type { FunctionDefinition, AnalysisContext, InternalAnalysisResult } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../runtime-context';
import { type FunctionEvaluator } from '../types';
import { unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
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
    const exprResult = await evaluator(expression, [boxedItem], tempContext);
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
  evaluate,
  
  /**
   * Analysis-time behavior for select.
   * The projection expression needs to be analyzed with system variables in scope.
   */
  async analyze(context: AnalysisContext, args): Promise<InternalAnalysisResult> {
    const diagnostics: any[] = [];
    
    if (args.length !== 1) {
      return {
        type: { type: 'Any', singleton: false },
        diagnostics: [{
          message: 'select expects exactly 1 argument',
          severity: 'error' as any,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        }]
      };
    }
    
    // For select, we need to analyze the projection expression with:
    // 1. $this set to each element type
    // 2. $index available as Integer
    // 3. User variables from the outer context preserved
    
    // Get element type from input
    const elementType = context.inputType.singleton 
      ? context.inputType 
      : { ...context.inputType, singleton: true };
    
    // Create context for analyzing the projection
    // Add system variables but preserve user variables
    // IMPORTANT: Also update input type to the element type for property navigation
    const projectionContext = context
      .withInputType(elementType)
      .withSystemVariable('$this', elementType)
      .withSystemVariable('$index', { type: 'Integer', singleton: true })
      .withSystemVariable('$total', { type: 'Integer', singleton: true });
    
    // Analyze the projection expression
    const projectionArg = args[0];
    if (!projectionArg) {
      return {
        type: { type: 'Any', singleton: false },
        diagnostics,
        context
      };
    }
    const projectionResult = await projectionContext.analyzeNode(projectionArg);
    diagnostics.push(...projectionResult.diagnostics);
    
    // Result type is the type returned by the projection (as a collection)
    const resultType = projectionResult.type.singleton
      ? { ...projectionResult.type, singleton: false }
      : projectionResult.type;
    
    return {
      type: resultType,
      diagnostics,
      context // Return original context - select doesn't modify outer scope
    };
  }
};
