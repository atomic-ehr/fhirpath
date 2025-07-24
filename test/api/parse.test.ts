import { describe, it, expect } from 'bun:test';
import { parse, FHIRPathError, ErrorCode } from '../../src';
import { NodeType } from '../../src/parser/ast';

describe('API - parse', () => {
  it('should parse simple identifier', () => {
    const expr = parse('name');
    expect(expr.ast).toBeDefined();
    expect(expr.ast.type).toBe(NodeType.Identifier);
    expect(expr.toString()).toContain('name');
  });
  
  it('should parse path expression', () => {
    const expr = parse('Patient.name.given');
    expect(expr.ast).toBeDefined();
    // pprint uses S-expression format
    expect(expr.toString()).toContain('Patient');
    expect(expr.toString()).toContain('name');
    expect(expr.toString()).toContain('given');
  });
  
  it('should parse function call', () => {
    const expr = parse('name.where(use = \'official\')');
    expect(expr.ast).toBeDefined();
    expect(expr.toString()).toContain('where');
  });
  
  it('should parse arithmetic expression', () => {
    const expr = parse('5 + 3');
    expect(expr.ast).toBeDefined();
    expect(expr.toString()).toContain('+');
    expect(expr.toString()).toContain('5');
    expect(expr.toString()).toContain('3');
  });
  
  it('should throw FHIRPathError on invalid syntax', () => {
    expect(() => parse('name.')).toThrow(FHIRPathError);
    expect(() => parse('name.')).toThrow(/Expected expression/);
  });
  
  it('should include expression in error', () => {
    try {
      parse('name..family'); // Invalid double dot
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(FHIRPathError);
      expect((error as FHIRPathError).code).toBe(ErrorCode.PARSE_ERROR);
      expect((error as FHIRPathError).expression).toBe('name..family');
    }
  });
  
  it('should preserve complex expressions', () => {
    const expr = parse('Patient.where(name.given.exists() and active = true).name.family');
    expect(expr.toString()).toContain('where');
    expect(expr.toString()).toContain('exists');
    expect(expr.toString()).toContain('and');
  });
});