import type { FunctionDefinition, RuntimeContext, ASTNode, TypeInfo, NodeEvaluator, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import type { FHIRPathValue } from '../interpreter/boxing';
import { unbox } from '../interpreter/boxing';
import { isIdentifierNode, isFunctionNode } from '../types';

export const ofTypeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'ofType',
  category: ['type'],
  description: 'Filters input collection to include only items of the specified type',
  examples: [
    'Observation.value.ofType(Quantity)',
    'Patient.deceased.ofType(Boolean)'
  ],
  signatures: [{

    name: 'ofType',
    input: { type: 'Any', singleton: false },
    parameters: [
      { 
        name: 'type', 
        type: { type: 'Any', singleton: true },
        expression: true,
        typeReference: true // This parameter expects a type name
      }
    ],
    result: 'inputType'
  }],
  async evaluate(input: FHIRPathValue[], context: RuntimeContext, args: ASTNode[], evaluator: NodeEvaluator) {
    if (args.length !== 1) {
      throw Errors.invalidOperation('ofType requires exactly one argument');
    }

    const typeArg = args[0]!;
    
    // Extract type name from the argument
    let targetTypeName: string;
    if (isIdentifierNode(typeArg)) {
      targetTypeName = typeArg.name;
    } else if (isFunctionNode(typeArg) && isIdentifierNode(typeArg.name)) {
      // Handle cases like ofType(Patient())
      targetTypeName = typeArg.name.name;
    } else {
      throw Errors.invalidOperation(`ofType() requires a type name as argument, got ${typeArg.type}`);
    }

    // Validate the type name using ModelProvider if available
    if (context.modelProvider) {
      // Try to get the type from the model provider
      const typeInfo = await context.modelProvider.getType(targetTypeName);
      if (!typeInfo) {
        // Not a valid FHIR type, check if it's a System type
        const systemTypes = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity'];
        const fhirPrimitiveTypes = ['boolean', 'integer', 'string', 'decimal', 'uri', 'url', 'canonical', 
                                     'base64Binary', 'instant', 'date', 'dateTime', 'time', 'code', 'oid', 
                                     'id', 'markdown', 'unsignedInt', 'positiveInt', 'uuid', 'xhtml'];
        
        if (!systemTypes.includes(targetTypeName) && !fhirPrimitiveTypes.includes(targetTypeName)) {
          throw Errors.invalidOperation(`Unknown type: ${targetTypeName}`);
        }
      }
    } else {
      // Without ModelProvider, only allow basic System types and reject obvious invalid names
      const systemTypes = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time'];
      const fhirPrimitiveTypes = ['boolean', 'integer', 'string', 'decimal', 'uri', 'url', 'canonical', 
                                   'base64Binary', 'instant', 'date', 'dateTime', 'time', 'code', 'oid', 
                                   'id', 'markdown', 'unsignedInt', 'positiveInt', 'uuid'];
      
      // If it's not a known primitive type and looks invalid, reject it
      if (!systemTypes.includes(targetTypeName) && !fhirPrimitiveTypes.includes(targetTypeName)) {
        // Check if it looks like a valid type name
        if (!/^[A-Z][A-Za-z0-9]*$/.test(targetTypeName) && !/^[a-z][a-z0-9]*$/i.test(targetTypeName)) {
          throw Errors.invalidOperation(`Invalid type name: ${targetTypeName}`);
        }
        // If it contains numbers but isn't a known type, it's likely invalid
        if (/\d/.test(targetTypeName) && targetTypeName !== 'base64Binary') {
          throw Errors.invalidOperation(`Unknown type: ${targetTypeName}`);
        }
      }
    }

    // If we have typeInfo from the analyzer (with ModelProvider), use it
    // NOTE: This optimization is currently disabled because currentNode refers to the ofType
    // function node, not the input navigation node. The correct type checking happens below
    // using the boxed items' typeInfo.
    /*
    const currentNode = context.currentNode;
    if (currentNode?.typeInfo?.modelContext) {
      // Type-aware filtering with model context
      const modelContext = currentNode.typeInfo.modelContext as any;
      
      // For union types, check if the target type is a valid choice
      if (modelContext.isUnion && modelContext.choices) {
        const validChoice = modelContext.choices.find((c: any) => 
          c.type === targetTypeName || c.elementType === targetTypeName
        );
        
        if (!validChoice) {
          // Type system knows this filter returns empty
          return { value: [], context };
        }
        
        // Filter based on the choice property
        const choiceProperty = validChoice.property;
        const filtered = input.filter(boxedItem => {
          const item = unbox(boxedItem);
          return item && typeof item === 'object' && choiceProperty in item;
        });
        
        return { value: filtered, context };
      }
    }
    */

    // Filter using ModelProvider if available, otherwise fall back to type info and runtime checks
    const filtered = await Promise.all(input.map(async boxedItem => {
      const item = unbox(boxedItem);
      
      // If we have a ModelProvider in context, use it for accurate type checking
      if (context.modelProvider && boxedItem.typeInfo) {
        const matchingType = context.modelProvider.ofType(boxedItem.typeInfo, targetTypeName as import('../types').TypeName);
        return matchingType !== undefined;
      }
      
      // Check if the box has specific type information (not just "Any")
      if (boxedItem.typeInfo && boxedItem.typeInfo.type !== 'Any') {
        // If we have specific type info, use it for accurate filtering
        return boxedItem.typeInfo.type === targetTypeName;
      }
      
      // For FHIR resources without typeInfo, try to get it from modelProvider
      if (context.modelProvider && item && typeof item === 'object' && 'resourceType' in item && typeof item.resourceType === 'string') {
        const typeInfo = await context.modelProvider.getType(item.resourceType);
        if (typeInfo) {
          const matchingType = context.modelProvider.ofType(typeInfo, targetTypeName as import('../types').TypeName);
          return matchingType !== undefined;
        }
        return false;
      }
      
      // Check primitive types
      switch (targetTypeName) {
        case 'String':
          return typeof item === 'string';
        case 'Boolean':
          return typeof item === 'boolean';
        case 'Integer':
          return typeof item === 'number' && Number.isInteger(item);
        case 'Decimal':
          return typeof item === 'number';
        case 'Date':
        case 'DateTime':
        case 'Time':
          // Simple check for date-like strings
          return typeof item === 'string' && !isNaN(Date.parse(item));
        default:
          // For complex types, check resourceType
          if (item && typeof item === 'object' && 'resourceType' in item) {
            return item.resourceType === targetTypeName;
          }
          return false;
      }
    }));
    
    // Filter out false results (map returns boolean for each item)
    const actualFiltered = input.filter((_, index) => filtered[index]);

    return { value: actualFiltered, context };
  }
};
