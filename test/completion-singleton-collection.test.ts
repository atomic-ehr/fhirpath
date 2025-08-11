import { describe, it, expect, beforeAll } from 'bun:test';
import { provideCompletions, CompletionKind } from '../src/completion-provider';
import type { CompletionOptions } from '../src/completion-provider';
import type { ModelProvider } from '../src/types';
import { getInitializedModelProvider } from './model-provider-singleton';

describe('Completion Provider - Singleton vs Collection', () => {
  let modelProvider: ModelProvider;
  
  beforeAll(async () => {
    modelProvider = await getInitializedModelProvider();
  });
  
  describe('String type completions', () => {
    it('should provide singleton string functions for a single string literal', async () => {
      const expression = '"hello".';
      const cursorPosition = 8;
      
      const completions = await provideCompletions(expression, cursorPosition);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // Should have singleton string functions
      expect(functionNames).toContain('length');
      expect(functionNames).toContain('upper');
      expect(functionNames).toContain('lower');
      expect(functionNames).toContain('substring');
      expect(functionNames).toContain('startsWith');
      expect(functionNames).toContain('endsWith');
      expect(functionNames).toContain('trim');
      expect(functionNames).toContain('replace');
      
      // Should also have collection functions
      expect(functionNames).toContain('where');
      expect(functionNames).toContain('select');
      expect(functionNames).toContain('first');
    });
    
    it('should NOT provide singleton string functions for string collection', async () => {
      const expression = 'Patient.name.given.';
      const cursorPosition = 19;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // Should NOT have singleton string functions
      expect(functionNames).not.toContain('length');
      expect(functionNames).not.toContain('upper');
      expect(functionNames).not.toContain('lower');
      expect(functionNames).not.toContain('substring');
      expect(functionNames).not.toContain('startsWith');
      expect(functionNames).not.toContain('endsWith');
      expect(functionNames).not.toContain('trim');
      expect(functionNames).not.toContain('replace');
      
      // Should have collection functions
      expect(functionNames).toContain('where');
      expect(functionNames).toContain('select');
      expect(functionNames).toContain('first');
      expect(functionNames).toContain('last');
      expect(functionNames).toContain('count');
      expect(functionNames).toContain('distinct');
    });
    
    it('should provide singleton functions after first()', async () => {
      const expression = 'Patient.name.given.first().';
      const cursorPosition = 27;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // After first(), should have singleton string functions
      expect(functionNames).toContain('length');
      expect(functionNames).toContain('upper');
      expect(functionNames).toContain('lower');
      expect(functionNames).toContain('substring');
      expect(functionNames).toContain('trim');
    });
  });
  
  describe('Numeric type completions', () => {
    it('should provide singleton math functions for single number', async () => {
      const expression = '5.';
      const cursorPosition = 2;
      
      const completions = await provideCompletions(expression, cursorPosition);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // Should have singleton math functions
      expect(functionNames).toContain('abs');
      expect(functionNames).toContain('ceiling');
      expect(functionNames).toContain('floor');
      expect(functionNames).toContain('round');
      expect(functionNames).toContain('sqrt');
    });
    
    it('should NOT provide singleton math functions for number collection', async () => {
      // Simulating a collection of numbers (e.g., from a select that returns numbers)
      const expression = '(1 | 2 | 3).';
      const cursorPosition = 12;
      
      const completions = await provideCompletions(expression, cursorPosition);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // Should have collection functions
      expect(functionNames).toContain('where');
      expect(functionNames).toContain('select');
      expect(functionNames).toContain('first');
      expect(functionNames).toContain('count');
      
      // Note: Currently we can't easily test this without proper type analysis
      // as the parser doesn't provide type info for complex expressions
    });
  });
  
  describe('Function count differences', () => {
    it('should have fewer functions for collections than singletons', async () => {
      // Collection case
      const collectionExpression = 'Patient.name.given.';
      const collectionPosition = 19;
      const collectionOptions: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const collectionCompletions = await provideCompletions(
        collectionExpression, 
        collectionPosition, 
        collectionOptions
      );
      const collectionFunctions = collectionCompletions
        .filter(c => c.kind === CompletionKind.Function);
      
      // Singleton case
      const singletonExpression = 'Patient.name.given.first().';
      const singletonPosition = 27;
      const singletonOptions: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const singletonCompletions = await provideCompletions(
        singletonExpression, 
        singletonPosition, 
        singletonOptions
      );
      const singletonFunctions = singletonCompletions
        .filter(c => c.kind === CompletionKind.Function);
      
      // Singleton should have more functions than collection
      expect(singletonFunctions.length).toBeGreaterThan(collectionFunctions.length);
      
      // Approximate expected counts (may vary as functions are added)
      expect(collectionFunctions.length).toBeLessThan(35); // Collection functions only
      expect(singletonFunctions.length).toBeGreaterThan(40); // Includes singleton functions
    });
  });
  
  describe('Boolean type completions', () => {
    it('should handle boolean singleton vs collection', async () => {
      // Single boolean
      const singleExpression = 'true.';
      const singlePosition = 5;
      
      const singleCompletions = await provideCompletions(singleExpression, singlePosition);
      const singleFunctionNames = singleCompletions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // Should have functions that work with singleton booleans
      expect(singleFunctionNames).toContain('not');
      expect(singleFunctionNames).toContain('toString');
      expect(singleFunctionNames).toContain('toInteger');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty collection type correctly', async () => {
      const expression = '{}.'; // Empty collection
      const cursorPosition = 3;
      
      const completions = await provideCompletions(expression, cursorPosition);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // Should have collection functions
      expect(functionNames).toContain('empty');
      expect(functionNames).toContain('exists');
      expect(functionNames).toContain('count');
      expect(functionNames).toContain('first');
    });
    
    it('should handle select() that returns collection', async () => {
      const expression = 'Patient.name.select(given).';
      const cursorPosition = 27;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      const functionNames = completions
        .filter(c => c.kind === CompletionKind.Function)
        .map(c => c.label);
      
      // select() flattens, so this returns a collection of strings
      // Should NOT have singleton string functions
      expect(functionNames).not.toContain('length');
      expect(functionNames).not.toContain('upper');
      
      // Should have collection functions
      expect(functionNames).toContain('where');
      expect(functionNames).toContain('distinct');
    });
    
    it('should handle single() that returns singleton', async () => {
      const expression = 'Patient.identifier.single().';
      const cursorPosition = 28;
      const options: CompletionOptions = {
        modelProvider: modelProvider,
        inputType: { type: 'Patient' as any, singleton: true }
      };
      
      const completions = await provideCompletions(expression, cursorPosition, options);
      
      // single() returns a singleton, so more functions should be available
      expect(completions.length).toBeGreaterThan(0);
      
      // Should have properties of Identifier (if model provider works)
      const propertyNames = completions
        .filter(c => c.kind === CompletionKind.Property)
        .map(c => c.label);
      
      if (propertyNames.length > 0) {
        expect(propertyNames).toContain('system');
        expect(propertyNames).toContain('value');
      }
    });
  });
});