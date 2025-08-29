import { describe, it, expect } from 'bun:test';
import { parse } from '../../src/parser';
import { NodeType } from '../../src/types';
import { isCursorNode, CursorContext } from '../../src/parser/cursor-nodes';

describe('Parser cursor behavior', () => {
  it('mid-identifier cursor produces Identifier cursor node', () => {
    const input = 'Patient.name';
    const idStart = input.indexOf('.') + 1; // start of "name"
    const cursorPosition = idStart + 2;     // mid-token: after "na"

    const { ast, indexes } = parse(input, {
      mode: 'lsp',
      errorRecovery: true,
      cursorPosition,
    });

    // Expect a cursor node in identifier context (partial member name)
    const cursorNodes = (indexes?.nodesByType.get('CursorNode' as any) ?? []) as any[];
    expect(cursorNodes.length).toBeGreaterThan(0);
    // And the first cursor node should be Identifier context
    const idCursor = cursorNodes.find(n => isCursorNode(n) && (n as any).context === CursorContext.Identifier);
    expect(idCursor).toBeTruthy();
  });

  it('index cursor preserves left and creates Index cursor', () => {
    const input = 'items[]';
    const cursorPosition = input.indexOf('[') + 1; // between '[' and ']'

    const { ast } = parse(input, {
      mode: 'lsp',
      errorRecovery: true,
      cursorPosition,
    });

    // Expect Index(expression: Identifier("items"), index: Cursor(Index))
    expect(ast.type).toBe(NodeType.Index);
    const idx = ast as any;
    expect(idx.expression?.type).toBe(NodeType.Identifier);
    expect(idx.expression?.name).toBe('items');
    expect(isCursorNode(idx.index)).toBe(true);
    expect((idx.index as any).context).toBe(CursorContext.Index);
  });

  it('argument-start cursor carries functionName and index', () => {
    const input = 'substring(, 2)';
    const cursorPosition = input.indexOf('(') + 1; // just after '('

    const { ast } = parse(input, {
      mode: 'lsp',
      errorRecovery: true,
      cursorPosition,
    });

    // Desired: Function node with first argument as CursorArgument(name: 'substring', index: 0)
    expect(ast.type === NodeType.Function || ast.type === NodeType.Binary).toBe(true);
    const fn = ast.type === NodeType.Function ? (ast as any) : (ast as any).right;
    expect(fn.type).toBe(NodeType.Function);

    const arg0 = fn.arguments?.[0];
    expect(isCursorNode(arg0)).toBe(true);
    expect((arg0 as any).context).toBe(CursorContext.Argument);
    expect((arg0 as any).functionName).toBe('substring');
    expect((arg0 as any).argumentIndex).toBe(0);
  });
});
