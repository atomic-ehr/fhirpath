import type { FunctionDefinition, FunctionEvaluator, ASTNode, RuntimeContext, NodeEvaluator } from '../types';
import type { FHIRPathValue } from '../interpreter/boxing';
import { box, unbox } from '../interpreter/boxing';
import { Errors } from '../errors';

const extensionEvaluator: FunctionEvaluator = async (
  input: FHIRPathValue[], 
  context: RuntimeContext, 
  args: ASTNode[],
  evaluator: NodeEvaluator
) => {
  // extension() function takes one argument - the URL to match
  if (args.length !== 1) {
    throw Errors.invalidOperation('extension() requires exactly one argument');
  }
  
  // Evaluate the URL argument
  const urlResult = await evaluator(args[0]!, input, context);
  if (urlResult.value.length !== 1) {
    throw Errors.invalidOperation('extension() URL argument must be a single value');
  }
  
  const firstValue = urlResult.value[0];
  if (!firstValue) {
    throw Errors.invalidOperation('extension() URL argument evaluated to null');
  }
  const urlToMatch = unbox(firstValue);
  if (typeof urlToMatch !== 'string') {
    throw Errors.invalidOperation('extension() URL argument must be a string');
  }
  
  const results: FHIRPathValue[] = [];
  
  // For each input item, look for extensions
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    
    // First check if this is a primitive value with extensions in primitiveElement
    if (boxedItem.primitiveElement?.extension) {
      const extensions = boxedItem.primitiveElement.extension;
      for (const ext of extensions) {
        if (ext && typeof ext === 'object' && 'url' in ext && ext.url === urlToMatch) {
          const boxedExt = box(ext, { type: 'Extension' as any, singleton: true });
          results.push(boxedExt);
        }
      }
    }
    
    // Then check for direct extension property on complex types
    if (item && typeof item === 'object' && 'extension' in item) {
      const extensions = (item as any).extension;
      if (Array.isArray(extensions)) {
        for (const ext of extensions) {
          if (ext && typeof ext === 'object' && 'url' in ext && ext.url === urlToMatch) {
            const boxedExt = box(ext, { type: 'Extension' as any, singleton: true });
            results.push(boxedExt);
          }
        }
      }
    }
  }
  
  return { value: results, context };
};

export const extensionFunction: FunctionDefinition & { evaluate: typeof extensionEvaluator } = {
  name: 'extension',
  category: ['navigation'],
  description: 'Returns extensions matching the specified URL',
  examples: [
    "Patient.birthDate.extension('http://hl7.org/fhir/StructureDefinition/patient-birthTime')",
    "Observation.extension('http://example.com/fhir/StructureDefinition/patient-age')"
  ],
  signatures: [
    {
      name: 'extension-by-url',
      parameters: [{ 
        name: 'url', 
        type: { type: 'String', singleton: true },
        expression: true
      }],
      input: { type: 'Any', singleton: false },
      result: { type: 'Extension' as any, singleton: false }
    }
  ],
  doesNotPropagateEmpty: false,
  evaluate: extensionEvaluator
};