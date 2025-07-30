import { describe, it, expect } from 'bun:test';
import { LSPParser } from '../src/parser-lsp';
import { NodeType } from '../src/types';

describe('LSPParser', () => {
  describe('basic parsing', () => {
    it('should parse function calls', () => {
      const parser = new LSPParser('unknownFunc()');
      const result = parser.parse();
      
      expect(result.ast.type).toBe(NodeType.Function);
      expect((result.ast as any).name.type).toBe(NodeType.Identifier);
      expect((result.ast as any).name.name).toBe('unknownFunc');
      expect((result.ast as any).arguments).toEqual([]);
    });

    it('should parse function calls with arguments', () => {
      const parser = new LSPParser('max(1, 2)');
      const result = parser.parse();
      
      expect(result.ast.type).toBe(NodeType.Function);
      expect((result.ast as any).arguments).toHaveLength(2);
    });

    it('should parse binary expressions with function calls', () => {
      const parser = new LSPParser('$unknown + unknownFunc()');
      const result = parser.parse();
      
      expect(result.ast.type).toBe(NodeType.Binary);
      expect((result.ast as any).operator).toBe('+');
      expect((result.ast as any).left.type).toBe(NodeType.Variable);
      expect((result.ast as any).right.type).toBe(NodeType.Function);
    });
  });

  describe('position tracking', () => {
    it('should include proper ranges', () => {
      const parser = new LSPParser('$var');
      const result = parser.parse();
      
      expect(result.ast.range).toBeDefined();
      expect(result.ast.range.start).toBeDefined();
      expect(result.ast.range.end).toBeDefined();
      expect(result.ast.range.start.line).toBe(1);
      expect(result.ast.range.start.column).toBe(1);
    });

    it('should track positions for complex expressions', () => {
      const parser = new LSPParser('name.where(use = "official")');
      const result = parser.parse();
      
      expect(result.ast.range).toBeDefined();
      // The entire expression should span from start to end
      expect(result.ast.range.start.column).toBe(1);
      expect(result.ast.range.end.column).toBeGreaterThan(20);
    });
  });

  describe('error handling', () => {
    it('should collect parse errors', () => {
      const parser = new LSPParser('5 +');
      const result = parser.parse();
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Unexpected');
    });
  });
});