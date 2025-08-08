import { describe, it, expect, beforeAll } from 'bun:test';
import { provideCompletions, CompletionKind } from '../src/completion-provider';
import type { CompletionItem, CompletionOptions } from '../src/completion-provider';
import type { TypeInfo, ModelProvider } from '../src/types';
import { getInitializedModelProvider } from './model-provider-singleton';

describe('Completion Provider', () => {
  let modelProvider: ModelProvider;
  
  beforeAll(async () => {
    // Use the singleton FHIRModelProvider
    modelProvider = await getInitializedModelProvider();
  });
  
  describe('identifier completions (after dot)', () => {
    it('should provide property completions for known type', () => {
      const expression = 'Patient.';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
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
    
    it('should provide function completions without type info', () => {
      const expression = 'something.';
      const cursorPosition = 10;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should still have common functions
      const whereCompletion = completions.find(c => c.label === 'where');
      expect(whereCompletion).toBeDefined();
      expect(whereCompletion?.kind).toBe(CompletionKind.Function);
      
      const selectCompletion = completions.find(c => c.label === 'select');
      expect(selectCompletion).toBeDefined();
    });
    
    it('should provide type-specific functions for strings', () => {
      const expression = '"hello".';
      const cursorPosition = 8;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should have string-specific functions
      const lengthCompletion = completions.find(c => c.label === 'length');
      expect(lengthCompletion).toBeDefined();
      expect(lengthCompletion?.kind).toBe(CompletionKind.Function);
      
      const startsWithCompletion = completions.find(c => c.label === 'startsWith');
      expect(startsWithCompletion).toBeDefined();
    });
  });
  
  describe('operator completions (between expressions)', () => {
    it('should provide arithmetic operators for numbers', () => {
      const expression = '5 ';
      const cursorPosition = 2;
      
      const completions = provideCompletions(expression, cursorPosition);
      
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
    
    it('should provide string operators for strings', () => {
      const expression = '"hello" ';
      const cursorPosition = 8;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should have string concatenation
      const plusCompletion = completions.find(c => c.label === '+');
      expect(plusCompletion).toBeDefined();
      
      // Should have string contains
      const tildeCompletion = completions.find(c => c.label === '~');
      expect(tildeCompletion).toBeDefined();
    });
    
    it('should provide boolean operators for booleans', () => {
      const expression = 'true ';
      const cursorPosition = 5;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should have logical operators
      const andCompletion = completions.find(c => c.label === 'and');
      expect(andCompletion).toBeDefined();
      expect(andCompletion?.kind).toBe(CompletionKind.Operator);
      
      const orCompletion = completions.find(c => c.label === 'or');
      expect(orCompletion).toBeDefined();
    });
  });
  
  describe('type completions (after is/as/ofType)', () => {
    it('should provide type completions after is', () => {
      const expression = 'value is ';
      const cursorPosition = 9;
      
      const completions = provideCompletions(expression, cursorPosition);
      
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
    
    it('should provide resource types for ofType with modelProvider', () => {
      const expression = 'Bundle.entry.resource.ofType(';
      const cursorPosition = 30;
      const options: CompletionOptions = {
        modelProvider: modelProvider
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      // Should have resource types
      const patientType = completions.find(c => c.label === 'Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.kind).toBe(CompletionKind.Type);
      
      const observationType = completions.find(c => c.label === 'Observation');
      expect(observationType).toBeDefined();
    });
  });
  
  describe('argument completions (in function arguments)', () => {
    it('should provide variable completions in function arguments', () => {
      const expression = 'where(';
      const cursorPosition = 6;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should have $this variable
      const thisVar = completions.find(c => c.label === '$this');
      expect(thisVar).toBeDefined();
      expect(thisVar?.kind).toBe(CompletionKind.Variable);
      
      // Should have $index variable
      const indexVar = completions.find(c => c.label === '$index');
      expect(indexVar).toBeDefined();
      
      // Should have constants
      const trueConst = completions.find(c => c.label === 'true');
      expect(trueConst).toBeDefined();
      expect(trueConst?.kind).toBe(CompletionKind.Constant);
    });
    
    it('should provide user variables in arguments', () => {
      const expression = 'where(';
      const cursorPosition = 6;
      const options: CompletionOptions = {
        variables: { myVar: 'test', count: 5 }
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      // Should have user variables with % prefix
      const myVarCompletion = completions.find(c => c.label === '%myVar');
      expect(myVarCompletion).toBeDefined();
      expect(myVarCompletion?.kind).toBe(CompletionKind.Variable);
      
      const countCompletion = completions.find(c => c.label === '%count');
      expect(countCompletion).toBeDefined();
    });
    
    it('should provide properties in lambda function context', () => {
      const expression = 'Patient.name.where(';
      const cursorPosition = 19;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      // Should have properties of name (HumanName)
      const useCompletion = completions.find(c => c.label === 'use');
      expect(useCompletion).toBeDefined();
      expect(useCompletion?.kind).toBe(CompletionKind.Property);
      
      const familyCompletion = completions.find(c => c.label === 'family');
      expect(familyCompletion).toBeDefined();
    });
  });
  
  describe('index completions (in brackets)', () => {
    it('should provide index completions in brackets', () => {
      const expression = 'Patient[';
      const cursorPosition = 8;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should have numeric indices
      const zeroIndex = completions.find(c => c.label === '0');
      expect(zeroIndex).toBeDefined();
      expect(zeroIndex?.kind).toBe(CompletionKind.Constant);
      
      // Should have $index variable
      const indexVar = completions.find(c => c.label === '$index');
      expect(indexVar).toBeDefined();
      expect(indexVar?.kind).toBe(CompletionKind.Variable);
      
      // Should have index functions
      const firstFunc = completions.find(c => c.label === 'first()');
      expect(firstFunc).toBeDefined();
      expect(firstFunc?.kind).toBe(CompletionKind.Function);
    });
  });
  
  describe('filtering and ranking', () => {
    it('should filter completions by partial text', () => {
      const expression = 'Patient.na';
      const cursorPosition = 10;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      // Should only have items starting with 'na'
      const nameCompletion = completions.find(c => c.label === 'name');
      expect(nameCompletion).toBeDefined();
      
      // Should not have items not starting with 'na'
      const birthDateCompletion = completions.find(c => c.label === 'birthDate');
      expect(birthDateCompletion).toBeUndefined();
    });
    
    it('should rank completions by kind', () => {
      const expression = 'Patient.';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      // Properties should come before functions
      const firstProperty = completions.findIndex(c => c.kind === CompletionKind.Property);
      const firstFunction = completions.findIndex(c => c.kind === CompletionKind.Function);
      
      expect(firstProperty).toBeGreaterThanOrEqual(0);
      expect(firstFunction).toBeGreaterThanOrEqual(0);
      expect(firstProperty).toBeLessThan(firstFunction);
    });
    
    it('should limit completions when maxCompletions is set', () => {
      const expression = 'Patient.';
      const cursorPosition = 8;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true },
        maxCompletions: 5
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      expect(completions.length).toBeLessThanOrEqual(5);
    });
  });
  
  describe('edge cases', () => {
    it('should return empty array for invalid expression', () => {
      const expression = '...';
      const cursorPosition = 3;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      expect(completions).toEqual([]);
    });
    
    it('should handle empty expression', () => {
      const expression = '';
      const cursorPosition = 0;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should provide initial completions
      expect(completions.length).toBeGreaterThan(0);
    });
    
    it('should handle cursor at end of complete expression', () => {
      const expression = 'Patient.name';
      const cursorPosition = 12;
      
      const completions = provideCompletions(expression, cursorPosition);
      
      // Should provide operator completions
      const dotCompletion = completions.find(c => c.label === '.');
      expect(dotCompletion).toBeDefined();
    });
    
    it('should handle nested expressions', () => {
      const expression = 'Patient.name.where(use = "official").';
      const cursorPosition = 38;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = provideCompletions(expression, cursorPosition, options);
      
      // Should provide completions for filtered name collection
      expect(completions.length).toBeGreaterThan(0);
      const firstCompletion = completions.find(c => c.label === 'first');
      expect(firstCompletion).toBeDefined();
    });
  });
});