import type { FunctionDefinition, AnalysisContext, InternalAnalysisResult } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../runtime-context';
import { type FunctionEvaluator } from '../types';
import { unbox, box } from '../boxing';
import { collectionsEqual } from '../comparison';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Repeat requires exactly one argument
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('repeat', 1, args.length);
  }

  const expression = args[0];
  if (!expression) {
    throw Errors.invalidOperation('repeat requires a projection expression');
  }
  
  // Result collection that will accumulate all unique items
  const result: any[] = [];
  
  // Track which items we've already seen to detect duplicates
  const seen = new Set<any>();
  
  // Helper to check if an item is already in the result
  const isInResult = (item: any): boolean => {
    for (const existing of result) {
      // Use equals comparison to determine if items are the same
      const equalResult = collectionsEqual([existing], [item]);
      if (equalResult === true) {
        return true;
      }
    }
    return false;
  };
  
  // Initial evaluation on input collection
  const initialResults: any[] = [];
  for (let i = 0; i < input.length; i++) {
    const boxedItem = input[i];
    if (!boxedItem) continue;
    
    const item = unbox(boxedItem);
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);
    
    // Evaluate expression with temporary context
    const exprResult = await evaluator(expression, [boxedItem], tempContext);
    
    // Add results from initial evaluation
    for (const newItem of exprResult.value) {
      if (newItem && !isInResult(newItem)) {
        result.push(newItem);
        initialResults.push(newItem);
      }
    }
  }
  
  // Now process the queue with items from the initial results
  let queue = [...initialResults];
  
  // Process items until queue is empty
  while (queue.length > 0) {
    const nextQueue: any[] = [];
    
    for (let i = 0; i < queue.length; i++) {
      const boxedItem = queue[i];
      if (!boxedItem) continue;
      
      const item = unbox(boxedItem);
      
      // Create iterator context with $this and $index
      let tempContext = RuntimeContextManager.withIterator(context, item, i);
      tempContext = RuntimeContextManager.setVariable(tempContext, '$total', queue.length);
      
      // Evaluate expression with temporary context
      const exprResult = await evaluator(expression, [boxedItem], tempContext);
      
      // Add new items to the result and next queue
      for (const newItem of exprResult.value) {
        if (newItem && !isInResult(newItem)) {
          result.push(newItem);
          nextQueue.push(newItem);
        }
      }
    }
    
    // Move to next iteration
    queue = nextQueue;
  }
  
  return { value: result, context };
};

export const repeatFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'repeat',
  category: ['collection'],
  description: 'A version of select that will repeat the projection and add items to the output collection only if they are not already in the output collection as determined by the equals (=) operator. Can be used to traverse a tree by repeatedly selecting specific children.',
  examples: [
    'ValueSet.expansion.repeat(contains)',
    'Questionnaire.repeat(item)',
    'Bundle.entry.repeat(resource.link)'
  ],
  signatures: [{
    name: 'repeat',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'projection', type: { type: 'Any', singleton: false }, expression: true },
    ],
    result: 'parameterType' as any,
  }],
  evaluate,
  
  /**
   * Analysis-time behavior for repeat.
   * Similar to select, but with repeated application.
   */
  async analyze(context: AnalysisContext, args): Promise<InternalAnalysisResult> {
    const diagnostics: any[] = [];
    
    if (args.length !== 1) {
      return {
        type: { type: 'Any', singleton: false },
        diagnostics: [{
          message: 'repeat expects exactly 1 argument',
          severity: 'error' as any,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        }]
      };
    }
    
    // Get element type from input
    const elementType = context.inputType.singleton 
      ? context.inputType 
      : { ...context.inputType, singleton: true };
    
    // Create context for analyzing the projection
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
      context
    };
  }
};