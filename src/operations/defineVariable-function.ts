import type { FunctionDefinition, LiteralNode } from '../types';
import { RuntimeContextManager, type FunctionEvaluator } from '../interpreter';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length < 2) {
    throw new Error('defineVariable requires 2 arguments');
  }

  const nameNode = args[0] as LiteralNode;
  if (nameNode.valueType !== 'string') {
    throw new Error('Variable name must be a string');
  }

  const varName = nameNode.value as string;
  
  // Evaluate the value expression with $this set to input
  const tempContext = RuntimeContextManager.setSpecialVariable(context, 'this', input);
  const valueResult = evaluator(args[1], input, tempContext);

  // Set the variable using RuntimeContextManager (handles prefixes and checks)
  const newContext = RuntimeContextManager.setVariable(context, varName, valueResult.value);
  
  // If newContext is same as context, variable already existed - return empty
  if (newContext === context) {
    return { value: [], context };
  }

  // Pass through input unchanged
  return { value: input, context: newContext };
};

export const defineVariableFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'defineVariable',
  category: ['context'],
  description: 'Defines a variable in the evaluation context',
  examples: ['Patient.defineVariable("patientName", name.first())'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'name', type: { type: 'String', singleton: true } },
      { name: 'value', type: { type: 'Any', singleton: false } },
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};