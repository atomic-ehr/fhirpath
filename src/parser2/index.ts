import { Lexer, TokenType } from '../lexer2';
import type { Token } from '../lexer2';

// AST Types
export interface Position {
  line: number;
  column: number;
  offset: number;
}

export enum NodeType {
  // Navigation
  Identifier,
  TypeOrIdentifier,
  
  // Operators
  Binary,
  Unary,
  Union,
  
  // Functions
  Function,
  
  // Literals
  Literal,
  Variable,
  Collection,
  
  // Type operations
  MembershipTest,
  TypeCast,
  TypeReference,
  
  // Special
  Index,
}

export interface ASTNode {
  type: NodeType;
  position: Position;
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

export interface UnionNode extends ASTNode {
  type: NodeType.Union;
  operands: ASTNode[];
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

export class Parser {
  private lexer: Lexer;
  private tokens: Token[] = [];
  private current = 0;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.tokens = this.lexer.tokenize();
  }

  parse(): ASTNode {
    const expr = this.expression();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token: ${this.lexer.getTokenValue(this.peek())}`);
    }
    return expr;
  }

  private expression(): ASTNode {
    return this.parseExpressionWithPrecedence(0);
  }

  private parseExpressionWithPrecedence(minPrecedence: number): ASTNode {
    let left = this.parsePrimary();

    while (!this.isAtEnd()) {
      const token = this.peek();
      const precedence = this.getPrecedence(token.type);
      
      if (precedence < minPrecedence) break;

      if (token.type === TokenType.DOT) {
        this.advance();
        const right = this.parseInvocation();
        left = this.createBinaryNode(token, left, right);
      } else if (this.isBinaryOperator(token.type)) {
        this.advance();
        const associativity = this.getAssociativity(token.type);
        const nextMinPrecedence = associativity === 'left' ? precedence + 1 : precedence;
        const right = this.parseExpressionWithPrecedence(nextMinPrecedence);
        
        if (token.type === TokenType.PIPE && left.type === NodeType.Union) {
          (left as UnionNode).operands.push(right);
        } else if (token.type === TokenType.PIPE) {
          left = this.createUnionNode([left, right], this.getPosition(token));
        } else {
          left = this.createBinaryNode(token, left, right);
        }
      } else if (token.type === TokenType.IS) {
        this.advance();
        const typeName = this.parseTypeName();
        left = this.createMembershipTestNode(left, typeName, this.getPosition(token));
      } else if (token.type === TokenType.AS) {
        this.advance();
        const typeName = this.parseTypeName();
        left = this.createTypeCastNode(left, typeName, this.getPosition(token));
      } else if (token.type === TokenType.LBRACKET) {
        this.advance();
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']'");
        left = this.createIndexNode(left, index, this.getPosition(token));
      } else if (token.type === TokenType.LPAREN && this.isFunctionCall(left)) {
        const parenToken = token;
        this.advance();
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        left = this.createFunctionNode(left, args, left.position);
      } else {
        break;
      }
    }

    return left;
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === TokenType.NUMBER) {
      this.advance();
      return this.createLiteralNode(parseFloat(this.lexer.getTokenValue(token)), 'number', token);
    }

    if (token.type === TokenType.STRING) {
      this.advance();
      const value = this.parseStringValue(this.lexer.getTokenValue(token));
      return this.createLiteralNode(value, 'string', token);
    }

    if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
      this.advance();
      return this.createLiteralNode(token.type === TokenType.TRUE, 'boolean', token);
    }

    if (token.type === TokenType.NULL || (token.type === TokenType.IDENTIFIER && this.lexer.getTokenValue(token) === 'null')) {
      this.advance();
      return this.createLiteralNode(null, 'null', token);
    }

    if (token.type === TokenType.DATETIME) {
      this.advance();
      const value = this.lexer.getTokenValue(token).substring(1); // Remove @
      return this.createLiteralNode(value, 'datetime', token);
    }

    if (token.type === TokenType.TIME) {
      this.advance();
      const value = this.lexer.getTokenValue(token).substring(1); // Remove @
      return this.createLiteralNode(value, 'time', token);
    }

    if (token.type === TokenType.THIS || token.type === TokenType.INDEX || token.type === TokenType.TOTAL) {
      this.advance();
      return this.createVariableNode(this.lexer.getTokenValue(token), token);
    }

    if (token.type === TokenType.ENV_VAR) {
      this.advance();
      const value = this.lexer.getTokenValue(token);
      return this.createVariableNode(value, token);
    }

    if (token.type === TokenType.IDENTIFIER || 
        token.type === TokenType.DELIMITED_IDENTIFIER ||
        this.isKeywordAllowedAsIdentifier(token.type)) {
      this.advance();
      const name = this.parseIdentifierValue(this.lexer.getTokenValue(token));
      return this.createIdentifierNode(name, token);
    }

    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')'");
      return expr;
    }

    if (token.type === TokenType.LBRACE) {
      this.advance();
      const elements = this.parseCollectionElements();
      this.consume(TokenType.RBRACE, "Expected '}'");
      return this.createCollectionNode(elements, this.getPosition(token));
    }

    if (token.type === TokenType.PLUS || token.type === TokenType.MINUS) {
      this.advance();
      const operand = this.parseExpressionWithPrecedence(this.getPrecedence(TokenType.MULTIPLY));
      return this.createUnaryNode(token, operand);
    }

    throw new Error(`Unexpected token: ${this.lexer.getTokenValue(token)}`);
  }

  private parseInvocation(): ASTNode {
    const token = this.peek();
    
    // Allow identifiers and keywords that can be used as member names
    if (token.type === TokenType.IDENTIFIER || 
        token.type === TokenType.DELIMITED_IDENTIFIER ||
        this.isKeywordAllowedAsMember(token.type)) {
      this.advance();
      const name = this.parseIdentifierValue(this.lexer.getTokenValue(token));
      const node = this.createIdentifierNode(name, token);
      
      // Check if this is a function call
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        return this.createFunctionNode(node, args, node.position);
      }
      
      return node;
    }
    
    // Allow environment variables after dot (like .%resource)
    if (token.type === TokenType.ENV_VAR) {
      this.advance();
      const value = this.lexer.getTokenValue(token);
      return this.createVariableNode(value, token);
    }

    throw new Error(`Expected identifier after '.', got: ${this.lexer.getTokenValue(token)}`);
  }
  
  private isKeywordAllowedAsMember(type: TokenType): boolean {
    // Keywords that can be used as member names
    return [
      TokenType.CONTAINS,
      TokenType.AND,
      TokenType.OR,
      TokenType.XOR,
      TokenType.IMPLIES,
      TokenType.AS,
      TokenType.IS,
      TokenType.DIV,
      TokenType.MOD,
      TokenType.IN,
      TokenType.TRUE,
      TokenType.FALSE
    ].includes(type);
  }
  
  private isKeywordAllowedAsIdentifier(type: TokenType): boolean {
    // Keywords that can be used as identifiers in certain contexts
    return this.isKeywordAllowedAsMember(type);
  }

  private parseArgumentList(): ASTNode[] {
    const args: ASTNode[] = [];
    
    if (this.peek().type === TokenType.RPAREN) {
      return args;
    }

    args.push(this.expression());
    
    while (this.match(TokenType.COMMA)) {
      args.push(this.expression());
    }

    return args;
  }

  private parseCollectionElements(): ASTNode[] {
    const elements: ASTNode[] = [];
    
    if (this.peek().type === TokenType.RBRACE) {
      return elements;
    }

    elements.push(this.expression());
    
    while (this.match(TokenType.COMMA)) {
      elements.push(this.expression());
    }

    return elements;
  }

  private parseTypeName(): string {
    const token = this.advance();
    if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.DELIMITED_IDENTIFIER) {
      throw new Error(`Expected type name, got: ${this.lexer.getTokenValue(token)}`);
    }
    return this.parseIdentifierValue(this.lexer.getTokenValue(token));
  }

  private parseStringValue(raw: string): string {
    // Remove quotes and handle escape sequences
    const content = raw.slice(1, -1);
    return content.replace(/\\(.)/g, (_, char) => {
      switch (char) {
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case 'f': return '\f';
        case '\\': return '\\';
        case "'": return "'";
        case '"': return '"';
        case '`': return '`';
        case '/': return '/';
        default: return char;
      }
    });
  }

  private parseIdentifierValue(raw: string): string {
    if (raw.startsWith('`')) {
      // Delimited identifier - remove backticks and handle escapes
      return raw.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    return raw;
  }

