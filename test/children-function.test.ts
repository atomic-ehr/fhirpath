import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { Analyzer } from '../src/analyzer';
import { FHIRModelProvider } from '../src/model-provider';
import { registry } from '../src/registry';
import { DiagnosticSeverity, type TypeInfo } from '../src/types';

describe('children() function', () => {
  describe('registration', () => {
    it('should be registered in the registry', () => {
      const childrenFunc = registry.getFunction('children');
      expect(childrenFunc).toBeDefined();
      expect(childrenFunc?.name).toBe('children');
      expect(childrenFunc?.category).toContain('navigation');
    });
  });

  describe('analyzer type inference', () => {
    it('should return Any collection when no model provider', () => {
      const analyzer = new Analyzer();
      const parseResult = parse('Patient.children()');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = analyzer.analyze(parseResult.ast);
      
      // Find the children function node
      const functionNode = (parseResult.ast as any).right;
      expect(functionNode.typeInfo).toBeDefined();
      expect(functionNode.typeInfo?.type).toBe('Any');
      expect(functionNode.typeInfo?.singleton).toBe(false);
    });

    it('should return union type when model provider has children', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const analyzer = new Analyzer(modelProvider);
      const parseResult = parse('Patient.children()');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const patientType = modelProvider.getType('Patient');
      const result = analyzer.analyze(parseResult.ast, {}, patientType);
      
      // Find the children function node
      const functionNode = (parseResult.ast as any).right;
      expect(functionNode.typeInfo).toBeDefined();
      expect(functionNode.typeInfo?.modelContext).toBeDefined();
      
      const modelContext = functionNode.typeInfo?.modelContext as any;
      expect(modelContext.isUnion).toBe(true);
      expect(modelContext.choices).toBeDefined();
      expect(Array.isArray(modelContext.choices)).toBe(true);
      expect(modelContext.choices.length).toBeGreaterThan(0);
    });
  });

  describe('getChildrenType implementation', () => {
    it('should return undefined for types with no children', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const stringType: TypeInfo = { type: 'String', singleton: true };
      const childrenType = modelProvider.getChildrenType(stringType);
      expect(childrenType).toBeUndefined();
    });

    it('should return union type for complex types', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const patientType = modelProvider.getType('Patient');
      expect(patientType).toBeDefined();
      
      const childrenType = modelProvider.getChildrenType(patientType!);
      expect(childrenType).toBeDefined();
      expect(childrenType?.singleton).toBe(false);
      expect(childrenType?.modelContext).toBeDefined();
      
      const modelContext = childrenType?.modelContext as any;
      expect(modelContext.isUnion).toBe(true);
      expect(modelContext.choices).toBeDefined();
      expect(Array.isArray(modelContext.choices)).toBe(true);
    });

    it('should deduplicate types in union', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const observationType = modelProvider.getType('Observation');
      expect(observationType).toBeDefined();
      
      const childrenType = modelProvider.getChildrenType(observationType!);
      expect(childrenType).toBeDefined();
      
      const modelContext = childrenType?.modelContext as any;
      const typeKeys = new Set<string>();
      
      for (const choice of modelContext.choices) {
        const key = `${choice.namespace || ''}.${choice.code}`;
        expect(typeKeys.has(key)).toBe(false); // Should not have duplicates
        typeKeys.add(key);
      }
    });
  });

  describe('type filtering validation', () => {
    it('should warn when ofType uses invalid type on children result', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const analyzer = new Analyzer(modelProvider);
      const parseResult = parse('Patient.children().ofType(Medication)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const patientType = modelProvider.getType('Patient');
      const result = analyzer.analyze(parseResult.ast, {}, patientType);
      
      const warnings = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
      expect(warnings.length).toBeGreaterThan(0);
      
      const typeFilterWarning = warnings.find(w => w.code === 'invalid-type-filter');
      expect(typeFilterWarning).toBeDefined();
      expect(typeFilterWarning?.message).toContain('Medication');
      expect(typeFilterWarning?.message).toContain('not present in the union type');
    });

    it('should not warn when ofType uses valid type on children result', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const analyzer = new Analyzer(modelProvider);
      const parseResult = parse('Patient.children().ofType(HumanName)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const patientType = modelProvider.getType('Patient');
      const result = analyzer.analyze(parseResult.ast, {}, patientType);
      
      const warnings = result.diagnostics.filter(d => 
        d.severity === DiagnosticSeverity.Warning && d.code === 'invalid-type-filter'
      );
      expect(warnings).toHaveLength(0);
    });

    it('should warn for invalid is operator on children result', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const analyzer = new Analyzer(modelProvider);
      // TODO: WE IGNORE CONTAINED INTENTIONALLY
      const parseResult = parse('Patient.children().where($this is Procedure)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const patientType = modelProvider.getType('Patient');
      const result = analyzer.analyze(parseResult.ast, {}, patientType);
      
      const warnings = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
      const typeTestWarning = warnings.find(w => w.code === 'invalid-type-test');
      expect(typeTestWarning).toBeDefined();
      expect(typeTestWarning?.message).toContain('Procedure');
      expect(typeTestWarning?.message).toContain('will always be false');
    });

    it('should warn for invalid as operator on children result', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const analyzer = new Analyzer(modelProvider);
      const parseResult = parse('Patient.children().select($this as Device)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const patientType = modelProvider.getType('Patient');
      const result = analyzer.analyze(parseResult.ast, {}, patientType);
      
      const warnings = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
      const typeCastWarning = warnings.find(w => w.code === 'invalid-type-cast');
      expect(typeCastWarning).toBeDefined();
      expect(typeCastWarning?.message).toContain('Device');
      expect(typeCastWarning?.message).toContain('may fail');
    });
  });
});