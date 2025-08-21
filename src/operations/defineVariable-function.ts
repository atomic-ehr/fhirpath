import type { FunctionDefinition, LiteralNode } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  if (args.length < 1) {
    throw Errors.invalidOperation('defineVariable requires at least 1 argument');
  }

  const nameNode = args[0] as LiteralNode;
  if (nameNode.valueType !== 'string') {
    throw Errors.invalidOperation('Variable name must be a string');
  }

  const varName = nameNode.value as string;
  
  let value: any[];
  
  if (args.length === 1) {
    // Single argument: defineVariable(name) - use input as value
    value = input;
  } else {
    // Two arguments: defineVariable(name, value) - evaluate value expression
    const tempContext = RuntimeContextManager.setVariable(context, '$this', input, true);
    const valueExpr = args[1];
    if (!valueExpr) {
      throw Errors.invalidOperation('defineVariable requires a value expression');
    }
    const valueResult = await evaluator(valueExpr, input, tempContext);
    value = valueResult.value;
  }

  // Set the variable using RuntimeContextManager (handles prefixes and checks)
  // This will throw an error if the variable is already defined (per spec)
  const newContext = RuntimeContextManager.setVariable(context, varName, value);

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
  signatures: [{

    name: 'defineVariable',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'name', type: { type: 'String', singleton: true } },
      { name: 'value', type: { type: 'Any', singleton: false }, optional: true },
    ],
    result: { type: 'Any', singleton: false },
  }],
  evaluate,
  async inferResultType(analyzer, node, inputType) {
    // defineVariable returns its input type unchanged
    return inputType || { type: 'Any', singleton: false };
  }
};