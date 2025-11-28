import { describe, it, expect } from 'bun:test';
import { parse } from '../../src/parser';
import { Analyzer } from '../../src/analyzer';
import { FHIRModelProvider } from '../../src/model-provider.node';
import { NodeType, type IdentifierNode, type BinaryNode } from '../../src/types';

describe('Type vs Identifier disambiguation', () => {
  it('does not treat mid-chain uppercase identifier as a type', async () => {
    const modelProvider = new FHIRModelProvider();
    await modelProvider.initialize();

    const parseResult = parse('Patient.name.Patient');
    if (parseResult.errors?.length) {
      throw new Error('Parse failed');
    }

    const patientType = await modelProvider.getType('Patient');
    const analyzer = new Analyzer(modelProvider);
    const result = await analyzer.analyze(parseResult.ast, {}, patientType);

    // Navigate to the rightmost identifier node (the trailing .Patient)
    const root = parseResult.ast as BinaryNode; // ((Patient.name).Patient)
    const right = root.right as IdentifierNode;
    expect(right.type === NodeType.Identifier).toBe(true);

    // Should not be treated as a type; property lookup fails → Any with warning
    expect(right.typeInfo?.type).toBe('Any');
    const messages = result.diagnostics.map(d => d.message);
    expect(messages.some(m => /Unknown property/i.test(m))).toBe(true);
  });

  it('treats head-of-chain type identifier correctly (Patient.name)', async () => {
    const modelProvider = new FHIRModelProvider();
    await modelProvider.initialize();

    const parseResult = parse('Patient.name');
    if (parseResult.errors?.length) {
      throw new Error('Parse failed');
    }

    const patientType = await modelProvider.getType('Patient');
    const analyzer = new Analyzer(modelProvider);
    const result = await analyzer.analyze(parseResult.ast, {}, patientType);

    // Right side should resolve via model provider to HumanName (collection)
    const right = (parseResult.ast as BinaryNode).right as IdentifierNode;
    expect(right.type).toBe(NodeType.Identifier);
    expect(result.type!.singleton).toBe(false);
    expect(result.type!.type).toBeDefined();
  });

  it('treats delimited uppercase identifier as a property name, not a type', async () => {
    const modelProvider = new FHIRModelProvider();
    await modelProvider.initialize();

    const parseResult = parse('Patient.name.`Patient`');
    if (parseResult.errors?.length) {
      throw new Error('Parse failed');
    }

    const patientType = await modelProvider.getType('Patient');
    const analyzer = new Analyzer(modelProvider);
    const result = await analyzer.analyze(parseResult.ast, {}, patientType);

    const right = (parseResult.ast as BinaryNode).right as IdentifierNode;
    expect(right.type).toBe(NodeType.Identifier);
    expect(right.name).toBe('Patient');
    expect(right.typeInfo?.type).toBe('Any');
    const messages = result.diagnostics.map(d => d.message);
    expect(messages.some(m => /Unknown property/i.test(m))).toBe(true);
  });
});
