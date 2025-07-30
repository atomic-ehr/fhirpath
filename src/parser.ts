import { TokenType } from './lexer';
import type { Token } from './lexer';
import { BaseParser } from './parser-base';
import { NodeType } from './types';
import type {
  Position,
  Range,
  ASTNode,
  IdentifierNode,
  TypeOrIdentifierNode,
  LiteralNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  VariableNode,
  IndexNode,
  MembershipTestNode,
  TypeCastNode,
  CollectionNode,
  TypeReferenceNode
} from './types';

// Re-export types for backward compatibility
export {
  NodeType,
  type Position,
  type ASTNode,
  type IdentifierNode,
  type TypeOrIdentifierNode,
  type LiteralNode,
  type BinaryNode,
  type UnaryNode,
  type FunctionNode,
  type VariableNode,
  type IndexNode,
  type MembershipTestNode,
  type TypeCastNode,
  type CollectionNode,
  type TypeReferenceNode
} from './types';

export class Parser extends BaseParser<ASTNode> {
  constructor(input: string) {
    // Enable position tracking for unified AST structure
    super(input, { trackPosition: true });
  }
  
  private getRangeFromToken(token: Token): Range {
    return token.range || {
      start: { line: 0, character: 0, offset: token.start },
      end: { line: 0, character: 0, offset: token.end }
    };
  }
  
  private getRangeFromTokens(startToken: Token, endToken: Token): Range {
    const start = startToken.range?.start || { line: 0, character: 0, offset: startToken.start };
    const end = endToken.range?.end || { line: 0, character: 0, offset: endToken.end };
    return { start, end };
  }
  
  private getRangeFromNodes(startNode: ASTNode, endNode: ASTNode): Range {
    return {
      start: startNode.range.start,
      end: endNode.range.end
    };
  }

  parse(): ASTNode {
    const expr = this.expression();
    if (!this.isAtEnd()) {
      const token = this.peek();
      throw new Error(`Unexpected token: ${token.value || TokenType[token.type]}`);
    }
    return expr;
  }

  // Implement abstract methods for node creation
  protected createIdentifierNode(name: string, token: Token): ASTNode {
    const range = this.getRangeFromToken(token);
    
    // Check if it's a type (starts with uppercase)
    if (name[0] && name[0] >= 'A' && name[0] <= 'Z') {
      return {
        type: NodeType.TypeOrIdentifier,
        name,
        range
      };
    }
    
    return {
      type: NodeType.Identifier,
      name,
      range
    };
  }

  protected createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LiteralNode {
    return {
      type: NodeType.Literal,
      value,
      valueType,
      range: this.getRangeFromToken(token)
    };
  }

  protected createBinaryNode(token: Token, left: ASTNode, right: ASTNode): BinaryNode {
    return {
      type: NodeType.Binary,
      operator: token.value,
      left,
      right,
      range: this.getRangeFromNodes(left, right)
    };
  }

  protected createUnaryNode(token: Token, operand: ASTNode): UnaryNode {
    const startPos = token.range?.start || { line: 0, character: 0, offset: token.start };
    return {
      type: NodeType.Unary,
      operator: token.value,
      operand,
      range: { start: startPos, end: operand.range.end }
    };
  }

  protected createFunctionNode(name: ASTNode, args: ASTNode[], startToken: Token): FunctionNode {
    const endNode = args.length > 0 ? args[args.length - 1]! : name;
    return {
      type: NodeType.Function,
      name,
      arguments: args,
      range: this.getRangeFromNodes(name, endNode)
    };
  }

  protected createVariableNode(name: string, token: Token): VariableNode {
    return {
      type: NodeType.Variable,
      name,
      range: this.getRangeFromToken(token)
    };
  }

  protected createIndexNode(expression: ASTNode, index: ASTNode, startToken: Token): IndexNode {
    return {
      type: NodeType.Index,
      expression,
      index,
      range: this.getRangeFromNodes(expression, index)
    };
  }


  protected createMembershipTestNode(expression: ASTNode, targetType: string, startToken: Token): MembershipTestNode {
    // The range should extend from expression to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    return {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      range: this.getRangeFromTokens(startToken, endToken)
    };
  }

  protected createTypeCastNode(expression: ASTNode, targetType: string, startToken: Token): TypeCastNode {
    // The range should extend from expression to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    return {
      type: NodeType.TypeCast,
      expression,
      targetType,
      range: this.getRangeFromTokens(startToken, endToken)
    };
  }

  protected createCollectionNode(elements: ASTNode[], startToken: Token): CollectionNode {
    const endToken = this.previous(); // Should be RBRACE
    return {
      type: NodeType.Collection,
      elements,
      range: this.getRangeFromTokens(startToken, endToken)
    };
  }

  protected handleError(message: string, token?: Token): never {
    throw new Error(message);
  }
}

export function parse(input: string): ASTNode {
  const parser = new Parser(input);
  return parser.parse();
}

/**
 * Pretty print AST in Lisp style
 * @param node - The AST node to print
 * @param indent - Current indentation level
 * @returns Lisp-style string representation
 */
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
      const v = node as VariableNode;
      return v.name;
    }
    
    case NodeType.Binary: {
      const bin = node as BinaryNode;
      const op = bin.operator;
      
      // For simple expressions, put on one line
      const leftStr = pprint(bin.left, 0);
      const rightStr = pprint(bin.right, 0);
      
      if (leftStr.length + rightStr.length + op.length + 4 < 60 && 
          !leftStr.includes('\n') && !rightStr.includes('\n')) {
        return `(${op} ${leftStr} ${rightStr})`;
      }
      
      // For complex expressions, use multiple lines
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
      
      // Multi-line format
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
    
    default:
      return `<unknown:${node.type}>`;
  }
}