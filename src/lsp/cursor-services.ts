import { TokenType } from '../lexer';
import { NodeType } from '../types';
import type { ASTNode, IdentifierNode, TypeOrIdentifierNode, BinaryNode, UnaryNode, FunctionNode, IndexNode, MembershipTestNode, TypeCastNode } from '../types';

export function findNodeAtPosition(root: ASTNode, offset: number): ASTNode | null {
  if (offset < root.range.start.offset! || offset > root.range.end.offset!) {
    return null;
  }
  if ('children' in root && Array.isArray((root as any).children)) {
    for (const child of (root as any).children as ASTNode[]) {
      const found = findNodeAtPosition(child, offset);
      if (found) return found;
    }
  }
  switch (root.type) {
    case NodeType.Binary: {
      const bin = root as BinaryNode;
      return findNodeAtPosition(bin.left, offset) || findNodeAtPosition(bin.right, offset) || root;
    }
    case NodeType.Unary: {
      const un = root as UnaryNode;
      return findNodeAtPosition(un.operand, offset) || root;
    }
    case NodeType.Function: {
      const fn = root as FunctionNode;
      const nameRes = findNodeAtPosition(fn.name, offset);
      if (nameRes) return nameRes;
      for (const arg of fn.arguments) {
        const argRes = findNodeAtPosition(arg, offset);
        if (argRes) return argRes;
      }
      return root;
    }
    default:
      return root;
  }
}

export function getExpectedTokens(node: ASTNode | null): TokenType[] {
  if (!node) return getExpectedTokensForError();
  switch (node.type) {
    case NodeType.Binary:
      return [TokenType.DOT, TokenType.LBRACKET];
    case NodeType.Identifier:
    case NodeType.TypeOrIdentifier:
      return [TokenType.DOT, TokenType.LPAREN, TokenType.LBRACKET];
    default:
      return getExpectedTokensForError();
  }
}

export function getExpectedTokensForError(): TokenType[] {
  return [
    TokenType.EOF,
    TokenType.DOT,
    TokenType.LBRACKET,
    TokenType.LPAREN,
    TokenType.OPERATOR,
    TokenType.IDENTIFIER,
  ];
}

export function getCompletions(node: ASTNode | null, identifiers?: Map<string, ASTNode[]>): string[] {
  if (!node) return [];
  const completions: string[] = [];
  if (identifiers) {
    for (const name of Array.from(identifiers.keys())) {
      completions.push(name);
    }
  }
  completions.push(
    'where', 'select', 'first', 'last', 'tail',
    'skip', 'take', 'count', 'empty', 'exists'
  );
  return completions;
}

