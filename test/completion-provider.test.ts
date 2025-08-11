import { describe, it, expect, beforeAll } from 'bun:test';
import { provideCompletions, CompletionKind } from '../src/completion-provider';
import type { CompletionItem, CompletionOptions } from '../src/completion-provider';
import type { TypeInfo, ModelProvider } from '../src/types';
import { getInitializedModelProvider } from './model-provider-singleton';
import type { FHIRModelProvider } from '../src/model-provider';

describe('Completion Provider', () => {
  let modelProvider: FHIRModelProvider;
  
  beforeAll(async () => {
    // Use the singleton FHIRModelProvider
    modelProvider = await getInitializedModelProvider();
    
    // Load types that will be used in tests
    // These need to be cached for the synchronous analyzer to recognize them
    await Promise.all([
      modelProvider.getSchema('Patient'),
      modelProvider.getSchema('HumanName')
    ]);
  });
  
  describe('identifier completions (after dot)', () => {
    it('should provide property completions for known type', async () => {
      const expression = 'Patient.';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have properties
      const nameCompletion = completions.find(c => c.label === 'name');
      expect(nameCompletion).toBeDefined();
      expect(nameCompletion?.kind).toBe(CompletionKind.Property);
      expect(nameCompletion?.detail).toBe('HumanName[]');
      
      // Should have functions
      const whereCompletion = completions.find(c => c.label === 'where');
      expect(whereCompletion).toBeDefined();
      expect(whereCompletion?.kind).toBe(CompletionKind.Function);
    });
    
    it('should provide function completions without type info', async () => {
      const expression = 'something.';
      const cursorPosition = 10;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should still have common functions
      const whereCompletion = completions.find(c => c.label === 'where');
      expect(whereCompletion).toBeDefined();
      expect(whereCompletion?.kind).toBe(CompletionKind.Function);
      
      const selectCompletion = completions.find(c => c.label === 'select');
      expect(selectCompletion).toBeDefined();
    });
    
    it('should provide type-specific functions for strings', async () => {
      const expression = '"hello".';
      const cursorPosition = 8;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should have string-specific functions
      const lengthCompletion = completions.find(c => c.label === 'length');
      expect(lengthCompletion).toBeDefined();
      expect(lengthCompletion?.kind).toBe(CompletionKind.Function);
      
      const startsWithCompletion = completions.find(c => c.label === 'startsWith');
      expect(startsWithCompletion).toBeDefined();
    });
  });
  
  describe('operator completions (between expressions)', () => {
    it('should provide arithmetic operators for numbers', async () => {
      const expression = '5 ';
      const cursorPosition = 2;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should have arithmetic operators
      const plusCompletion = completions.find(c => c.label === '+');
      expect(plusCompletion).toBeDefined();
      expect(plusCompletion?.kind).toBe(CompletionKind.Operator);
      
      const divCompletion = completions.find(c => c.label === 'div');
      expect(divCompletion).toBeDefined();
      
      // Should have comparison operators
      const equalCompletion = completions.find(c => c.label === '=');
      expect(equalCompletion).toBeDefined();
    });
    
    it('should provide string operators for strings', async () => {
      const expression = '"hello" ';
      const cursorPosition = 8;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should have string concatenation
      const plusCompletion = completions.find(c => c.label === '+');
      expect(plusCompletion).toBeDefined();
      
      // Should have string contains
      const tildeCompletion = completions.find(c => c.label === '~');
      expect(tildeCompletion).toBeDefined();
    });
    
    it('should provide boolean operators for booleans', async () => {
      const expression = 'true ';
      const cursorPosition = 5;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should have logical operators
      const andCompletion = completions.find(c => c.label === 'and');
      expect(andCompletion).toBeDefined();
      expect(andCompletion?.kind).toBe(CompletionKind.Operator);
      
      const orCompletion = completions.find(c => c.label === 'or');
      expect(orCompletion).toBeDefined();
    });
  });
  
  describe('type completions (after is/as/ofType)', () => {
    it('should provide type completions after is with model provider', async () => {
      const expression = 'value is ';
      const cursorPosition = 9;
      const options: CompletionOptions = {
        modelProvider: modelProvider
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have primitive types
      const stringType = completions.find(c => c.label === 'String');
      expect(stringType).toBeDefined();
      expect(stringType?.kind).toBe(CompletionKind.Type);
      
      const integerType = completions.find(c => c.label === 'Integer');
      expect(integerType).toBeDefined();
      
      // Should have complex types
      const codingType = completions.find(c => c.label === 'Coding');
      expect(codingType).toBeDefined();
    });
    
    it('should provide no type completions after is without model provider', async () => {
      const expression = 'value is ';
      const cursorPosition = 9;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should have no type completions without model provider
      const typeCompletions = completions.filter(c => c.kind === CompletionKind.Type);
      expect(typeCompletions).toHaveLength(0);
    });
    
    it.skip('should provide resource types for ofType with modelProvider', async () => {
      const expression = 'Bundle.entry.resource.ofType(';
      const cursorPosition = 30;
      const options: CompletionOptions = {
        modelProvider: modelProvider
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have resource types
      const patientType = completions.find(c => c.label === 'Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.kind).toBe(CompletionKind.Type);
      
      const observationType = completions.find(c => c.label === 'Observation');
      expect(observationType).toBeDefined();
    });
  });
  
  describe('argument completions (in function arguments)', () => {
    it('should provide variable completions in function arguments with context', async () => {
      const expression = 'where(';
      const cursorPosition = 6;
      const options: CompletionOptions = {
        // Simulate lambda context with system variables
        variables: { '$this': {}, '$index': 0 }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have $this variable when in context
      const thisVar = completions.find(c => c.label === '$this');
      expect(thisVar).toBeDefined();
      expect(thisVar?.kind).toBe(CompletionKind.Variable);
      
      // Should have $index variable when in context
      const indexVar = completions.find(c => c.label === '$index');
      expect(indexVar).toBeDefined();
    });
    
    it('should not provide system variables without context', async () => {
      const expression = 'where(';
      const cursorPosition = 6;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should NOT have system variables without context
      const thisVar = completions.find(c => c.label === '$this');
      expect(thisVar).toBeUndefined();
      
      const indexVar = completions.find(c => c.label === '$index');
      expect(indexVar).toBeUndefined();
    });
    
    it('should provide user variables in arguments', async () => {
      const expression = 'where(';
      const cursorPosition = 6;
      const options: CompletionOptions = {
        variables: { myVar: 'test', count: 5 }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have user variables with % prefix
      const myVarCompletion = completions.find(c => c.label === '%myVar');
      expect(myVarCompletion).toBeDefined();
      expect(myVarCompletion?.kind).toBe(CompletionKind.Variable);
      
      const countCompletion = completions.find(c => c.label === '%count');
      expect(countCompletion).toBeDefined();
    });
    
    it('should provide properties in lambda function context', async () => {
      const expression = 'Patient.name.where(';
      const cursorPosition = 19;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have properties of name (HumanName)
      const useCompletion = completions.find(c => c.label === 'use');
      expect(useCompletion).toBeDefined();
      expect(useCompletion?.kind).toBe(CompletionKind.Property);
      
      const familyCompletion = completions.find(c => c.label === 'family');
      expect(familyCompletion).toBeDefined();
    });
  });
  
  describe('index completions (in brackets)', () => {
    it('should provide index completions in brackets', async () => {
      const expression = 'Patient[';
      const cursorPosition = 8;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should have index functions from registry
      const firstFunc = completions.find(c => c.label === 'first()');
      expect(firstFunc).toBeDefined();
      expect(firstFunc?.kind).toBe(CompletionKind.Function);
      
      const lastFunc = completions.find(c => c.label === 'last()');
      expect(lastFunc).toBeDefined();
      expect(lastFunc?.kind).toBe(CompletionKind.Function);
    });
    
    it('should provide index variable when in context', async () => {
      const expression = 'Patient[';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        variables: { '$index': 0 }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should have $index variable when in context
      const indexVar = completions.find(c => c.label === '$index');
      expect(indexVar).toBeDefined();
      expect(indexVar?.kind).toBe(CompletionKind.Variable);
    });
  });
  
  describe('filtering and ranking', () => {
    it('should filter completions by partial text', async () => {
      const expression = 'Patient.na';
      const cursorPosition = 10;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should only have items starting with 'na'
      const nameCompletion = completions.find(c => c.label === 'name');
      expect(nameCompletion).toBeDefined();
      
      // Should not have items not starting with 'na'
      const birthDateCompletion = completions.find(c => c.label === 'birthDate');
      expect(birthDateCompletion).toBeUndefined();
    });
    
    it('should rank completions by kind', async () => {
      const expression = 'Patient.';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Properties should come before functions
      const firstProperty = completions.findIndex(c => c.kind === CompletionKind.Property);
      const firstFunction = completions.findIndex(c => c.kind === CompletionKind.Function);
      
      expect(firstProperty).toBeGreaterThanOrEqual(0);
      expect(firstFunction).toBeGreaterThanOrEqual(0);
      expect(firstProperty).toBeLessThan(firstFunction);
    });
    
    it('should limit completions when maxCompletions is set', async () => {
      const expression = 'Patient.';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true },
        maxCompletions: 5
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      expect(completions.length).toBeLessThanOrEqual(5);
    });
  });
  
  describe('edge cases', () => {
    it('should return empty array for invalid expression', async () => {
      const expression = '...';
      const cursorPosition = 3;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      expect(completions).toEqual([]);
    });
    
    it('should handle empty expression', async () => {
      const expression = '';
      const cursorPosition = 0;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should provide initial completions
      expect(completions.length).toBeGreaterThan(0);
    });
    
    it.skip('should handle cursor at end of complete expression', async () => {
      const expression = 'Patient.name';
      const cursorPosition = 12;
      
      const completions = await provideCompletions(expression, cursorPosition);
      
      // Should provide operator completions
      const dotCompletion = completions.find(c => c.label === '.');
      expect(dotCompletion).toBeDefined();
    });
    
    it('should handle nested expressions', async () => {
      const expression = 'Patient.name.where(use = "official").';
      const cursorPosition = 38;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // Should provide completions for filtered name collection
      expect(completions.length).toBeGreaterThan(0);
      const firstCompletion = completions.find(c => c.label === 'first');
      expect(firstCompletion).toBeDefined();
    });
  });
});