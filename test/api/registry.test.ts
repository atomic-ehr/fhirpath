import { describe, it, expect } from 'bun:test';
import { registry } from '../../src';

describe('API - registry', () => {
  describe('listFunctions', () => {
    it('should list all functions', () => {
      const functions = registry.listFunctions();
      expect(functions.length).toBeGreaterThan(0);
      
      // Check for common functions
      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('where');
      expect(functionNames).toContain('select');
      expect(functionNames).toContain('exists');
      expect(functionNames).toContain('first');
      expect(functionNames).toContain('last');
      
      // Check structure
      const whereFunc = functions.find(f => f.name === 'where');
      expect(whereFunc).toBeDefined();
      expect(whereFunc?.kind).toBe('function');
      expect(whereFunc?.syntax.notation).toContain('where');
    });
  });
  
  describe('listOperators', () => {
    it('should list all operators', () => {
      const operators = registry.listOperators();
      expect(operators.length).toBeGreaterThan(0);
      
      // Check for common operators
      const operatorNames = operators.map(o => o.name);
      expect(operatorNames).toContain('+');
      expect(operatorNames).toContain('-');
      expect(operatorNames).toContain('*');
      expect(operatorNames).toContain('/');
      expect(operatorNames).toContain('=');
      expect(operatorNames).toContain('and');
      expect(operatorNames).toContain('or');
      
      // Check structure
      const plusOp = operators.find(o => o.name === '+');
      expect(plusOp).toBeDefined();
      expect(plusOp?.kind).toBe('operator');
      expect(plusOp?.syntax.notation).toContain('+');
    });
  });
  
  describe('hasOperation', () => {
    it('should check for existing operations', () => {
      expect(registry.hasOperation('where')).toBe(true);
      expect(registry.hasOperation('+')).toBe(true);
      expect(registry.hasOperation('and')).toBe(true);
      expect(registry.hasOperation('nonExistent')).toBe(false);
    });
  });
  
  describe('hasFunction', () => {
    it('should check for functions specifically', () => {
      expect(registry.hasFunction('where')).toBe(true);
      expect(registry.hasFunction('exists')).toBe(true);
      expect(registry.hasFunction('+')).toBe(false); // Operator, not function
      expect(registry.hasFunction('nonExistent')).toBe(false);
    });
  });
  
  describe('hasOperator', () => {
    it('should check for operators specifically', () => {
      expect(registry.hasOperator('+')).toBe(true);
      expect(registry.hasOperator('=')).toBe(true);
      expect(registry.hasOperator('where')).toBe(false); // Function, not operator
      expect(registry.hasOperator('nonExistent')).toBe(false);
    });
  });
  
  describe('getOperationInfo', () => {
    it('should get detailed info for functions', () => {
      const info = registry.getOperationInfo('where');
      expect(info).toBeDefined();
      expect(info?.name).toBe('where');
      expect(info?.kind).toBe('function');
      expect(info?.signature).toBeDefined();
      expect(info?.signature.parameters).toBeDefined();
      expect(info?.signature.parameters?.length).toBeGreaterThan(0);
    });
    
    it('should get detailed info for operators', () => {
      const info = registry.getOperationInfo('+');
      expect(info).toBeDefined();
      expect(info?.name).toBe('+');
      expect(info?.kind).toBe('operator');
      expect(info?.signature).toBeDefined();
      expect(info?.signature.output).toBeDefined();
    });
    
    it('should return undefined for non-existent operation', () => {
      const info = registry.getOperationInfo('nonExistent');
      expect(info).toBeUndefined();
    });
  });
  
  describe('canRegisterFunction', () => {
    it('should allow valid function names', () => {
      expect(registry.canRegisterFunction('myCustomFunc')).toBe(true);
      expect(registry.canRegisterFunction('_privateFunc')).toBe(true);
      expect(registry.canRegisterFunction('func123')).toBe(true);
    });
    
    it('should reject invalid function names', () => {
      expect(registry.canRegisterFunction('')).toBe(false);
      expect(registry.canRegisterFunction('123func')).toBe(false);
      expect(registry.canRegisterFunction('func-name')).toBe(false);
      expect(registry.canRegisterFunction('func.name')).toBe(false);
    });
    
    it('should reject built-in function names', () => {
      expect(registry.canRegisterFunction('where')).toBe(false);
      expect(registry.canRegisterFunction('select')).toBe(false);
      expect(registry.canRegisterFunction('exists')).toBe(false);
    });
  });
});