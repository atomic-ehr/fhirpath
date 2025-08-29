import { describe, it, expect } from 'bun:test';
import { getPrimitiveElement, detectChoiceValues, maybeParseTemporal, reboxResource } from '../../src/interpreter/navigator';
import type { ModelProvider, TypeInfo, TypeName } from '../../src/types';

function makeProvider(map: Record<string, TypeName>): ModelProvider {
  return {
    async getType(typeName: string): Promise<TypeInfo | undefined> {
      const t = map[typeName];
      if (!t) {
        return undefined;
      }
      return { type: t, singleton: true };
    },
    async getElementType(): Promise<TypeInfo | undefined> { return undefined; },
    ofType(type: TypeInfo, typeName: TypeName): TypeInfo | undefined {
      return type.type === typeName ? type : undefined;
    },
    getElementNames(): string[] { return []; },
    async getChildrenType(): Promise<TypeInfo | undefined> { return undefined; },
    async getElements(): Promise<Array<{name: string; type: string; documentation?: string}>> { return []; },
    async getResourceTypes(): Promise<string[]> { return []; },
    async getComplexTypes(): Promise<string[]> { return []; },
    async getPrimitiveTypes(): Promise<string[]> { return []; },
  };
}

describe('navigator helpers', () => {
  it('getPrimitiveElement returns _{prop} when present', () => {
    const obj = { valueString: 'x', _valueString: { extension: [{ url: 'u' }] } };
    const pe = getPrimitiveElement(obj, 'valueString');
    expect(pe).toBeDefined();
    expect(pe.extension?.length).toBe(1);
  });

  it('detectChoiceValues finds choice properties and preserves primitive elements', async () => {
    const obj = {
      valueString: 'hello',
      _valueString: { id: 'pe', extension: [{ url: 'ext' }] },
      valueQuantity: { value: 1, unit: 'mg' },
      nonChoice: true,
    } as Record<string, unknown>;
    const provider = makeProvider({ String: 'String', Quantity: 'Quantity' });
    const hits = await detectChoiceValues(obj, 'value', provider);
    const names = hits.map(h => h.typeInfo.type).sort();
    expect(names).toEqual(['Quantity', 'String']);
    const stringHit = hits.find(h => h.typeInfo.type === 'String');
    expect(stringHit?.primitiveElement?.id).toBe('pe');
  });

  it('reboxResource uses resourceType and singleton correctly (without provider)', async () => {
    const patient = { resourceType: 'Patient', id: 'p1' };
    const boxed = await reboxResource(patient, true, undefined);
    expect(boxed.typeInfo?.type).toBe('Any');
    expect(boxed.typeInfo?.singleton).toBe(true);
  });

  it('maybeParseTemporal parses Date when provider present and expected is temporal', async () => {
    const provider = makeProvider({});
    const expected: TypeInfo = { type: 'Date', singleton: true };
    const input = '2024-01-02';
    const out = await maybeParseTemporal(input, expected, provider);
    expect(typeof out).toBe('object');
    // minimal sanity check: parsed object should not equal original string
    expect(out).not.toBe(input);
  });
});

