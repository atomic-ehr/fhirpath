import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { Analyzer } from '../src/analyzer';
import { FHIRModelProvider } from '../src/model-provider';
import type { TypeInfo } from '../src/types';

describe('System Variable Type Delegation', () => {
  describe('$this in filter functions', () => {
    it('should get correct type for $this in where', async () => {
      const analyzer = new Analyzer();
      const parseResult = parse('(1 | 2 | 3).where($this > 2)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast);
      
      // Find the $this variable node
      const whereFunc = (parseResult.ast as any).right;
      const comparison = whereFunc.arguments[0];
      const thisVar = comparison.left;
      
      expect(thisVar.type).toBe('Variable');
      expect(thisVar.name).toBe('$this');
      expect(thisVar.typeInfo).toBeDefined();
      expect(thisVar.typeInfo?.type).toBe('Integer');
      expect(thisVar.typeInfo?.singleton).toBe(true);
    });

    it('should propagate union type to $this in where with children()', async () => {
      const modelProvider = new FHIRModelProvider();
      await modelProvider.initialize();
      
      const analyzer = new Analyzer(modelProvider);
      const parseResult = parse('Patient.children().where($this is HumanName)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const patientType = modelProvider.getTypeFromCache('Patient');
      const result = await analyzer.analyze(parseResult.ast, {}, patientType);
      
      // Find the $this variable node
      const whereFunc = (parseResult.ast as any).right;
      const membershipTest = whereFunc.arguments[0];
      const thisVar = membershipTest.expression;
      
      expect(thisVar.type).toBe('Variable');
      expect(thisVar.name).toBe('$this');
      expect(thisVar.typeInfo).toBeDefined();
      
      // $this should have the union type from children()
      const typeInfo = thisVar.typeInfo as TypeInfo;
      expect(typeInfo.modelContext).toBeDefined();
      const modelContext = typeInfo.modelContext as any;
      expect(modelContext.isUnion).toBe(true);
      expect(Array.isArray(modelContext.choices)).toBe(true);
      
      // Should contain HumanName in the union
      const hasHumanName = modelContext.choices.some((c: any) => 
        c.type === 'HumanName' || c.code === 'HumanName'
      );
      expect(hasHumanName).toBe(true);
    });

    it('should provide $index in where expressions', async () => {
      const analyzer = new Analyzer();
      const parseResult = parse('(1 | 2 | 3).where($index < 2)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast);
      
      // Find the $index variable node
      const whereFunc = (parseResult.ast as any).right;
      const comparison = whereFunc.arguments[0];
      const indexVar = comparison.left;
      
      expect(indexVar.type).toBe('Variable');
      expect(indexVar.name).toBe('$index');
      expect(indexVar.typeInfo).toBeDefined();
      expect(indexVar.typeInfo?.type).toBe('Integer');
      expect(indexVar.typeInfo?.singleton).toBe(true);
    });
  });

  describe('$total in aggregate', () => {
    it('should get init type for $total when init provided', async () => {
      const analyzer = new Analyzer();
      const parseResult = parse('(1 | 2 | 3).aggregate($this + $total, 0)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast);
      
      // Find the $total variable node
      const aggregateFunc = (parseResult.ast as any).right;
      const addition = aggregateFunc.arguments[0];
      const totalVar = addition.right;
      
      expect(totalVar.type).toBe('Variable');
      expect(totalVar.name).toBe('$total');
      expect(totalVar.typeInfo).toBeDefined();
      expect(totalVar.typeInfo?.type).toBe('Integer');
      expect(totalVar.typeInfo?.singleton).toBe(true);
    });

    it('should infer $total type from aggregator when no init', async () => {
      const analyzer = new Analyzer();
      const parseResult = parse('(1 | 2 | 3).aggregate($this + $total)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast);
      
      // Find the $total variable node
      const aggregateFunc = (parseResult.ast as any).right;
      const addition = aggregateFunc.arguments[0];
      const totalVar = addition.right;
      
      expect(totalVar.type).toBe('Variable');
      expect(totalVar.name).toBe('$total');
      expect(totalVar.typeInfo).toBeDefined();
      // Type inference from aggregator expression
      expect(totalVar.typeInfo?.type).toBe('Integer');
    });
  });

  describe('Nested contexts', () => {
    it('should handle nested where expressions', async () => {
      const analyzer = new Analyzer();
      const parseResult = parse('((1 | 2) | (3 | 4)).where($this.where($this > 2).exists())');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast);
      
      // The outer where and inner where should each have their own $this context
      // This test verifies that contexts are properly saved and restored
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should restore previous context after function', async () => {
      const analyzer = new Analyzer();
      const parseResult = parse('(1 | 2 | 3).select($this + (4 | 5).where($this > 4).first())');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast);
      
      // After the inner where(), $this should refer back to the select's context
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('User variables remain separate', () => {
    it('should keep user variables separate from system variables', async () => {
      const analyzer = new Analyzer();
      const userVars = { myVar: 42 };
      const parseResult = parse('(1 | 2 | 3).where($this > %myVar)');
      if (parseResult.errors?.length) {
        throw new Error('Parse failed');
      }
      
      const result = await analyzer.analyze(parseResult.ast, userVars);
      
      // Should have no errors - both $this and %myVar should be recognized
      expect(result.diagnostics).toHaveLength(0);
      
      // Find the variables
      const whereFunc = (parseResult.ast as any).right;
      const comparison = whereFunc.arguments[0];
      const thisVar = comparison.left;
      const userVar = comparison.right;
      
      expect(thisVar.typeInfo?.type).toBe('Integer'); // From collection
      expect(userVar.typeInfo?.type).toBe('Integer'); // From user variable value
    });
  });
});