  private isFunctionCall(node: ASTNode): boolean {
    return node.type === NodeType.Identifier || node.type === NodeType.TypeOrIdentifier;
  }

  private isBinaryOperator(type: TokenType): boolean {
    return [
      TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE,
      TokenType.DIV, TokenType.MOD, TokenType.AMPERSAND, TokenType.PIPE,
      TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE,
      TokenType.EQ, TokenType.NEQ, TokenType.SIMILAR, TokenType.NOT_SIMILAR,
      TokenType.AND, TokenType.OR, TokenType.XOR, TokenType.IMPLIES,
      TokenType.IN, TokenType.CONTAINS
    ].includes(type);
  }

  private getPrecedence(type: TokenType): number {
    switch (type) {
      case TokenType.DOT: return 100;
      case TokenType.LBRACKET: return 100;
      case TokenType.LPAREN: return 100;
      case TokenType.IS: return 90;
      case TokenType.AS: return 90;
      case TokenType.MULTIPLY:
      case TokenType.DIVIDE:
      case TokenType.DIV:
      case TokenType.MOD: return 80;
      case TokenType.PLUS:
      case TokenType.MINUS: return 70;
      case TokenType.AMPERSAND: return 60;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE: return 50;
      case TokenType.EQ:
      case TokenType.NEQ:
      case TokenType.SIMILAR:
      case TokenType.NOT_SIMILAR: return 40;
      case TokenType.IN:
      case TokenType.CONTAINS: return 35;
      case TokenType.AND: return 30;
      case TokenType.OR:
      case TokenType.XOR: return 20;
      case TokenType.IMPLIES: return 10;
      case TokenType.PIPE: return 5;
      default: return 0;
    }
  }

