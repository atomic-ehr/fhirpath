import { describe, it, expect } from 'bun:test';
import { parse, Parser } from '../../src/parser';
import { NodeType } from '../../src/types';
import { isCursorNode, CursorContext } from '../../src/parser/cursor-nodes';

describe('LSP augmentation via parse() in LSP mode', () => {
  it('attaches ids, parents/children, and builds indexes', () => {
    const input = 'x.where(true).given';
    const { ast, indexes, errors } = parse(input, { mode: 'lsp', errorRecovery: true });

    expect(errors.length).toBe(0);
    // Root should have an id and raw text
    expect((ast as any).id).toBeDefined();
    expect((ast as any).raw).toBeDefined();

    // Walk a couple of levels and ensure parent/children present
    if (ast.type === NodeType.Binary) {
      const left = ast.left;
      const right = ast.right;
      expect((ast as any).children).toBeDefined();
      expect(left.parent).toBe(ast);
      expect(right.parent).toBe(ast);
    }

    // Indexes should be populated
    expect(indexes).toBeDefined();
    expect(indexes!.nodeById.size).toBeGreaterThan(0);
    expect(indexes!.nodesByType.size).toBeGreaterThan(0);
    // Identifiers should include x and where/given identifiers
    const idents = Array.from(indexes!.identifiers.keys());
    expect(idents.includes('x')).toBe(true);
  });

  it('preserves trivia (leading/trailing) for nodes when preserveTrivia is effective', () => {
    const input = '   x . given  ';
    const { ast } = parse(input, { mode: 'lsp', errorRecovery: true, preserveTrivia: true });
    // Any node at root should have trivia arrays
    const anyAst: any = ast;
    expect(Array.isArray(anyAst.leadingTrivia)).toBe(true);
    expect(Array.isArray(anyAst.trailingTrivia)).toBe(true);
  });

  it("transforms cursor argument in ofType() into a type cursor node", () => {
    const input = 'x.ofType(';
    const { ast } = parse(input, {
      mode: 'lsp',
      errorRecovery: true,
      cursorPosition: input.length,
    });

    // Expect a Binary node with a Function on the right named ofType
    expect(ast.type).toBe(NodeType.Binary);
    const fn = (ast as any).right;
    expect(fn.type).toBe(NodeType.Function);
    const nameNode = fn.name;
    expect(nameNode.type === NodeType.Identifier).toBe(true);
    expect(nameNode.name).toBe('ofType');

    // Its first argument should be a cursor type node after transformation
    expect(fn.arguments.length).toBe(1);
    const arg0 = fn.arguments[0];
    expect(isCursorNode(arg0)).toBe(true);
    expect((arg0 as any).context).toBe(CursorContext.Type);
    expect((arg0 as any).typeOperator).toBe('ofType');
  });
});
