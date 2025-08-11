import { describe, it, expect } from 'bun:test';
import { registry } from '../src/registry';

describe('Registry Type-Aware Methods', () => {
  describe('getFunctionsForType', () => {
    it('should return string-specific functions for String type', () => {
      const functions = registry.getFunctionsForType('String');
      const functionNames = functions.map(f => f.name);
      
      // Should include string functions
      expect(functionNames).toContain('length');
      expect(functionNames).toContain('startsWith');
      expect(functionNames).toContain('endsWith');
      expect(functionNames).toContain('contains');
      expect(functionNames).toContain('substring');
      expect(functionNames).toContain('upper');
      expect(functionNames).toContain('lower');
      expect(functionNames).toContain('replace');
      expect(functionNames).toContain('trim');
      expect(functionNames).toContain('split');
      expect(functionNames).toContain('indexOf');
      
      // Should also include general functions that work with Any type
      expect(functionNames).toContain('trace');
      expect(functionNames).toContain('empty');
      expect(functionNames).toContain('exists');
    });
    
    it('should return numeric functions for Integer type', () => {
      const functions = registry.getFunctionsForType('Integer');
      const functionNames = functions.map(f => f.name);
      
      // Should include math functions
      expect(functionNames).toContain('abs');
      expect(functionNames).toContain('ceiling');
      expect(functionNames).toContain('floor');
      expect(functionNames).toContain('round');
      expect(functionNames).toContain('sqrt');
      
      // Should also include general functions
      expect(functionNames).toContain('trace');
      expect(functionNames).toContain('toString');
    });
    
    it('should return numeric functions for Decimal type', () => {
      const functions = registry.getFunctionsForType('Decimal');
      const functionNames = functions.map(f => f.name);
      
      // Should include math functions
      expect(functionNames).toContain('abs');
      expect(functionNames).toContain('ceiling');
      expect(functionNames).toContain('floor');
      expect(functionNames).toContain('round');
    });
    
    it('should return temporal functions for Date type', () => {
      const functions = registry.getFunctionsForType('Date');
      const functionNames = functions.map(f => f.name);
      
      // Should include conversion functions
      expect(functionNames).toContain('toString');
      
      // Should include general functions
      expect(functionNames).toContain('trace');
    });
    
    it('should return general functions for unknown types', () => {
      const functions = registry.getFunctionsForType('UnknownType');
      const functionNames = functions.map(f => f.name);
      
      // Should still return functions that accept Any type
      expect(functionNames).toContain('trace');
      expect(functionNames).toContain('empty');
      expect(functionNames).toContain('exists');
      expect(functionNames).toContain('where');
      expect(functionNames).toContain('select');
    });
  });
  
  describe('getOperatorsForType', () => {
    it('should return arithmetic operators for Integer type', () => {
      const operators = registry.getOperatorsForType('Integer');
      const operatorSymbols = operators.map(op => op.symbol);
      
      // Should include arithmetic operators
      expect(operatorSymbols).toContain('+');
      expect(operatorSymbols).toContain('-');
      expect(operatorSymbols).toContain('*');
      expect(operatorSymbols).toContain('div');
      expect(operatorSymbols).toContain('mod');
      
      // Should include comparison operators
      expect(operatorSymbols).toContain('=');
      expect(operatorSymbols).toContain('!=');
      expect(operatorSymbols).toContain('<');
      expect(operatorSymbols).toContain('>');
    });
    
    it('should return string operators for String type', () => {
      const operators = registry.getOperatorsForType('String');
      const operatorSymbols = operators.map(op => op.symbol);
      
      // Should include string concatenation
      expect(operatorSymbols).toContain('+');
      
      // Should include string contains
      expect(operatorSymbols).toContain('~');
      
      // Should include comparison
      expect(operatorSymbols).toContain('=');
      expect(operatorSymbols).toContain('!=');
    });
    
    it('should return boolean operators for Boolean type', () => {
      const operators = registry.getOperatorsForType('Boolean');
      const operatorSymbols = operators.map(op => op.symbol);
      
      // Should include logical operators
      expect(operatorSymbols).toContain('and');
      expect(operatorSymbols).toContain('or');
      expect(operatorSymbols).toContain('xor');
      expect(operatorSymbols).toContain('implies');
      
      // Should include comparison
      expect(operatorSymbols).toContain('=');
      expect(operatorSymbols).toContain('!=');
    });
  });
  
  describe('isFunctionApplicableToType', () => {
    it('should return true for string functions with String type', () => {
      expect(registry.isFunctionApplicableToType('length', 'String')).toBe(true);
      expect(registry.isFunctionApplicableToType('startsWith', 'String')).toBe(true);
      expect(registry.isFunctionApplicableToType('upper', 'String')).toBe(true);
    });
    
    it('should return false for string functions with non-String type', () => {
      expect(registry.isFunctionApplicableToType('length', 'Integer')).toBe(false);
      expect(registry.isFunctionApplicableToType('startsWith', 'Boolean')).toBe(false);
    });
    
    it('should return true for math functions with numeric types', () => {
      expect(registry.isFunctionApplicableToType('abs', 'Integer')).toBe(true);
      expect(registry.isFunctionApplicableToType('abs', 'Decimal')).toBe(true);
      expect(registry.isFunctionApplicableToType('round', 'Decimal')).toBe(true);
    });
    
    it('should return true for general functions with any type', () => {
      expect(registry.isFunctionApplicableToType('trace', 'String')).toBe(true);
      expect(registry.isFunctionApplicableToType('trace', 'Integer')).toBe(true);
      expect(registry.isFunctionApplicableToType('trace', 'CustomType')).toBe(true);
      
      expect(registry.isFunctionApplicableToType('where', 'String')).toBe(true);
      expect(registry.isFunctionApplicableToType('where', 'Patient')).toBe(true);
    });
    
    it('should handle collection types', () => {
      expect(registry.isFunctionApplicableToType('length', 'String[]')).toBe(true);
      expect(registry.isFunctionApplicableToType('abs', 'Integer[]')).toBe(true);
    });
    
    it('should return false for non-existent function', () => {
      expect(registry.isFunctionApplicableToType('nonExistent', 'String')).toBe(false);
    });
  });
  
  describe('isOperatorApplicableToType', () => {
    it('should return true for arithmetic operators with numeric types', () => {
      expect(registry.isOperatorApplicableToType('+', 'Integer')).toBe(true);
      expect(registry.isOperatorApplicableToType('-', 'Decimal')).toBe(true);
      expect(registry.isOperatorApplicableToType('*', 'Integer')).toBe(true);
      expect(registry.isOperatorApplicableToType('div', 'Decimal')).toBe(true);
    });
    
    it('should return true for string concatenation with String type', () => {
      expect(registry.isOperatorApplicableToType('+', 'String')).toBe(true);
      expect(registry.isOperatorApplicableToType('~', 'String')).toBe(true);
    });
    
    it('should return true for logical operators with Boolean type', () => {
      expect(registry.isOperatorApplicableToType('and', 'Boolean')).toBe(true);
      expect(registry.isOperatorApplicableToType('or', 'Boolean')).toBe(true);
      expect(registry.isOperatorApplicableToType('xor', 'Boolean')).toBe(true);
    });
    
    it('should return true for comparison operators with various types', () => {
      expect(registry.isOperatorApplicableToType('=', 'String')).toBe(true);
      expect(registry.isOperatorApplicableToType('=', 'Integer')).toBe(true);
      expect(registry.isOperatorApplicableToType('=', 'Boolean')).toBe(true);
      
      expect(registry.isOperatorApplicableToType('!=', 'String')).toBe(true);
      expect(registry.isOperatorApplicableToType('!=', 'Integer')).toBe(true);
    });
    
    it('should handle collection types', () => {
      expect(registry.isOperatorApplicableToType('+', 'String[]')).toBe(true);
      expect(registry.isOperatorApplicableToType('+', 'Integer[]')).toBe(true);
    });
    
    it('should return false for non-existent operator', () => {
      expect(registry.isOperatorApplicableToType('nonExistent', 'String')).toBe(false);
    });
  });
});