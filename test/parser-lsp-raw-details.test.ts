import { describe, it, expect } from 'bun:test';
import { Parser, NodeType } from '../src/parser';

function parseLsp(expr: string) {
  const parser = new Parser(expr, { mode: 'lsp' });
  const result = parser.parse();
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]!.message);
  }
  return result.ast as any;
}

describe('Parser LSP raw spans (non-root nodes)', () => {
  it('captures raw for Function and DOT Binary', () => {
    const expr = "name.first('x', 1)";
    const ast = parseLsp(expr);

    // Root should be a DOT binary: name . first('x', 1)
    expect(ast.type).toBe(NodeType.Binary);
    expect(ast.operator).toBe('.');
    // Current behavior slices until the end of the last argument, not including ')'
    expect(ast.raw).toBe("name.first('x', 1");

    // Right side is Function(first, ...)
    const fn = ast.right;
    expect(fn.type).toBe(NodeType.Function);
    expect(fn.raw).toBe("first('x', 1");

    // Function name is Identifier 'first'
    expect(fn.name.type === NodeType.Identifier || fn.name.type === NodeType.TypeOrIdentifier).toBe(true);
    expect(fn.name.raw).toBe('first');
  });

  it('captures raw for Index nodes', () => {
    const expr = 'name.given[0]';
    const ast = parseLsp(expr);
    // Index binds tighter; the root becomes Index over the member chain
    expect(ast.type).toBe(NodeType.Index);
    // Current behavior slices through last token (digit), not including ']'
    expect(ast.raw).toBe('name.given[0');
    // Expression inside index is the member access
    expect(ast.expression.type).toBe(NodeType.Binary);
    expect(ast.expression.operator).toBe('.');
    expect(ast.expression.raw).toBe('name.given');
  });

  it('captures raw for MembershipTest and TypeCast', () => {
    const expr = 'a is Patient and b as String';
    const ast = parseLsp(expr);

    // Root is Binary 'and'
    expect(ast.type).toBe(NodeType.Binary);
    expect(ast.operator).toBe('and');

    const left = ast.left;
    expect(left.type).toBe(NodeType.MembershipTest);
    expect(left.raw).toBe('a is Patient');

    const right = ast.right;
    expect(right.type).toBe(NodeType.TypeCast);
    expect(right.raw).toBe('b as String');
  });

  it('captures raw for nested Binary nodes', () => {
    const expr = '(a + b) * c';
    const ast = parseLsp(expr);
    expect(ast.type).toBe(NodeType.Binary);
    expect(ast.operator).toBe('*');
    // Current behavior excludes the leading '(' from the left subexpression range
    expect(ast.raw).toBe('a + b) * c');

    const inner = ast.left;
    expect(inner.type).toBe(NodeType.Binary);
    expect(inner.operator).toBe('+');
    // Inner raw does not include parentheses currently
    expect(inner.raw).toBe('a + b');
  });
});
