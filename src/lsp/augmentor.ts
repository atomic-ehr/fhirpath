import { NodeType } from '../types';
import type { ASTNode, BinaryNode, UnaryNode, FunctionNode, IndexNode, CollectionNode, MembershipTestNode, TypeCastNode, TypeReferenceNode, QuantityNode } from '../types';
import type { TriviaInfo } from '../types';
import type { AnyCursorNode } from '../cursor-nodes';
import { isCursorNode, createCursorTypeNode } from '../cursor-nodes';

export interface AugmentationIndexes {
  nodeById: Map<string, ASTNode>;
  nodesByType: Map<NodeType | 'Error' | 'CursorNode', ASTNode[]>;
  identifiers: Map<string, ASTNode[]>;
}

export interface AugmentationOptions {
  input: string;
  preserveTrivia?: boolean;
  trivia?: {
    leadingByStart?: Map<number, TriviaInfo[]>;
    trailingByEnd?: Map<number, TriviaInfo[]>;
  };
  cursorPosition?: number;
}

export interface AugmentationResult {
  ast: ASTNode;
  indexes: AugmentationIndexes;
}

export function augment(ast: ASTNode, opts: AugmentationOptions): AugmentationResult {
  const indexes: AugmentationIndexes = {
    nodeById: new Map(),
    nodesByType: new Map(),
    identifiers: new Map(),
  };
  let nodeIdCounter = 0;

  function enrich(node: ASTNode, parent?: ASTNode): void {
    (node as any).id = `node_${nodeIdCounter++}`;
    const start = node.range.start.offset ?? 0;
    const end = node.range.end.offset ?? start;
    (node as any).raw = opts.input.substring(start, end);
    if (opts.preserveTrivia && opts.trivia) {
      const s = node.range.start.offset ?? -1;
      const e = node.range.end.offset ?? -1;
      (node as any).leadingTrivia = opts.trivia.leadingByStart?.get(s) ?? [];
      (node as any).trailingTrivia = opts.trivia.trailingByEnd?.get(e) ?? [];
    }
    if (parent) {
      (node as any).parent = parent;
    }
    indexes.nodeById.set((node as any).id, node);
    const bucket = indexes.nodesByType.get(node.type) || [];
    bucket.push(node);
    indexes.nodesByType.set(node.type, bucket);
    if ((node as any).type === NodeType.Identifier) {
      const name = (node as any).name as string;
      const arr = indexes.identifiers.get(name) || [];
      arr.push(node);
      indexes.identifiers.set(name, arr);
    }
  }

  function visit(node: ASTNode, parent?: ASTNode): void {
    enrich(node, parent);
    switch (node.type) {
      case NodeType.Binary: {
        const bin = node as BinaryNode;
        (node as any).children = [bin.left, bin.right];
        visit(bin.left, node);
        visit(bin.right, node);
        break;
      }
      case NodeType.Unary: {
        const un = node as UnaryNode;
        (node as any).children = [un.operand];
        visit(un.operand, node);
        break;
      }
      case NodeType.Function: {
        const fn = node as FunctionNode;
        (node as any).children = [fn.name, ...fn.arguments];
        visit(fn.name, node);
        for (const arg of fn.arguments) visit(arg, node);
        break;
      }
      case NodeType.Index: {
        const idx = node as IndexNode;
        (node as any).children = [idx.expression, idx.index];
        visit(idx.expression, node);
        visit(idx.index, node);
        break;
      }
      case NodeType.Collection: {
        const coll = node as CollectionNode;
        (node as any).children = [...coll.elements];
        for (const el of coll.elements) visit(el, node);
        break;
      }
      case NodeType.MembershipTest: {
        const mt = node as MembershipTestNode;
        (node as any).children = [mt.expression];
        visit(mt.expression, node);
        break;
      }
      case NodeType.TypeCast: {
        const tc = node as TypeCastNode;
        (node as any).children = [tc.expression];
        visit(tc.expression, node);
        break;
      }
      default:
        break;
    }
  }

  // First pass: enrich and index
  visit(ast);

  // Cursor-specific transform for ofType arguments
  if (opts.cursorPosition !== undefined) {
    const cursorPos = opts.cursorPosition;
    function transform(node: ASTNode): ASTNode {
      switch (node.type) {
        case NodeType.Binary: {
          const binary = node as BinaryNode;
          if (binary.right.type === NodeType.Function) {
            const func = binary.right as FunctionNode;
      if ((func.name as any).name === 'ofType') {
        func.arguments = func.arguments.map((arg) => {
          if (isCursorNode(arg)) {
            const cursorNode = arg as AnyCursorNode;
            return createCursorTypeNode(cursorNode.position, 'ofType') as any;
          }
                if (arg.type === NodeType.Binary) {
                  const binaryArg = arg as BinaryNode;
                  if (isCursorNode(binaryArg.right)) {
                    const cursorNode = binaryArg.right as AnyCursorNode;
                    let partialText: string | undefined;
                    if (binaryArg.left.type === NodeType.Identifier) {
                      partialText = (binaryArg.left as any).name;
                    }
                    return createCursorTypeNode(cursorNode.position, 'ofType', partialText) as any;
                  }
                }
                // New: identifier immediately before cursor inside ofType
                if ((arg.type === NodeType.Identifier) && (arg as any).range?.end?.offset === cursorPos) {
                  const name = (arg as any).name as string | undefined;
                  return createCursorTypeNode(cursorPos, 'ofType', name) as any;
                }
                return arg;
              });
            }
            binary.left = transform(binary.left);
          } else {
            binary.left = transform(binary.left);
            binary.right = transform(binary.right);
          }
          break;
        }
        case NodeType.Function: {
          const func = node as FunctionNode;
          if ((func.name as any).name === 'ofType') {
            func.arguments = func.arguments.map((arg) => {
              if (isCursorNode(arg)) {
                const cursorNode = arg as AnyCursorNode;
                return createCursorTypeNode(cursorNode.position, 'ofType') as any;
              }
              if (arg.type === NodeType.Binary) {
                const binaryArg = arg as BinaryNode;
                if (isCursorNode(binaryArg.right)) {
                  const cursorNode = binaryArg.right as AnyCursorNode;
                  let partialText: string | undefined;
                  if (binaryArg.left.type === NodeType.Identifier) {
                    partialText = (binaryArg.left as any).name;
                  }
                  return createCursorTypeNode(cursorNode.position, 'ofType', partialText) as any;
                }
              }
              // New: identifier immediately before cursor inside ofType
              if ((arg.type === NodeType.Identifier) && (arg as any).range?.end?.offset === cursorPos) {
                const name = (arg as any).name as string | undefined;
                return createCursorTypeNode(cursorPos, 'ofType', name) as any;
              }
          return arg;
        });
        // If we still have a cursor type node without partial text, try to infer from source between '(' and cursor
        if (func.arguments.length >= 1) {
          const firstArg = func.arguments[0] as any;
          if (isCursorNode(firstArg) && (firstArg as any).context === 'type' && (firstArg as any).partialText == null) {
            const nameEnd = (func.name as any).range?.end?.offset ?? -1;
            const start = nameEnd + 1; // after '('
            const end = (firstArg as any).position ?? start;
            if (start >= 0 && end >= start) {
              const slice = opts.input.slice(start, end).trim();
              const m = slice.match(/[A-Za-z][A-Za-z0-9.]*$/);
              const inferred = m ? m[0] : undefined;
              if (inferred && inferred.length > 0) {
                func.arguments[0] = createCursorTypeNode(end, 'ofType', inferred) as any;
              }
            }
          }
        }
      } else {
            func.arguments = func.arguments.map(arg => transform(arg));
          }
          break;
        }
        case NodeType.Unary: {
          const unary = node as UnaryNode;
          unary.operand = transform(unary.operand);
          break;
        }
        case NodeType.Index: {
          const idx = node as IndexNode;
          idx.expression = transform(idx.expression);
          idx.index = transform(idx.index);
          break;
        }
        case NodeType.Collection: {
          const coll = node as CollectionNode;
          coll.elements = coll.elements.map(el => transform(el));
          break;
        }
        case NodeType.MembershipTest: {
          const mt = node as MembershipTestNode;
          mt.expression = transform(mt.expression);
          break;
        }
        case NodeType.TypeCast: {
          const tc = node as TypeCastNode;
          tc.expression = transform(tc.expression);
          break;
        }
      }
      return node;
    }
    transform(ast);
  }

  return { ast, indexes };
}

// (legacy transform function removed; handled inline above)
