import { describe, it, expect } from 'bun:test';
import { Parser } from '../src/parser';
import { NodeType } from '../src/types';

function parse(expr: string) {
  const parser = new Parser(expr);
  const result = parser.parse();
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]!.message);
  }
  return result.ast;
}

describe('Parser error handling', () => {
  describe('Invalid brace collection syntax', () => {
    it('should reject single value in braces', () => {
      expect(() => parse('{1}')).toThrow("Unexpected token '1', expected '}'");
    });
    
    it('should reject multiple values in braces with commas', () => {
      expect(() => parse('{1, 2}')).toThrow("Unexpected token '1', expected '}'");
      expect(() => parse('{1, 2, 3}')).toThrow("Unexpected token '1', expected '}'");
    });
    
    it('should reject string values in braces', () => {
      expect(() => parse("{'hello'}")).toThrow("Unexpected token ''hello'', expected '}'");
      expect(() => parse("{'a', 'b', 'c'}")).toThrow("Unexpected token ''a'', expected '}'");
    });
    
    it('should accept empty braces as empty collection', () => {
      const ast = parse('{}');
      expect(ast).toBeDefined();
      expect(ast.type).toBe(NodeType.Collection);
      expect((ast as any).elements).toEqual([]);
    });
    
    it('should provide helpful error message', () => {
      expect(() => parse('{1, 2, 3}')).toThrow(
        "Braces can only be used for empty collections. Use parentheses and pipe operators for non-empty collections: (1 | 2 | 3)"
      );
    });
  });
  
  describe('Valid collection syntax', () => {
    it('should accept pipe syntax for collections', () => {
      const ast = parse('(1 | 2 | 3)');
      expect(ast).toBeDefined();
      expect(ast.type).toBe(NodeType.Binary);
    });
    
    it('should accept nested pipe collections', () => {
      const ast = parse('(1 | 2) | (3 | 4)');
      expect(ast).toBeDefined();
      expect(ast.type).toBe(NodeType.Binary);
    });
  });
});