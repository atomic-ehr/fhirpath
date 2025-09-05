import type { FunctionDefinition, FunctionEvaluator, ASTNode, RuntimeContext, NodeEvaluator } from '../types';
import type { FHIRPathValue } from '../interpreter/boxing';
import { NodeType, isIdentifierNode } from '../types';
import { box } from '../interpreter/boxing';
import { evaluate as isOperatorEvaluate } from './is-operator';

const isEvaluator: FunctionEvaluator = async (
  input: FHIRPathValue[], 
  context: RuntimeContext, 
  args: ASTNode[],
  evaluator: NodeEvaluator
) => {
  // is() function takes one argument - the type name
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
  } else if (typeArg.type === NodeType.Binary && typeArg.operator === '.') {
    // Handle namespaced types like System.Boolean or FHIR.Patient
    // Reconstruct the full type name from the binary expression
    const leftPart = typeArg.left;
    const rightPart = typeArg.right;
    
    if (isIdentifierNode(leftPart) && isIdentifierNode(rightPart)) {
      typeName = `${leftPart.name}.${rightPart.name}`;
    } else {
      throw new Error(`is() requires a type name as argument, got complex expression`);
    }
  } else {
    // For other node types, try to get the name
    throw new Error(`is() requires a type name as argument, got ${typeArg.type}`);
  }
  
  // Use the is operator implementation with the type name
  return isOperatorEvaluate(input, context, input, [typeName]);
};

export { isEvaluator };

export const isFunction: FunctionDefinition & { evaluate: typeof isEvaluator } = {
  name: 'is',
  category: ['type'],
  description: 'Tests if the input is of the specified type',
  examples: ['Patient.name.is(HumanName)', '"hello".is(String)', '5.is(Integer)'],
  signatures: [
    {
      name: 'is-type-check', 
      parameters: [{ 
        name: 'type', 
        type: { type: 'Any', singleton: true },
        expression: true,
        typeReference: true 
      }],
      input: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true }
    }
  ],
  doesNotPropagateEmpty: false,
  evaluate: isEvaluator
};
