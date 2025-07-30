import { describe, it, expect } from 'bun:test';
import { NodeType, Parser, type ParseResult } from '../src/parser';

describe('Parser LSP Mode', () => {
  it('should return ParseResult in LSP mode', () => {
    const parser = new Parser('5 + 3', { mode: 'lsp' });
    const result = parser.parse() as ParseResult;
    
    expect('ast' in result).toBe(true);
    expect('errors' in result).toBe(true);
    expect('indexes' in result).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.ast.type).toBe(NodeType.Binary);
  });

  it('should add node IDs in LSP mode', () => {
    const parser = new Parser('name.first()', { mode: 'lsp' });
    const result = parser.parse() as ParseResult;
    
    expect(result.ast.id).toBeDefined();
    expect(result.ast.id).toMatch(/^node_\d+$/);
  });

  it('should build indexes in LSP mode', () => {
    const parser = new Parser('Patient.name.given', { mode: 'lsp' });
    const result = parser.parse() as ParseResult;
    
    expect(result.indexes).toBeDefined();
    expect(result.indexes!.nodeById.size).toBeGreaterThan(0);
    expect(result.indexes!.nodesByType.has(NodeType.Binary)).toBe(true);
    expect(result.indexes!.identifiers.has('Patient')).toBe(true);
    expect(result.indexes!.identifiers.has('name')).toBe(true);
    expect(result.indexes!.identifiers.has('given')).toBe(true);
  });

  it('should collect errors in LSP mode', () => {
    const parser = new Parser('5 +', { mode: 'lsp', errorRecovery: true });
    const result = parser.parse() as ParseResult;
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('Unexpected token');
  });

  it('should add parent relationships in LSP mode', () => {
    const parser = new Parser('a + b', { mode: 'lsp' });
    const result = parser.parse() as ParseResult;
    
    const binaryNode = result.ast;
   expect(binaryNode.type).toBe(NodeType.Binary);
    
    if ('left' in binaryNode && 'right' in binaryNode) {
      expect(binaryNode.left.parent).toBe(binaryNode);
      expect(binaryNode.right.parent).toBe(binaryNode);
    }
  });

  it('should add raw source text in LSP mode', () => {
    const parser = new Parser('hello + world', { mode: 'lsp' });
    const result = parser.parse() as ParseResult;
    
    expect(result.ast.raw).toBeDefined();
    expect(result.ast.raw).toContain('hello + world');
  });

  it('should provide cursor context for partial parsing', () => {
    const parser = new Parser('name.wh', { 
      mode: 'lsp',
      partialParse: { cursorPosition: 7 }
    });
    const result = parser.parse() as ParseResult;
    
    expect(result.cursorContext).toBeDefined();
    expect(result.cursorContext!.availableCompletions).toContain('where');
  });

  it('should work in simple mode by default', () => {
    const parser = new Parser('5 + 3');
    const result = parser.parse() as ParseResult;
    // In simple mode, we still get a ParseResult but without LSP features
    expect('ast' in result).toBe(true);
    expect('errors' in result).toBe(true);
    // LSP-specific features should not be present
    expect('indexes' in result).toBe(false);
    expect(result.ast.id).toBeUndefined();
    expect(result.ast.parent).toBeUndefined();
    expect(result.ast.raw).toBeUndefined();
  });
});