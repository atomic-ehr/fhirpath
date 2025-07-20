import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';
import { lex } from '../lexer/lexer';
import type { Position } from './ast';
import {
  type ASTNode,
  type BinaryNode,
  type UnaryNode,
  type LiteralNode,
  type IdentifierNode,
  type TypeOrIdentifierNode,
  type FunctionNode,
  type VariableNode,
  type IndexNode,
  type UnionNode,
  type MembershipTestNode,
  type TypeCastNode,
  type CollectionNode,
  type TypeReferenceNode,
  NodeType
} from './ast';

export class ParseError extends Error {
  constructor(
    message: string,
    public position: Position,
    public token: Token
  ) {
    super(message);
  }
}

// Precedence table
const PRECEDENCE = {
  // Highest to lowest (matching spec numbering)
  INVOCATION: 1,      // . (dot), function calls
  POSTFIX: 2,         // [] indexing
  UNARY: 3,           // unary +, -, not
  MULTIPLICATIVE: 4,  // *, /, div, mod
  ADDITIVE: 5,        // +, -, &
  TYPE: 6,            // is, as
  UNION: 7,           // |
  RELATIONAL: 8,      // <, >, <=, >=
  EQUALITY: 9,        // =, ~, !=, !~
  MEMBERSHIP: 10,     // in, contains
  AND: 11,            // and
  OR: 12,             // or, xor
  IMPLIES: 13,        // implies
};

