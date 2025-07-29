import type { FunctionDefinition, LiteralNode } from '../types';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length < 1) {
    throw new Error('defineVariable requires at least 1 argument');
  }

  const nameNode = args[0] as LiteralNode;
  if (nameNode.valueType !== 'string') {
    throw new Error('Variable name must be a string');
  }

  const varName = nameNode.value as string;
  
  let value: any[];
  
  if (args.length === 1) {
    // Single argument: defineVariable(name) - use input as value
    value = input;
  } else {
    // Two arguments: defineVariable(name, value) - evaluate value expression
    const tempContext = RuntimeContextManager.setSpecialVariable(context, 'this', input);
    const valueExpr = args[1];
    if (!valueExpr) {
      throw new Error('defineVariable requires a value expression');
    }
    const valueResult = evaluator(valueExpr, input, tempContext);
    value = valueResult.value;
  }

  // Set the variable using RuntimeContextManager (handles prefixes and checks)
  const newContext = RuntimeContextManager.setVariable(context, varName, value);
  
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
  examples: [
    'Patient.defineVariable("patientName", name.first())',
    'Patient.name.defineVariable("names")'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'name', type: { type: 'String', singleton: true } },
      { name: 'value', type: { type: 'Any', singleton: false }, optional: true },
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};