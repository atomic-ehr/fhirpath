import { describe, it, expect } from 'bun:test';
import { evaluate } from '../../src/index.node';
import type { ModelProvider, TypeInfo, TypeName } from '../../src/types';

class TestModelProvider implements ModelProvider {
  async getType(typeName: string): Promise<TypeInfo | undefined> {
    const primitive: Record<string, TypeName> = {
      Boolean: 'Boolean',
      String: 'String',
      Integer: 'Integer',
      Decimal: 'Decimal',
      Date: 'Date',
      DateTime: 'DateTime',
      Time: 'Time',
      Any: 'Any',
    };
    const mapped = (primitive as Record<string, TypeName>)[typeName];
    if (mapped) {
      return { type: mapped, singleton: true, namespace: 'FHIR', name: typeName };
    }
    // Model types: return Any with name set for ofType/is checks
    return {
      type: 'Any',
      singleton: true,
      namespace: 'FHIR',
      name: typeName,
      modelContext: { path: typeName, schemaHierarchy: [] },
    };
  }

  async getElementType(parentType: TypeInfo, propertyName: string): Promise<TypeInfo | undefined> {
    // Minimal mapping for common props used in tests
    if ((parentType.name === 'Patient' || parentType.name === 'HumanName') && propertyName === 'name') {
      return { type: 'Any', singleton: false, namespace: 'FHIR', name: 'HumanName' };
    }
    if (parentType.name === 'HumanName' && propertyName === 'given') {
      return { type: 'String', singleton: false };
    }
    return undefined;
  }

  ofType(type: TypeInfo, typeName: TypeName): TypeInfo | undefined {
    if (type.type === typeName || type.name === typeName) {
      return type;
    }
    return undefined;
  }

  getElementNames(_parentType: TypeInfo): string[] {
    return [];
  }

  async getChildrenType(_parentType: TypeInfo): Promise<TypeInfo | undefined> {
    return undefined;
  }

  async getElements(_typeName: string): Promise<Array<{ name: string; type: string; documentation?: string }>> {
    return [];
  }

  async getResourceTypes(): Promise<string[]> {
    return ['Patient', 'Observation'];
  }

  async getComplexTypes(): Promise<string[]> {
    return ['HumanName'];
  }

  async getPrimitiveTypes(): Promise<string[]> {
    return ['String', 'Boolean', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time'];
  }
}

describe('index.evaluate boxing and variable handling', () => {
  const modelProvider = new TestModelProvider();
  const patient = {
    resourceType: 'Patient',
    name: [
      { use: 'official', given: ['John', 'J.'] },
      { use: 'usual', given: ['Johnny'] },
    ],
  } as const;

  it('parity: root vs %p for is(Patient)', async () => {
    const root = await evaluate('is(Patient)', { input: patient, modelProvider });
    const viaVar = await evaluate('%p.is(Patient)', { input: patient, variables: { p: patient }, modelProvider });
    expect(root).toEqual([true]);
    expect(viaVar).toEqual([true]);
  });

  it('parity: collection ofType(Patient).count() root vs %items', async () => {
    const items = [patient, { resourceType: 'Observation', code: { text: 'obs' } }];
    const root = await evaluate('ofType(Patient).count()', { input: items, modelProvider });
    const viaVar = await evaluate('%items.ofType(Patient).count()', { input: items, variables: { items }, modelProvider });
    expect(root).toEqual([1]);
    expect(viaVar).toEqual([1]);
  });

  it('navigation: %p.name.given equals name.given', async () => {
    const root = await evaluate('name.given', { input: patient, modelProvider });
    const viaVar = await evaluate('%p.name.given', { input: patient, variables: { p: patient }, modelProvider });
    expect(viaVar).toEqual(root);
  });

  it('primitive variable unchanged: %x.is(Integer) true; %x.is(Patient) false', async () => {
    const res1 = await evaluate('%x.is(Integer)', { variables: { x: 5 }, modelProvider });
    const res2 = await evaluate('%x.is(Patient)', { variables: { x: 5 }, modelProvider });
    expect(res1).toEqual([true]);
    expect(res2).toEqual([false]);
  });
});
