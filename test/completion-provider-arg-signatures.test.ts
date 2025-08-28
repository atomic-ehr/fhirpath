import { describe, it, expect, beforeAll } from 'bun:test';
import { provideCompletions } from '../src/completion-provider';
import { registry } from '../src/registry';
import type { FunctionDefinition, TypeInfo, ModelProvider } from '../src/types';

// Minimal ModelProvider stub for tests
class StubModelProvider implements ModelProvider {
  async getType(typeName: string): Promise<TypeInfo | undefined> {
    return { type: 'Any', singleton: true, name: typeName } as TypeInfo;
  }
  async getElementType(parentType: TypeInfo, propertyName: string): Promise<TypeInfo | undefined> {
    return { type: 'Any', singleton: true, name: propertyName } as TypeInfo;
  }
  ofType(type: TypeInfo, typeName: any): TypeInfo | undefined {
    return { type: typeName, singleton: true } as TypeInfo;
  }
  getElementNames(_parentType: TypeInfo): string[] {
    return ['id', 'name'];
  }
  async getChildrenType(_parentType: TypeInfo): Promise<TypeInfo | undefined> {
    return { type: 'Any', singleton: false } as TypeInfo;
  }
  async getElements(typeName: string): Promise<Array<{ name: string; type: string; documentation?: string }>> {
    // Provide a couple of known Patient-like properties
    if (typeName === 'Patient') {
      return [
        { name: 'id', type: 'String' },
        { name: 'name', type: 'HumanName' },
      ];
    }
    return [
      { name: 'id', type: 'String' },
    ];
  }
  async getResourceTypes(): Promise<string[]> {
    return ['Patient', 'Observation'];
  }
  async getComplexTypes(): Promise<string[]> {
    return ['HumanName'];
  }
  async getPrimitiveTypes(): Promise<string[]> {
    return ['String', 'Integer'];
  }
}

const modelProvider = new StubModelProvider();

describe('CompletionProvider - signature-driven argument completions', () => {
  beforeAll(() => {
    // Register a test function with overloads where only the second signature
    // expects a type reference at the first argument.
    const overloadTypeRef: FunctionDefinition = {
      name: 'overloadTypeRef',
      category: ['test'],
      description: 'test function with overload expecting type reference',
      examples: [],
      signatures: [
        {
          name: 'overloadTypeRef',
          input: { type: 'Any', singleton: true },
          parameters: [
            { name: 'x', type: { type: 'Any', singleton: true } },
          ],
          result: { type: 'Any', singleton: true },
        },
        {
          name: 'overloadTypeRef',
          input: { type: 'Any', singleton: true },
          parameters: [
            { name: 't', type: { type: 'Any', singleton: true }, typeReference: true },
          ],
          result: { type: 'Any', singleton: true },
        },
      ],
      // Not executed in completions
      evaluate: async () => ({ value: [], context: { input: [], focus: [], variables: {} } as any }),
    };

    // Register a test lambda-like function where the parameter is an expression (lambda),
    // but the name is NOT in the current hardcoded list.
    const signatureLambda: FunctionDefinition = {
      name: 'signatureLambda',
      category: ['test'],
      description: 'test lambda parameter discovered via signature',
      examples: [],
      signatures: [
        {
          name: 'signatureLambda',
          input: { type: 'Any', singleton: false },
          parameters: [
            { name: 'predicate', type: { type: 'Boolean', singleton: true }, expression: true },
          ],
          result: { type: 'Any', singleton: false },
        },
      ],
      evaluate: async () => ({ value: [], context: { input: [], focus: [], variables: {} } as any }),
    };

    registry.registerFunction(overloadTypeRef);
    registry.registerFunction(signatureLambda);
  });

  it('suggests type names if any overload expects typeReference for the argument', async () => {
    const expr = 'overloadTypeRef(';
    const completions = await provideCompletions(expr, expr.length, {
      modelProvider,
    });

    // Expect at least one Type completion (e.g., a resource or primitive)
    const typeItems = completions.filter(c => c.kind === 'type');
    expect(typeItems.length > 0).toBe(true);
    // Sanity check: contains a known type
    const labels = new Set(typeItems.map(i => i.label));
    expect(labels.has('Patient') || labels.has('String')).toBe(true);
  });

  it('suggests element properties for lambda parameters discovered via signature (not by name)', async () => {
    // Input element type is Patient[] so lambda body should see Patient properties
    const inputType: TypeInfo = { type: 'Any', singleton: false, name: 'Patient' } as TypeInfo;
    const expr = 'signatureLambda(';
    const completions = await provideCompletions(expr, expr.length, {
      modelProvider,
      inputType,
    });

    const propertyItems = completions.filter(c => c.kind === 'property');
    // Should include properties like 'id' or 'name' from Patient
    const labels = new Set(propertyItems.map(i => i.label));
    expect(labels.has('id') || labels.has('name')).toBe(true);
  });
});