  private getAssociativity(type: TokenType): 'left' | 'right' {
    // Most operators are left associative
    // Only implies is right associative
    return type === TokenType.IMPLIES ? 'right' : 'left';
  }

  private getPosition(token: Token): Position {
    return {
      line: token.line,
      column: token.column,
      offset: token.start
    };
  }

  private createIdentifierNode(name: string, token: Token): ASTNode {
    const position = this.getPosition(token);
    
    // Check if it's a type (starts with uppercase)
    if (name[0] && name[0] >= 'A' && name[0] <= 'Z') {
      return {
        type: NodeType.TypeOrIdentifier,
        name,
        position
      } as TypeOrIdentifierNode;
    }
    
    return {
      type: NodeType.Identifier,
      name,
      position
    } as IdentifierNode;
  }

  private createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LiteralNode {
    return {
      type: NodeType.Literal,
      value,
      valueType,
      position: this.getPosition(token)
    };
  }

  private createBinaryNode(token: Token, left: ASTNode, right: ASTNode): BinaryNode {
    return {
      type: NodeType.Binary,
      operator: token.type,
      left,
      right,
      position: this.getPosition(token)
    };
  }

  private createUnaryNode(token: Token, operand: ASTNode): UnaryNode {
    return {
      type: NodeType.Unary,
      operator: token.type,
      operand,
      position: this.getPosition(token)
    };
  }

  private createFunctionNode(name: ASTNode, args: ASTNode[], position: Position): FunctionNode {
    return {
      type: NodeType.Function,
      name,
      arguments: args,
      position
    };
  }

  private createVariableNode(name: string, token: Token): VariableNode {
    return {
      type: NodeType.Variable,
      name,
      position: this.getPosition(token)
    };
  }

  private createIndexNode(expression: ASTNode, index: ASTNode, position: Position): IndexNode {
    return {
      type: NodeType.Index,
      expression,
      index,
      position
    };
  }

  private createUnionNode(operands: ASTNode[], position: Position): UnionNode {
    return {
      type: NodeType.Union,
      operands,
      position
    };
  }

  private createMembershipTestNode(expression: ASTNode, targetType: string, position: Position): MembershipTestNode {
    return {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      position
    };
  }

  private createTypeCastNode(expression: ASTNode, targetType: string, position: Position): TypeCastNode {
    return {
      type: NodeType.TypeCast,
      expression,
      targetType,
      position
    };
  }

  private createCollectionNode(elements: ASTNode[], position: Position): CollectionNode {
    return {
      type: NodeType.Collection,
      elements,
      position
    };
  }

  // Helper methods
  private peek(): Token {
    return this.tokens[this.current] || { type: TokenType.EOF, start: 0, end: 0, line: 1, column: 1 };
  }

  private previous(): Token {
    return this.tokens[this.current - 1] || { type: TokenType.EOF, start: 0, end: 0, line: 1, column: 1 };
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(message + ` at token: ${this.lexer.getTokenValue(this.peek())}`);
  }
}

export function parse(input: string): ASTNode {
  const parser = new Parser(input);
  return parser.parse();
}