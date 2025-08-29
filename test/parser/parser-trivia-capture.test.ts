import { describe, it, expect } from 'bun:test';
import { Parser, NodeType } from '../../src/parser';

function parseLsp(expr: string) {
  const parser = new Parser(expr, { mode: 'lsp' });
  const result = parser.parse();
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]!.message);
  }
  return result.ast as any;
}

describe('Parser trivia capture (leading/trailing)', () => {
  it('captures whitespace around member access', () => {
    const ast = parseLsp('Patient  .  name');
    // Binary '.'
    expect(ast.type).toBe(NodeType.Binary);
    expect(ast.operator).toBe('.');

    const left = ast.left;
    const right = ast.right;

    // Trailing whitespace before '.' attaches to left identifier
    expect(left.type).toBe(NodeType.Identifier);
    expect(Array.isArray(left.trailingTrivia)).toBe(true);
    expect(left.trailingTrivia?.[0]?.type).toBe('whitespace');
    expect(left.trailingTrivia?.[0]?.value).toBe('  ');

    // Leading whitespace after '.' attaches to right identifier
    expect(right.type === NodeType.Identifier).toBe(true);
    expect(Array.isArray(right.leadingTrivia)).toBe(true);
    expect(right.leadingTrivia?.[0]?.type).toBe('whitespace');
    expect(right.leadingTrivia?.[0]?.value).toBe('  ');
  });

  it('captures block and line comments around operator', () => {
    const expr = 'a /*c*/ + // d\n b';
    const ast = parseLsp(expr);
    expect(ast.type).toBe(NodeType.Binary);
    expect(ast.operator).toBe('+');

    const left = ast.left;
    const right = ast.right;

    // Block comment before '+' is trailing trivia of left
    const trailing = left.trailingTrivia ?? [];
    expect(trailing.length).toBeGreaterThan(0);
    expect(trailing.some(t => t.type === 'comment' && t.value.includes('/*c*/'))).toBe(true);

    // Line comment and newline after '+' is leading trivia of right
    const leading = right.leadingTrivia ?? [];
    expect(leading.length).toBeGreaterThan(0);
    expect(leading.some(t => t.type === 'lineComment')).toBe(true);
    expect(leading.some(t => t.type === 'whitespace' && t.value.includes('\n'))).toBe(true);
  });
});
