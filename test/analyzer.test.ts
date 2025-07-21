import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { TypeAnalyzer, analyzeFHIRPath } from '../src/analyzer/analyzer';
import { ModelProvider } from '../src/analyzer/model-provider';
import { StaticSchemaRegistry } from '../src/analyzer/schemas';
import { AnalysisMode, type TypeRef } from '../src/analyzer/types';
import { testSchemas } from './test-schemas';

describe('TypeAnalyzer', () => {
  // Create schema registry with test FHIR schemas
  const registry = new StaticSchemaRegistry(testSchemas);
  const modelProvider = new ModelProvider(registry);

  const analyze = (expression: string, inputType?: TypeRef, mode: AnalysisMode = AnalysisMode.Lenient) => analyzeFHIRPath(expression, modelProvider, inputType, mode);
  
  describe('Literal analysis', () => {
    it('should analyze string literals', () => {
      const result = analyze("'hello'");
      expect(result.resultType).toBeDefined();
      expect(modelProvider.getTypeName(result.resultType!)).toBe('String');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze integer literals', () => {
      const result = analyze('42');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Integer');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze decimal literals', () => {
      const result = analyze('3.14');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Decimal');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze boolean literals', () => {
      const result = analyze('true');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Boolean');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze null as empty collection', () => {
      const result = analyze('{}');
      expect(result.resultType).toBeUndefined();
      expect(result.resultIsSingleton).toBe(false);
    });
  });
  
  describe('Property navigation', () => {
    it('should analyze simple property navigation', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('HumanName');
      expect(result.resultIsSingleton).toBe(false); // name is a collection
    });
    
    it('should analyze chained property navigation', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name.given', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('String');
      expect(result.resultIsSingleton).toBe(false); // given is a collection
    });
    
    it('should analyze singleton property navigation', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('birthDate', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Date');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should handle anonymous types', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('contact.name', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('HumanName');
      expect(result.resultIsSingleton).toBe(false); // contact is collection, name is singleton per contact
    });
    
    it('should report error for unknown property', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('unknownProperty', patientType, AnalysisMode.Strict);
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.severity).toBe('error');
      expect(result.diagnostics[0]?.message).toContain('unknownProperty');
    });
  });
  
  describe('Function analysis', () => {
    it('should analyze exists()', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name.exists()', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Boolean');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze count()', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name.count()', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Integer');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze first()', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name.first()', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('HumanName');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze where() with expression', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze("name.where(use = 'official')", patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('HumanName');
      expect(result.resultIsSingleton).toBe(false); // where returns collection
    });
    
    it('should analyze select() with expression', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name.select(given)', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('String');
      expect(result.resultIsSingleton).toBe(false); // select returns collection
    });
    
    it('should check singleton requirements', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze("name.startsWith('John')", patientType);
      
      // Now we get 2 errors: singleton requirement and type requirement
      expect(result.diagnostics).toHaveLength(2);
      expect(result.diagnostics.some(d => d.message.includes('singleton input'))).toBe(true);
      expect(result.diagnostics.some(d => d.message.includes('requires string input'))).toBe(true);
    });
  });
  
  describe('Operator analysis', () => {
    it('should analyze arithmetic operators', () => {
      const result = analyze('1 + 2');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Integer');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze mixed numeric types', () => {

      const result = analyze('1 + 2.5');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Decimal');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze comparison operators', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('birthDate > @2000-01-01', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Boolean');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze logical operators', () => {
      const result = analyze('true and false');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Boolean');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should analyze string concatenation', () => {
      const result = analyze("'hello' & ' world'");
      expect(modelProvider.getTypeName(result.resultType!)).toBe('String');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should check operator type compatibility', () => {
      const result = analyze("'hello' + 42");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toContain('cannot be applied to types');
    });
  });
  
  describe('Complex expressions', () => {
    it('should analyze the example from ADR', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze(
        "name.where(use = 'official').given.first()",
        patientType
      );
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('String');
      expect(result.resultIsSingleton).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      
      // Check intermediate types
      const ast = result.ast;
      expect(ast.resultType).toBeDefined();
      expect(ast.isSingleton).toBe(true);
    });
    
    it('should handle union types', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name | telecom', patientType);
      
      // Union of different types returns Any
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Any');
      expect(result.resultIsSingleton).toBe(false);
    });
    
    it('should handle type casting', () => {
      const result = analyze("'42' as Integer");
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Integer');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should handle membership test', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name is HumanName', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Boolean');
      expect(result.resultIsSingleton).toBe(false); // Same cardinality as input
    });
  });
  
  describe('Variable analysis', () => {
    it('should analyze $this as Any', () => {
      const result = analyze('$this');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Any');
    });
    
    it('should analyze $index as singleton Integer', () => {
      const result = analyze('$index');
      expect(result.resultIsSingleton).toBe(true);
    });
  });
  
  describe('Collection operations', () => {
    it('should analyze collection literals', () => {
      const result = analyze('{1, 2, 3}');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Integer');
      expect(result.resultIsSingleton).toBe(false);
    });
    
    it('should analyze indexing', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze('name[0]', patientType);
      
      expect(modelProvider.getTypeName(result.resultType!)).toBe('HumanName');
      expect(result.resultIsSingleton).toBe(true);
    });
    
    it('should check index type', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze("name['invalid']", patientType);
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toContain('integer');
    });
  });
  
  describe('Error handling', () => {
    it('should handle unknown functions', () => {
      const result = analyze('unknownFunction()');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toContain('Unknown function');
    });
    
    it('should handle empty input navigation', () => {
      const result = analyze('name');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.message).toContain('empty input');
    });
    
    it('should continue analysis after errors in lenient mode', () => {
      const patientType = modelProvider.resolveType('Patient');
      const result = analyze(
        'unknownProp.anotherProp', 
        patientType,
        AnalysisMode.Lenient
      );
      
      // We get 2 diagnostics - one for unknownProp, one for anotherProp on Any
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0]?.severity).toBe('warning');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Any');
    });
  });
  
  describe('Type propagation', () => {
    it('should propagate Any type', () => {
      const result = analyze("trace('debug').name");
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Any');
    });
    
    it('should handle functions returning Any', () => {
      const result = analyze('children().count()');
      expect(modelProvider.getTypeName(result.resultType!)).toBe('Integer');
      expect(result.resultIsSingleton).toBe(true);
    });
  });

  describe('TypeAnalyzer', () => {
    it('should analyze type analyzer', () => {
      const result = analyze('Patient.name.given.first().length()');
      expect(result.diagnostics).toHaveLength(0);

      const result2 = analyze('Patient.name.given.length()');
      expect(result2.diagnostics[0]).toMatchObject({
        message: "Function length requires singleton input",
        severity: 'error',
      });

      const result3 = analyze('Patient.birthDate.length()');
      expect(result3.diagnostics[0]).toMatchObject({
        message: "Function length requires string input, but got Date"
      });

      const result4 = analyze('Patient.name.given.first() + Patient.name.family.first()');
      console.log(result4.diagnostics);
    });
  });
});