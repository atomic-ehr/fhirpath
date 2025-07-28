import { TokenType } from './lexer';
import type { Token } from './lexer';
import { BaseParser, NodeType } from './parser-base';
import type { Position } from './parser-base';

// Re-export types from base
export { NodeType } from './parser-base';
export type { Position } from './parser-base';

// AST Types specific to parser2
export interface ASTNode {
  type: NodeType;
  offset?: number;  // Just the start offset for basic error reporting
  position?: Position; // Make position optional to satisfy BaseASTNode constraint
}

export interface IdentifierNode extends ASTNode {
  type: NodeType.Identifier;
  name: string;
}

export interface TypeOrIdentifierNode extends ASTNode {
  type: NodeType.TypeOrIdentifier;
  name: string;
}

export interface LiteralNode extends ASTNode {
  type: NodeType.Literal;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null';
}

export interface BinaryNode extends ASTNode {
  type: NodeType.Binary;
  operator: TokenType;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryNode extends ASTNode {
  type: NodeType.Unary;
  operator: TokenType;
  operand: ASTNode;
}

export interface FunctionNode extends ASTNode {
  type: NodeType.Function;
  name: ASTNode;
  arguments: ASTNode[];
}

export interface VariableNode extends ASTNode {
  type: NodeType.Variable;
  name: string;
}

export interface IndexNode extends ASTNode {
  type: NodeType.Index;
  expression: ASTNode;
  index: ASTNode;
}


export interface MembershipTestNode extends ASTNode {
  type: NodeType.MembershipTest;
  expression: ASTNode;
  targetType: string;
}

export interface TypeCastNode extends ASTNode {
  type: NodeType.TypeCast;
  expression: ASTNode;
  targetType: string;
}

export interface CollectionNode extends ASTNode {
  type: NodeType.Collection;
  elements: ASTNode[];
}

export interface TypeReferenceNode extends ASTNode {
  type: NodeType.TypeReference;
  typeName: string;
}

export class Parser extends BaseParser<ASTNode> {
  constructor(input: string) {
    // Use same lexer options as before for performance, but disable position tracking
    super(input, { skipWhitespace: true, skipComments: true, trackPosition: false });
  }

  parse(): ASTNode {
    const expr = this.expression();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token: ${this.lexer.getTokenValue(this.peek())}`);
    }
    return expr;
  }

  // Implement abstract methods for node creation
  protected createIdentifierNode(name: string, token: Token): ASTNode {
    // Check if it's a type (starts with uppercase)
    if (name[0] && name[0] >= 'A' && name[0] <= 'Z') {
      return {
        type: NodeType.TypeOrIdentifier,
        name,
        offset: token.start
      } as TypeOrIdentifierNode;
    }
    
    return {
      type: NodeType.Identifier,
      name,
      offset: token.start
    } as IdentifierNode;
  }

  protected createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LiteralNode {
    return {
      type: NodeType.Literal,
      value,
      valueType,
      offset: token.start
    };
  }

  protected createBinaryNode(token: Token, left: ASTNode, right: ASTNode): BinaryNode {
    return {
      type: NodeType.Binary,
      operator: token.type,
      left,
      right,
      offset: token.start
    };
  }

  protected createUnaryNode(token: Token, operand: ASTNode): UnaryNode {
    return {
      type: NodeType.Unary,
      operator: token.type,
      operand,
      offset: token.start
    };
  }

  protected createFunctionNode(name: ASTNode, args: ASTNode[], position: Position): FunctionNode {
    return {
      type: NodeType.Function,
      name,
      arguments: args,
      offset: name.offset
    };
  }

  protected createVariableNode(name: string, token: Token): VariableNode {
    return {
      type: NodeType.Variable,
      name,
      offset: token.start
    };
  }

  protected createIndexNode(expression: ASTNode, index: ASTNode, position: Position): IndexNode {
    return {
      type: NodeType.Index,
      expression,
      index,
      offset: expression.offset
    };
  }


  protected createMembershipTestNode(expression: ASTNode, targetType: string, position: Position): MembershipTestNode {
    return {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      offset: expression.offset
    };
  }

  protected createTypeCastNode(expression: ASTNode, targetType: string, position: Position): TypeCastNode {
    return {
      type: NodeType.TypeCast,
      expression,
      targetType,
      offset: expression.offset
    };
  }

  protected createCollectionNode(elements: ASTNode[], position: Position): CollectionNode {
    return {
      type: NodeType.Collection,
      elements,
      offset: elements.length > 0 ? elements[0]?.offset : undefined
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