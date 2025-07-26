import { describe, it, expect } from 'bun:test';
import { parseForEvaluation, FHIRPathError, ErrorCode } from '../../src';
import { NodeType } from '../../src/parser/ast';
import { FHIRPathExpression } from '../../src/api/expression';

describe('API - parse', () => {
  it('should parse simple identifier', () => {
    const ast = parseForEvaluation('name');
    const expr = new FHIRPathExpression(ast, 'name');
    expect(expr.ast).toBeDefined();
    expect(expr.ast.type).toBe(NodeType.Identifier);
    expect(expr.toString()).toContain('name');
  });
  
  it('should parse path expression', () => {
    const ast = parseForEvaluation('Patient.name.given');
    const expr = new FHIRPathExpression(ast, 'Patient.name.given');
    expect(expr.ast).toBeDefined();
    // pprint uses S-expression format
    expect(expr.toString()).toContain('Patient');
    expect(expr.toString()).toContain('name');
    expect(expr.toString()).toContain('given');
  });
  
  it('should parse function call', () => {
    const ast = parseForEvaluation('name.where(use = \'official\')');
    const expr = new FHIRPathExpression(ast, 'name.where(use = \'official\')');
    expect(expr.ast).toBeDefined();
    expect(expr.toString()).toContain('where');
  });
  
  it('should parse arithmetic expression', () => {
    const ast = parseForEvaluation('5 + 3');
    const expr = new FHIRPathExpression(ast, '5 + 3');
    expect(expr.ast).toBeDefined();
    expect(expr.toString()).toContain('+');
    expect(expr.toString()).toContain('5');
    expect(expr.toString()).toContain('3');
  });
  
  it('should throw FHIRPathError on invalid syntax', () => {
    expect(() => parseForEvaluation('name.')).toThrow(FHIRPathError);
    expect(() => parseForEvaluation('name.')).toThrow(/Expected expression/);
  });
  
  it('should include expression in error', () => {
    try {
      parseForEvaluation('name..family'); // Invalid double dot
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(FHIRPathError);
      expect((error as FHIRPathError).code).toBe(ErrorCode.PARSE_ERROR);
      expect((error as FHIRPathError).expression).toBe('name..family');
    }
  });
  
  it('should preserve complex expressions', () => {
    const ast = parseForEvaluation('Patient.where(name.given.exists() and active = true).name.family');
    const expr = new FHIRPathExpression(ast, 'Patient.where(name.given.exists() and active = true).name.family');
    expect(expr.toString()).toContain('where');
    expect(expr.toString()).toContain('exists');
    expect(expr.toString()).toContain('and');
  });
});