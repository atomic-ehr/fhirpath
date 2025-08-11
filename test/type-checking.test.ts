import { describe, it, expect } from 'bun:test';
import { analyze } from '../src/index';
import { DiagnosticSeverity } from '../src/types';
import { ErrorCodes } from "../src/index";

describe('Type Checking', () => {
  describe('Basic type inference', () => {
    it('should infer literal types', async () => {
      const result = await analyze('"hello"');
      expect(result.ast.typeInfo).toEqual({ type: 'String', singleton: true });
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should infer numeric types', async () => {
      const intResult = await analyze('42');
      expect(intResult.ast.typeInfo).toEqual({ type: 'Integer', singleton: true });

      const decResult = await analyze('3.14');
      expect(decResult.ast.typeInfo).toEqual({ type: 'Decimal', singleton: true });
    });

    it('should infer boolean types', async () => {
      const result = await analyze('true');
      expect(result.ast.typeInfo).toEqual({ type: 'Boolean', singleton: true });
    });

    it('should infer collection types', async () => {
      const result = await analyze('(1 | 2 | 3)');
      expect(result.ast.typeInfo?.type).toBe('Integer');
      expect(result.ast.typeInfo?.singleton).toBe(false);
    });
  });

  describe('Type compatibility errors', () => {
    it('should detect type mismatch in binary operators', async () => {
      const result = await analyze('"hello" + 42');
      const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.code).toBe(ErrorCodes.OPERATOR_TYPE_MISMATCH);
      expect(errors[0]?.message).toContain("cannot be applied to types String and Integer");
    });

    it('should detect incompatible function arguments', async () => {
      const result = await analyze('"hello".substring("not a number")');
      const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.code).toBe(ErrorCodes.ARGUMENT_TYPE_MISMATCH);
    });

    it('should allow compatible numeric types', async () => {
      const result = await analyze('5 + 3.14');
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast.typeInfo?.type).toBe('Decimal');
    });
  });

  describe('Special result types', () => {
    it('should preserve input type for where()', async () => {
      const result = await analyze('"hello".where(true)', {
        variables: {}
      });
      
      // Find the where function node
      const whereNode = findFunctionNode(result.ast, 'where');
      expect(whereNode?.typeInfo?.type).toBe('String');
      expect(whereNode?.typeInfo?.singleton).toBe(false);
    });

    it('should use parameter type for select()', async () => {
      const result = await analyze('("a" | "b").select(length())', {
        variables: {}
      });
      
      // Find the select function node
      const selectNode = findFunctionNode(result.ast, 'select');
      expect(selectNode?.typeInfo?.type).toBe('Integer');
      expect(selectNode?.typeInfo?.singleton).toBe(false);
    });

    it('should preserve left type for union operator', async () => {
      const result = await analyze('(1 | 2) | ("a" | "b")', {
        variables: {}
      });
      
      // The union should preserve the left operand type (Integer)
      expect(result.ast.typeInfo?.type).toBe('Integer');
      expect(result.ast.typeInfo?.singleton).toBe(false);
    });
  });

  describe('Variable type inference', () => {
    it('should infer types from variable values', async () => {
      const result = await analyze('%x + %y', {
        variables: { x: 5, y: 3 }
      });
      
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast.typeInfo?.type).toBe('Integer');
    });

    it('should detect type mismatch with variables', async () => {
      const result = await analyze('%x + %y', {
        variables: { x: "hello", y: 3 }
      });
      
      const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.code).toBe(ErrorCodes.OPERATOR_TYPE_MISMATCH);
    });

    it('should handle built-in variables', async () => {
      const result = await analyze('$index + 1');
      expect(result.diagnostics).toHaveLength(0);
      expect(result.ast.typeInfo?.type).toBe('Integer');
    });
  });

  describe('Model provider integration', () => {
    it('should use model provider for navigation', async () => {
      // This would require a mock model provider
      // For now, just test that it doesn't crash
      const result = await analyze('Patient.name.given');
      expect(result.ast.typeInfo?.type).toBe('Any');
    });
  });
});

// Helper function to find a function node by name
function findFunctionNode(node: any, funcName: string): any {
  if (node.type === 'Function' && node.name?.name === funcName) {
    return node;
  }
  
  // Recursively search children
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findFunctionNode(item, funcName);
          if (found) return found;
        }
      } else {
        const found = findFunctionNode(value, funcName);
        if (found) return found;
      }
    }
  }
  
  return null;
}