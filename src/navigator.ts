import type { ModelProvider, TypeInfo, TypeName } from './types';
import { box, type FHIRPathValue } from './boxing';

interface ChoiceHit {
  readonly value: any;
  readonly typeInfo: TypeInfo;
  readonly primitiveElement?: any;
}

function getPrimitiveElement(item: Record<string, unknown>, prop: string): any | undefined {
  const primitiveElementName = `_${prop}`;
  return Object.prototype.hasOwnProperty.call(item, primitiveElementName)
    ? (item as any)[primitiveElementName]
    : undefined;
}

async function maybeParseTemporal(
  value: any,
  expected: TypeInfo | undefined,
  modelProvider?: ModelProvider
): Promise<any> {
  if (!modelProvider || !expected || typeof value !== 'string') {
    return value;
  }
  if (expected.type === 'Date' || expected.type === 'DateTime' || expected.type === 'Time') {
    const { parseTemporalLiteral } = await import('./temporal');
    return parseTemporalLiteral('@' + value);
  }
  return value;
}

async function reboxResource(
  value: any,
  singleton: boolean,
  modelProvider?: ModelProvider
): Promise<FHIRPathValue> {
  let resourceTypeInfo: TypeInfo | undefined;
  if (modelProvider && typeof value?.resourceType === 'string') {
    resourceTypeInfo = await modelProvider.getType(value.resourceType);
    if (resourceTypeInfo) {
      resourceTypeInfo = { ...resourceTypeInfo, singleton };
    }
  }
  if (!resourceTypeInfo) {
    // Default to 'Any' type when no provider or type info not found
    resourceTypeInfo = { type: 'Any', singleton };
  }
  return box(value, resourceTypeInfo);
}

async function detectChoiceValues(
  item: Record<string, unknown>,
  base: string,
  modelProvider?: ModelProvider
): Promise<ChoiceHit[]> {
  // Detect properties like baseXxx where Xxx is a type suffix
  const possible = Object.keys(item).filter((k) => k.startsWith(base) && k !== base && k.length > base.length);
  if (possible.length === 0) {
    return [];
  }
  const hits: ChoiceHit[] = [];
  for (const choiceProp of possible) {
    const value = (item as any)[choiceProp];
    if (value === null || value === undefined) {
      continue;
    }
    const choiceName = choiceProp.substring(base.length);
    const primitiveElement = getPrimitiveElement(item, choiceProp);
    let choiceType: TypeInfo | undefined;
    if (modelProvider) {
      // Ask model provider for precise type if available; fallback to using suffix as TypeName
      const providerType = await modelProvider.getType(choiceName);
      if (providerType) {
        choiceType = providerType;
      }
    }
    if (!choiceType) {
      choiceType = { type: choiceName as TypeName, singleton: !Array.isArray(value) };
    } else {
      choiceType = { ...choiceType, singleton: !Array.isArray(value) };
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        hits.push({ value: v, typeInfo: { ...choiceType, singleton: true }, primitiveElement });
      }
    } else {
      hits.push({ value, typeInfo: choiceType, primitiveElement });
    }
  }
  return hits;
}

export { getPrimitiveElement, maybeParseTemporal, reboxResource, detectChoiceValues };

