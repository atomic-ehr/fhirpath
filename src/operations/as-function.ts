import type { FunctionDefinition, FunctionEvaluator, ASTNode, RuntimeContext, NodeEvaluator } from '../types';
import type { FHIRPathValue } from '../boxing';
import { NodeType, isIdentifierNode } from '../types';
import { evaluate as asOperatorEvaluate } from './as-operator';

const asEvaluator: FunctionEvaluator = async (
  input: FHIRPathValue[], 
  context: RuntimeContext, 
  args: ASTNode[],
  evaluator: NodeEvaluator
) => {
  // as() function takes one argument - the type name
  if (args.length !== 1) {
    return { value: [], context };
  }
  
  const typeArg = args[0];
  if (!typeArg) {
    return { value: [], context };
  }
  
  // Extract type name from the argument AST node
  let typeName: string;
  
  if (isIdentifierNode(typeArg)) {
    typeName = typeArg.name;
  } else {
    // For other node types, try to get the name
    throw new Error(`as() requires a type name as argument, got ${typeArg.type}`);
  }
  
  // Use the as operator implementation with the type name
  return asOperatorEvaluate(input, context, input, [typeName]);
};

export { asEvaluator };

export const asFunction: FunctionDefinition & { evaluate: typeof asEvaluator } = {
  name: 'as',
  category: ['type'],
  description: 'Casts the input to the specified type, returning empty if the cast fails',
  examples: ['Patient.name.as(HumanName)', '"hello".as(String)', '5.as(Integer)'],
  signatures: [
    {
      name: 'as-type-cast',
      parameters: [{ 
        name: 'type', 
        type: { type: 'Any', singleton: true },
        expression: true,
        typeReference: true
      }],
      input: { type: 'Any', singleton: false },
      result: { type: 'Any', singleton: false }
    }
  ],
  doesNotPropagateEmpty: false,
  evaluate: asEvaluator
};
