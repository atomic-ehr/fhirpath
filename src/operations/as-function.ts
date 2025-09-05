import type { FunctionDefinition, FunctionEvaluator, ASTNode, RuntimeContext, NodeEvaluator } from '../types';
import type { FHIRPathValue } from '../interpreter/boxing';
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
  
  // as() function only works on singleton values (single items), not collections
  // According to FHIRPath spec section 6.6
  if (input.length > 1) {
    throw new Error('as() can only be used on single values, not on collections');
  }
  
  // Extract type name from the argument AST node
  let typeName: string;
  
  if (isIdentifierNode(typeArg)) {
    typeName = typeArg.name;
  } else {
    // For other node types, try to get the name
    throw new Error(`as() requires a type name as argument, got ${typeArg.type}`);
  }
  
  // Validate the type name using ModelProvider if available
  if (context.modelProvider) {
    // Try to get the type from the model provider
    const typeInfo = await context.modelProvider.getType(typeName);
    if (!typeInfo) {
      // Not a valid FHIR type, check if it's a System type
      const systemTypes = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity'];
      const fhirPrimitiveTypes = ['boolean', 'integer', 'string', 'decimal', 'uri', 'url', 'canonical', 
                                   'base64Binary', 'instant', 'date', 'dateTime', 'time', 'code', 'oid', 
                                   'id', 'markdown', 'unsignedInt', 'positiveInt', 'uuid', 'xhtml'];
      
      if (!systemTypes.includes(typeName) && !fhirPrimitiveTypes.includes(typeName)) {
        throw new Error(`Unknown type: ${typeName}`);
      }
    }
  } else {
    // Without ModelProvider, only allow basic System types and reject obvious invalid names
    const systemTypes = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time'];
    const fhirPrimitiveTypes = ['boolean', 'integer', 'string', 'decimal', 'uri', 'url', 'canonical', 
                                 'base64Binary', 'instant', 'date', 'dateTime', 'time', 'code', 'oid', 
                                 'id', 'markdown', 'unsignedInt', 'positiveInt', 'uuid'];
    
    // If it's not a known primitive type and looks invalid, reject it
    if (!systemTypes.includes(typeName) && !fhirPrimitiveTypes.includes(typeName)) {
      // Check if it looks like a valid type name (starts with letter, contains only valid chars)
      if (!/^[A-Z][A-Za-z0-9]*$/.test(typeName) && !/^[a-z][a-z0-9]*$/i.test(typeName)) {
        throw new Error(`Invalid type name: ${typeName}`);
      }
      // If it contains numbers but isn't a known type, it's likely invalid
      if (/\d/.test(typeName) && typeName !== 'base64Binary') {
        throw new Error(`Unknown type: ${typeName}`);
      }
    }
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
