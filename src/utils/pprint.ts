import { NodeType } from '../types';
import type {
  ASTNode,
  IdentifierNode,
  TypeOrIdentifierNode,
  LiteralNode,
  UnaryNode,
  BinaryNode,
  FunctionNode,
  IndexNode,
  MembershipTestNode,
  TypeCastNode,
  CollectionNode,
  TypeReferenceNode,
  QuantityNode,
} from '../types';

export function pprint(node: ASTNode, indent: number = 0): string {
  const spaces = ' '.repeat(indent);

  switch (node.type) {
    case NodeType.Literal: {
      const lit = node as LiteralNode;
      if (lit.valueType === 'string') {
        return `"${lit.value}"`;
      } else if (lit.valueType === 'null') {
        return 'null';
      }
      return String(lit.value);
    }

    case NodeType.Identifier:
    case NodeType.TypeOrIdentifier: {
      const id = node as IdentifierNode | TypeOrIdentifierNode;
      return id.name;
    }

    case NodeType.Variable: {
      return (node as any).name;
    }

    case NodeType.Binary: {
      const bin = node as BinaryNode;
      const op = bin.operator;

      const leftStr = pprint(bin.left, 0);
      const rightStr = pprint(bin.right, 0);

      if (leftStr.length + rightStr.length + op.length + 4 < 60 &&
          !leftStr.includes('\n') && !rightStr.includes('\n')) {
        return `(${op} ${leftStr} ${rightStr})`;
      }

      return `(${op}\n${spaces}  ${pprint(bin.left, indent + 2)}\n${spaces}  ${pprint(bin.right, indent + 2)})`;
    }

    case NodeType.Unary: {
      const un = node as UnaryNode;
      const operandStr = pprint(un.operand, 0);

      if (operandStr.length < 40 && !operandStr.includes('\n')) {
        return `(${un.operator} ${operandStr})`;
      }

      return `(${un.operator}\n${spaces}  ${pprint(un.operand, indent + 2)})`;
    }

    case NodeType.Function: {
      const fn = node as FunctionNode;
      const nameStr = pprint(fn.name, 0);

      if (fn.arguments.length === 0) {
        return `(${nameStr})`;
      }

      const argStrs = fn.arguments.map(arg => pprint(arg, 0));
      const totalLen = nameStr.length + argStrs.reduce((sum, s) => sum + s.length + 1, 0) + 2;

      if (totalLen < 60 && argStrs.every(s => !s.includes('\n'))) {
        return `(${nameStr} ${argStrs.join(' ')})`;
      }

      const argLines = fn.arguments.map(arg => `${spaces}  ${pprint(arg, indent + 2)}`);
      return `(${nameStr}\n${argLines.join('\n')})`;
    }

    case NodeType.Index: {
      const idx = node as IndexNode;
      const exprStr = pprint(idx.expression, 0);
      const indexStr = pprint(idx.index, 0);

      if (exprStr.length + indexStr.length < 50 &&
          !exprStr.includes('\n') && !indexStr.includes('\n')) {
        return `([] ${exprStr} ${indexStr})`;
      }

      return `([]\n${spaces}  ${pprint(idx.expression, indent + 2)}\n${spaces}  ${pprint(idx.index, indent + 2)})`;
    }

    case NodeType.MembershipTest: {
      const mt = node as MembershipTestNode;
      const exprStr = pprint(mt.expression, 0);

      if (exprStr.length + mt.targetType.length < 50 && !exprStr.includes('\n')) {
        return `(is ${exprStr} ${mt.targetType})`;
      }

      return `(is\n${spaces}  ${pprint(mt.expression, indent + 2)}\n${spaces}  ${mt.targetType})`;
    }

    case NodeType.TypeCast: {
      const tc = node as TypeCastNode;
      const exprStr = pprint(tc.expression, 0);

      if (exprStr.length + tc.targetType.length < 50 && !exprStr.includes('\n')) {
        return `(as ${exprStr} ${tc.targetType})`;
      }

      return `(as\n${spaces}  ${pprint(tc.expression, indent + 2)}\n${spaces}  ${tc.targetType})`;
    }

    case NodeType.Collection: {
      const coll = node as CollectionNode;

      if (coll.elements.length === 0) {
        return '{}';
      }

      const elemStrs = coll.elements.map(e => pprint(e, 0));
      const totalLen = elemStrs.reduce((sum, s) => sum + s.length + 1, 2);

      if (totalLen < 60 && elemStrs.every(s => !s.includes('\n'))) {
        return `{${elemStrs.join(' ')}}`;
      }

      const elemLines = coll.elements.map(e => `${spaces}  ${pprint(e, indent + 2)}`);
      return `{\n${elemLines.join('\n')}\n${spaces}}`;
    }

    case NodeType.TypeReference: {
      const tr = node as TypeReferenceNode;
      return `Type[${tr.typeName}]`;
    }

    case NodeType.Quantity: {
      const q = node as QuantityNode;
      return `${q.value} '${q.unit}'`;
    }

    default:
      return `<unknown:${(node as any).type}>`;
  }
}

