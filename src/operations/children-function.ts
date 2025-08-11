import type { FunctionDefinition, FunctionEvaluator, TypeInfo } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('children', 0, args.length);
  }
  
  const results: any[] = [];
  const modelProvider = context.modelProvider;
  
  // Process each item in the input collection
  // input is already an array, not an object with value property
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    
    if (item && typeof item === 'object') {
      // Get the parent type info if available
      let parentTypeInfo: TypeInfo | undefined;
      if (modelProvider && boxedItem.typeInfo) {
        parentTypeInfo = boxedItem.typeInfo;
      } else if (modelProvider && 'resourceType' in item && typeof item.resourceType === 'string') {
        // Try to get type info from resourceType
        parentTypeInfo = modelProvider.getType(item.resourceType);
      }
      
      // Collect all child properties
      for (const propertyName in item) {
        // Skip resourceType as it's not a child element in FHIRPath
        if (propertyName === 'resourceType') {
          continue;
        }
        
        // Skip primitive element properties (those starting with _)
        if (propertyName.startsWith('_')) {
          continue;
        }
        
        const value = item[propertyName];
        
        // Skip null/undefined values
        if (value === null || value === undefined) {
          continue;
        }
        
        // Get type info for this element from model provider
        let elementTypeInfo: TypeInfo | undefined;
        if (modelProvider && parentTypeInfo) {
          elementTypeInfo = modelProvider.getElementType(parentTypeInfo, propertyName);
        }
        
        // Get primitive element if it exists
        const primitiveElementName = `_${propertyName}`;
        const primitiveElement = (primitiveElementName in item) ? item[primitiveElementName] : undefined;
        
        if (Array.isArray(value)) {
          // Add each array element
          for (let i = 0; i < value.length; i++) {
            const elementValue = value[i];
            if (elementValue !== null && elementValue !== undefined) {
              const elementPrimitive = primitiveElement?.[i];
              // Make the type info singleton since it's a single element
              const singletonTypeInfo = elementTypeInfo ? { ...elementTypeInfo, singleton: true } : undefined;
              results.push(box(elementValue, singletonTypeInfo, elementPrimitive));
            }
          }
        } else {
          // Add single value - ensure it's marked as singleton
          const singletonTypeInfo = elementTypeInfo ? { ...elementTypeInfo, singleton: true } : undefined;
          results.push(box(value, singletonTypeInfo, primitiveElement));
        }
      }
    }
  }
  
  return { value: results, context };
};

export const childrenFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'children',
  category: ['navigation'],
  description: 'Returns all immediate child nodes of all items in the input collection',
  examples: [
    'Patient.children()',
    'Observation.children().ofType(CodeableConcept)'
  ],
  signatures: [{

    name: 'children',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: false }
  }],
  evaluate
};