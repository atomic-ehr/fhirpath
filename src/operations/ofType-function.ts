import type { FunctionDefinition, RuntimeContext, ASTNode, TypeInfo } from '../types';
import { Errors } from '../errors';
import type { NodeEvaluator } from '../types';
import type { FHIRPathValue } from '../boxing';
import { unbox } from '../boxing';
import { isIdentifierNode, isFunctionNode } from '../types';
import { NodeType } from '../types';

export const ofTypeFunction: FunctionDefinition = {
  name: 'ofType',
  category: ['type'],
  description: 'Filters input collection to include only items of the specified type',
  examples: [
    'Observation.value.ofType(Quantity)',
    'Patient.deceased.ofType(Boolean)'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { 
        name: 'type', 
        type: { type: 'String', singleton: true },
        expression: false
      }
    ],
    result: 'inputType'
  },
  evaluate(input: FHIRPathValue[], context: RuntimeContext, args: ASTNode[], evaluator: NodeEvaluator) {
    if (args.length !== 1) {
      throw Errors.invalidOperation('ofType requires exactly one argument');
    }

    const typeArg = args[0]!;
    
    // Extract type name from the argument
    let targetTypeName: string;
    if (isIdentifierNode(typeArg)) {
      targetTypeName = typeArg.name;
    } else if (typeArg.type === NodeType.TypeOrIdentifier) {
      targetTypeName = (typeArg as any).name;
    } else if (typeArg.type === NodeType.TypeReference) {
      targetTypeName = (typeArg as any).name;
    } else if (isFunctionNode(typeArg) && isIdentifierNode(typeArg.name)) {
      // Handle cases like ofType(Patient())
      targetTypeName = typeArg.name.name;
    } else {
      throw Errors.invalidOperation(`ofType() requires a type name as argument, got ${typeArg.type}`);
    }

    // If we have typeInfo from the analyzer (with ModelProvider), use it
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

    // Basic type filtering without ModelProvider
    // This will likely give incorrect results for choice types
    const filtered = input.filter(boxedItem => {
      const item = unbox(boxedItem);
      
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
    });

    return { value: filtered, context };
  }
};