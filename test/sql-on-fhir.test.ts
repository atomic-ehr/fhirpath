import { describe, it, expect } from 'bun:test';
import { registry } from '../src/registry';
import { getResourceKeyFunction } from '../src/operations/getResourceKey-function';
import { getReferenceKeyFunction } from '../src/operations/getReferenceKey-function';
import { box } from '../src/interpreter/boxing';
import { NodeType } from '../src/types';
import type { RuntimeContext, IdentifierNode } from '../src/types';
import { analyze } from '../src/index.node';
import { provideCompletions, CompletionKind } from '../src/completion-provider';

describe('SQL on FHIR Functions', () => {
  // Create a minimal runtime context for testing
  const createContext = (): RuntimeContext => ({
    input: [],
    focus: [],
    variables: {},
  });

  describe('getResourceKey', () => {
    describe('Registry', () => {
      it('should be registered in the registry', () => {
        expect(registry.isFunction('getResourceKey')).toBe(true);

        const func = registry.getFunction('getResourceKey');
        expect(func).toBeDefined();
        expect(func!.name).toBe('getResourceKey');
        expect(func!.category).toContain('SQL on FHIR');
      });

      it('should have correct signature', () => {
        const func = registry.getFunction('getResourceKey');
        expect(func!.signatures).toHaveLength(1);

        const sig = func!.signatures[0];
        expect(sig!.parameters).toHaveLength(0);
        expect(sig!.result).toEqual({ type: 'String', singleton: false });
      });
    });

    describe('Evaluation', () => {
      it('should return id from a FHIR resource', async () => {
        const patient = { resourceType: 'Patient', id: '123', name: [{ family: 'Smith' }] };
        const input = [box(patient)];
        const context = createContext();

        const result = await getResourceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('123');
      });

      it('should return empty for resource without id', async () => {
        const patient = { resourceType: 'Patient', name: [{ family: 'Smith' }] };
        const input = [box(patient)];
        const context = createContext();

        const result = await getResourceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(0);
      });

      it('should handle multiple resources', async () => {
        const resources = [
          { resourceType: 'Patient', id: 'p1' },
          { resourceType: 'Observation', id: 'o1' },
          { resourceType: 'Patient', id: 'p2' },
        ];
        const input = resources.map(r => box(r));
        const context = createContext();

        const result = await getResourceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(3);
        expect(result.value[0]!.value).toBe('p1');
        expect(result.value[1]!.value).toBe('o1');
        expect(result.value[2]!.value).toBe('p2');
      });

      it('should convert numeric id to string', async () => {
        const resource = { resourceType: 'Patient', id: 123 };
        const input = [box(resource)];
        const context = createContext();

        const result = await getResourceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('123');
        expect(typeof result.value[0]!.value).toBe('string');
      });

      it('should return empty for non-object input', async () => {
        const input = [box('string'), box(123), box(null)];
        const context = createContext();

        const result = await getResourceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(0);
      });
    });
  });

  describe('getReferenceKey', () => {
    describe('Registry', () => {
      it('should be registered in the registry', () => {
        expect(registry.isFunction('getReferenceKey')).toBe(true);

        const func = registry.getFunction('getReferenceKey');
        expect(func).toBeDefined();
        expect(func!.name).toBe('getReferenceKey');
        expect(func!.category).toContain('SQL on FHIR');
      });

      it('should have signature with optional resourceType parameter', () => {
        const func = registry.getFunction('getReferenceKey');
        expect(func!.signatures).toHaveLength(1);

        const sig = func!.signatures[0];
        expect(sig!.parameters).toHaveLength(1);
        expect(sig!.parameters[0]!.name).toBe('resourceType');
        expect(sig!.parameters[0]!.optional).toBe(true);
        expect(sig!.parameters[0]!.typeReference).toBe(true);
      });
    });

    describe('Evaluation - Relative References', () => {
      it('should extract id from relative reference', async () => {
        const reference = { reference: 'Patient/123' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('123');
      });

      it('should handle reference with display', async () => {
        const reference = { reference: 'Patient/456', display: 'John Smith' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('456');
      });
    });

    describe('Evaluation - Absolute References', () => {
      it('should extract id from absolute URL reference', async () => {
        const reference = { reference: 'http://example.org/fhir/Patient/789' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('789');
      });

      it('should handle URL with query parameters', async () => {
        const reference = { reference: 'http://example.org/fhir/Observation/obs1?_format=json' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('obs1');
      });
    });

    describe('Evaluation - URN References', () => {
      it('should handle urn:uuid references', async () => {
        const reference = { reference: 'urn:uuid:12345678-1234-1234-1234-123456789012' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('urn:uuid:12345678-1234-1234-1234-123456789012');
      });

      it('should handle urn:oid references', async () => {
        const reference = { reference: 'urn:oid:1.2.3.4.5' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('urn:oid:1.2.3.4.5');
      });
    });

    describe('Evaluation - Contained References', () => {
      it('should handle contained references (#id)', async () => {
        const reference = { reference: '#contained1' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('contained1');
      });
    });

    describe('Evaluation - Type Filtering', () => {
      it('should return id when resourceType matches', async () => {
        const reference = { reference: 'Patient/123' };
        const input = [box(reference)];
        const context = createContext();

        // Simulate passing Patient as type argument
        const typeArg: IdentifierNode = {
          type: NodeType.Identifier,
          name: 'Patient',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } }
        };

        const result = await getReferenceKeyFunction.evaluate(input, context, [typeArg], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(1);
        expect(result.value[0]!.value).toBe('123');
      });

      it('should return empty when resourceType does not match', async () => {
        const reference = { reference: 'Patient/123' };
        const input = [box(reference)];
        const context = createContext();

        // Simulate passing Observation as type argument (doesn't match Patient)
        const typeArg: IdentifierNode = {
          type: NodeType.Identifier,
          name: 'Observation',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 11 } }
        };

        const result = await getReferenceKeyFunction.evaluate(input, context, [typeArg], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(0);
      });

      it('should filter multiple references by type', async () => {
        const references = [
          { reference: 'Patient/p1' },
          { reference: 'Observation/o1' },
          { reference: 'Patient/p2' },
          { reference: 'Practitioner/pr1' },
        ];
        const input = references.map(r => box(r));
        const context = createContext();

        // Filter for Patient only
        const typeArg: IdentifierNode = {
          type: NodeType.Identifier,
          name: 'Patient',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } }
        };

        const result = await getReferenceKeyFunction.evaluate(input, context, [typeArg], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(2);
        expect(result.value[0]!.value).toBe('p1');
        expect(result.value[1]!.value).toBe('p2');
      });
    });

    describe('Evaluation - Edge Cases', () => {
      it('should return empty for reference without reference field', async () => {
        const reference = { display: 'Some display text' };
        const input = [box(reference)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(0);
      });

      it('should return empty for non-object input', async () => {
        const input = [box('string'), box(123)];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(0);
      });

      it('should handle empty input collection', async () => {
        const input: any[] = [];
        const context = createContext();

        const result = await getReferenceKeyFunction.evaluate(input, context, [], async () => ({ value: [], context }));

        expect(result.value).toHaveLength(0);
      });
    });
  });

  describe('Integration - getResourceKey and getReferenceKey', () => {
    it('should return matching keys for resource and reference', async () => {
      const patient = { resourceType: 'Patient', id: 'patient-123' };
      const reference = { reference: 'Patient/patient-123' };

      const context = createContext();

      // Get resource key
      const resourceKeyResult = await getResourceKeyFunction.evaluate(
        [box(patient)],
        context,
        [],
        async () => ({ value: [], context })
      );

      // Get reference key
      const referenceKeyResult = await getReferenceKeyFunction.evaluate(
        [box(reference)],
        context,
        [],
        async () => ({ value: [], context })
      );

      // Keys should match
      expect(resourceKeyResult.value[0]!.value).toBe(referenceKeyResult.value[0]!.value);
      expect(resourceKeyResult.value[0]!.value).toBe('patient-123');
    });
  });

  describe('Analyzer Integration', () => {
    it('should analyze getResourceKey() without errors', async () => {
      const result = await analyze('getResourceKey()');
      expect(result.diagnostics).toEqual([]);
    });

    it('should analyze getReferenceKey() without errors', async () => {
      const result = await analyze('subject.getReferenceKey()');
      expect(result.diagnostics).toEqual([]);
    });

    it('should analyze getReferenceKey(Patient) without errors', async () => {
      const result = await analyze('subject.getReferenceKey(Patient)');
      expect(result.diagnostics).toEqual([]);
    });

    it('should analyze chained expression with getResourceKey', async () => {
      const result = await analyze('entry.resource.getResourceKey()');
      expect(result.diagnostics).toEqual([]);
    });

    it('should analyze ViewDefinition-style expressions', async () => {
      // Typical SQL on FHIR ViewDefinition patterns
      const expressions = [
        'getResourceKey()',
        'subject.getReferenceKey()',
        'subject.getReferenceKey(Patient)',
        'performer.getReferenceKey(Practitioner)',
      ];

      for (const expr of expressions) {
        const result = await analyze(expr);
        expect(result.diagnostics).toEqual([]);
      }
    });
  });

  describe('Completion Provider Integration', () => {
    it('should include getResourceKey in function completions', async () => {
      const expression = 'Patient.';
      const cursorPosition = 8;

      const completions = await provideCompletions(expression, cursorPosition);

      const getResourceKeyCompletion = completions.find(c => c.label === 'getResourceKey');
      expect(getResourceKeyCompletion).toBeDefined();
      expect(getResourceKeyCompletion?.kind).toBe(CompletionKind.Function);
    });

    it('should include getReferenceKey in function completions', async () => {
      const expression = 'subject.';
      const cursorPosition = 8;

      const completions = await provideCompletions(expression, cursorPosition);

      const getReferenceKeyCompletion = completions.find(c => c.label === 'getReferenceKey');
      expect(getReferenceKeyCompletion).toBeDefined();
      expect(getReferenceKeyCompletion?.kind).toBe(CompletionKind.Function);
    });

    it('should show SQL on FHIR description in completion details', async () => {
      const expression = 'resource.';
      const cursorPosition = 9;

      const completions = await provideCompletions(expression, cursorPosition);

      const getResourceKeyCompletion = completions.find(c => c.label === 'getResourceKey');
      expect(getResourceKeyCompletion).toBeDefined();
      // The function should have detail mentioning joins (description is stored in detail)
      expect(getResourceKeyCompletion?.detail).toBeDefined();
      expect(getResourceKeyCompletion?.detail?.toLowerCase()).toContain('join');
    });
  });
});