export class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  
  constructor(input: string | Token[]) {
    if (typeof input === 'string') {
      this.tokens = lex(input);  // Assuming lex function from lexer
    } else {
      this.tokens = input;
    }
    this.current = 0;
  }
  
  // Main entry point
  parse(): ASTNode {
    const ast = this.expression();
    if (!this.isAtEnd()) {
      throw this.error("Unexpected token after expression");
    }
    return ast;
  }
  
  // Pratt parser for expressions
  private expression(minPrecedence: number = 14): ASTNode {
    let left = this.primary();
    
    while (!this.isAtEnd()) {
      // Handle postfix operators first
      if (this.check(TokenType.LBRACKET) && minPrecedence >= PRECEDENCE.POSTFIX) {
        left = this.parseIndex(left);
        continue;
      }
      
      const token = this.peek();
      const precedence = this.getPrecedence(token);
      
      if (precedence === 0 || precedence > minPrecedence) break;
      
      left = this.parseBinary(left, token, precedence);
    }
    
    return left;
  }
  
  // Parse primary expressions (recursive descent)
  private primary(): ASTNode {
    // Handle literals
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: parseFloat(token.value),
        valueType: 'number',
        position: token.position
      } as LiteralNode;
    }
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.value,
        valueType: 'string',
        position: token.position
      } as LiteralNode;
    }
    if (this.match(TokenType.TRUE, TokenType.FALSE)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.type === TokenType.TRUE,
        valueType: 'boolean',
        position: token.position
      } as LiteralNode;
    }
    if (this.match(TokenType.NULL)) {
      return {
        type: NodeType.Literal,
        value: null,
        valueType: 'null',
        position: this.previous().position
      } as LiteralNode;
    }
    
    // Handle variables
    if (this.match(TokenType.THIS)) {
      return {
        type: NodeType.Variable,
        name: '$this',
        position: this.previous().position
      } as VariableNode;
    }
    if (this.match(TokenType.INDEX)) {
      return {
        type: NodeType.Variable,
        name: '$index',
        position: this.previous().position
      } as VariableNode;
    }
    if (this.match(TokenType.TOTAL)) {
      return {
        type: NodeType.Variable,
        name: '$total',
        position: this.previous().position
      } as VariableNode;
    }
    if (this.match(TokenType.ENV_VAR)) {
      return {
        type: NodeType.Variable,
        name: this.previous().value,
        position: this.previous().position
      } as VariableNode;
    }
    
    // Handle dates/times
    if (this.match(TokenType.DATE, TokenType.DATETIME, TokenType.TIME)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.value,
        valueType: token.type === TokenType.DATE ? 'date' : 
                   token.type === TokenType.TIME ? 'time' : 'datetime',
        position: token.position
      } as LiteralNode;
    }
    
    // Handle grouping
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }
    
    // Handle identifiers (which might be followed by function calls)
    if (this.match(TokenType.IDENTIFIER)) {
      return this.identifierOrFunctionCall();
    }
    
    // Handle delimited identifiers
    if (this.match(TokenType.DELIMITED_IDENTIFIER)) {
      return this.identifierOrFunctionCall();
    }
    
    // Handle unary operators
    if (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.NOT)) {
      const op = this.previous();
      const right = this.expression(PRECEDENCE.UNARY);
      return {
        type: NodeType.Unary,
        operator: op.type,
        operand: right,
        position: op.position
      } as UnaryNode;
    }
    
    // Handle empty collection {} or collection literals {expr1, expr2, ...}
    if (this.match(TokenType.LBRACE)) {
      const startPos = this.previous().position;
      const elements: ASTNode[] = [];
      
      if (!this.check(TokenType.RBRACE)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RBRACE, "Expected '}' after collection elements");
      return {
        type: NodeType.Collection,
        elements: elements,
        position: startPos
      } as CollectionNode;
    }
    
    throw this.error("Expected expression");
  }
  
  // Parse binary operators with precedence
  private parseBinary(left: ASTNode, op: Token, precedence: number): ASTNode {
    // Special handling for type operators
    if (op.type === TokenType.IS || op.type === TokenType.AS) {
      this.advance(); // consume operator
      
      // Type name is an identifier, not an expression
      const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
      
      return {
        type: op.type === TokenType.IS ? NodeType.MembershipTest : NodeType.TypeCast,
        expression: left,
        targetType: typeName,
        position: op.position
      } as MembershipTestNode | TypeCastNode;
    }
    
    this.advance(); // consume operator
    
    // Special handling for union operator - can chain multiple
    if (op.type === TokenType.PIPE) {
      const right = this.expression(precedence - 1);
      
      // If left is already a union, add to it
      if (left.type === NodeType.Union) {
        (left as UnionNode).operands.push(right);
        return left;
      }
      
      // Create new union node
      return {
        type: NodeType.Union,
        operands: [left, right],
        position: op.position
      } as UnionNode;
    }
    
    // Special handling for dot operator (left-associative, pipelines data)
    if (op.type === TokenType.DOT) {
      const right = this.primary();
      
      // Check for function call after dot
      if (this.peek().type === TokenType.LPAREN) {
        const dotNode: BinaryNode = {
          type: NodeType.Binary,
          operator: TokenType.DOT,
          left: left,
          right: right,
          position: op.position
        };
        return this.functionCall(dotNode);
      }
      
      return {
        type: NodeType.Binary,
        operator: TokenType.DOT,
        left: left,
        right: right,
        position: op.position
      } as BinaryNode;
    }
    
    // Right-associative operators (none in FHIRPath currently)
    const associativity = this.isRightAssociative(op) ? 0 : -1;
    const right = this.expression(precedence + associativity);
    
    return {
      type: NodeType.Binary,
      operator: op.type,
      left: left,
      right: right,
      position: op.position
    } as BinaryNode;
  }
  
  // Parse function calls
  private functionCall(func: ASTNode): ASTNode {
    this.consume(TokenType.LPAREN, "Expected '(' after function");
    
    const args: ASTNode[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RPAREN, "Expected ')' after arguments");
    
    return {
      type: NodeType.Function,
      name: func,
      arguments: args,
      position: func.position
    } as FunctionNode;
  }
  
  // Handle indexing
  private parseIndex(expr: ASTNode): ASTNode {
    this.consume(TokenType.LBRACKET, "Expected '['");
    const index = this.expression();
    this.consume(TokenType.RBRACKET, "Expected ']'");
    
    return {
      type: NodeType.Index,
      expression: expr,
      index: index,
      position: expr.position
    } as IndexNode;
  }
  
  private identifierOrFunctionCall(): ASTNode {
    const name = this.previous().value;
    const position = this.previous().position;
    
    // Check if identifier starts with uppercase (potential type)
    const firstChar = name.charAt(0);
    const isUpperCase = firstChar && firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
    
    const identifier: IdentifierNode | TypeOrIdentifierNode = isUpperCase ? {
      type: NodeType.TypeOrIdentifier,
      name: name,
      position: position
    } : {
      type: NodeType.Identifier,
      name: name,
      position: position
    };
    
    // Check for function call
    if (this.check(TokenType.LPAREN)) {
      // Special handling for ofType(TypeName)
      if (identifier.name === 'ofType') {
        return this.parseOfType();
      }
      return this.functionCall(identifier);
    }
    
    return identifier;
  }
  
  private parseOfType(): ASTNode {
    this.consume(TokenType.LPAREN, "Expected '(' after ofType");
    const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
    this.consume(TokenType.RPAREN, "Expected ')' after type name");
    
    return {
      type: NodeType.Function,
      name: {
        type: NodeType.Identifier,
        name: 'ofType',
        position: this.previous().position
      } as IdentifierNode,
      arguments: [{
        type: NodeType.TypeReference,
        typeName: typeName,
        position: this.previous().position
      } as TypeReferenceNode],
      position: this.previous().position
    } as FunctionNode;
  }
  
  // Precedence lookup (high precedence = low number)
  private getPrecedence(token: Token): number {
    switch (token.type) {
      case TokenType.DOT: return 1;           // Highest precedence
      // Indexing is postfix, handled separately
      // Unary operators handled in primary()
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.DIV:
      case TokenType.MOD: return 4;
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.CONCAT: return 5;
      case TokenType.IS:
      case TokenType.AS: return 6;
      case TokenType.PIPE: return 7;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE: return 8;
      case TokenType.EQ:
      case TokenType.NEQ:
      case TokenType.EQUIV:
      case TokenType.NEQUIV: return 9;
      case TokenType.IN:
      case TokenType.CONTAINS: return 10;
      case TokenType.AND: return 11;
      case TokenType.OR:
      case TokenType.XOR: return 12;
      case TokenType.IMPLIES: return 13;      // Lowest precedence
      default: return 0;
    }
  }
  
  // Helper methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private peek(): Token {
    return this.tokens[this.current]!;
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }
  
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message);
  }
  
  private error(message: string): ParseError {
    const pos = this.peek().position;
    const fullMessage = `${message} at line ${pos.line}, column ${pos.column}`;
    return new ParseError(fullMessage, pos, this.peek());
  }
  
  private isRightAssociative(op: Token): boolean {
    // FHIRPath doesn't have right-associative operators
    return false;
  }
  
  // Synchronization points for error recovery
  private synchronize() {
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.COMMA) return;
      if (this.previous().type === TokenType.RPAREN) return;
      
      switch (this.peek().type) {
        case TokenType.IDENTIFIER:
          return;
      }
      
      this.advance();
    }
  }
}

// Export convenience function
export function parse(input: string | Token[]): ASTNode {
  const parser = new FHIRPathParser(input);
  return parser.parse();
}