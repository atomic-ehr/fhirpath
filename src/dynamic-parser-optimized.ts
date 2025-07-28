import { DynamicLexer, Token } from './dynamic-lexer';
import { DynamicRegistryOptimized } from './dynamic-registry-optimized';
import { TokenType, TokenTypeValue } from './registry-tokens';
import { 
  NodeType, ASTNode, LiteralNode, IdentifierNode, BinaryOpNode, 
  UnaryOpNode, FunctionCallNode, MemberAccessNode, IndexNode, 
  CollectionNode, VariableNode 
} from './dynamic-parser';

/**
 * Optimized parser that uses bit-encoded precedence directly
 */
export class DynamicParserOptimized {
  private static readonly PRECEDENCE_SHIFT = 24;
  private static readonly PRECEDENCE_MASK = 0xFF;
  
  private tokens: Token[] = [];
  private current = 0;
  private lexer: DynamicLexer;
  private registry: DynamicRegistryOptimized;
  
  constructor(private input: string, registry: DynamicRegistryOptimized) {
    this.registry = registry;
    this.lexer = new DynamicLexer(input, registry);
    this.tokens = this.lexer.tokenize();
  }
  
  parse(): ASTNode {
    const expr = this.expression();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token: ${this.getTokenValue(this.peek())}`);
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
      
      // Special handling for DOT which has highest precedence
      if (token.type === TokenType.DOT) {
        this.advance();
        const member = this.parseInvocation();
        left = this.createMemberAccess(left, member);
        continue;
      }
      
      // Extract precedence directly from token using bit shift - SUPER FAST!
      const precedence = (token.type >>> DynamicParserOptimized.PRECEDENCE_SHIFT) & DynamicParserOptimized.PRECEDENCE_MASK;
      
      // Special case for tokens with hardcoded precedence
      let effectivePrecedence = precedence;
      if (precedence === 0) {
        // Check for special tokens
        switch (token.type) {
          case TokenType.LBRACKET:
          case TokenType.LPAREN:
            effectivePrecedence = 100;
            break;
          default:
            effectivePrecedence = -1;
        }
      }
      
      if (effectivePrecedence < minPrecedence) break;
      
      // Handle different operator types
      if (precedence > 0) { // It's an operator (has encoded precedence)
        // Binary operator
        this.advance();
        const associativity = this.registry.getAssociativity(token.type) || 'left';
        const nextMinPrecedence = associativity === 'left' ? precedence + 1 : precedence;
        const right = this.parseExpressionWithPrecedence(nextMinPrecedence);
        
        left = this.createBinaryOp(token, left, right);
      } else if (token.type === TokenType.LBRACKET) {
        // Index
        this.advance();
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']'");
        left = this.createIndex(left, index);
      } else if (token.type === TokenType.LPAREN && this.isFunctionCall(left)) {
        // Function call
        this.advance();
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        left = this.createFunctionCall(left, args);
      } else {
        break;
      }
    }
    
    return left;
  }
  
  private parsePrimary(): ASTNode {
    const token = this.peek();
    
    // Numbers
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return this.createLiteral(token, 'number', parseFloat(this.getTokenValue(token)));
    }
    
    // Strings
    if (token.type === TokenType.STRING) {
      this.advance();
      const value = this.parseStringValue(this.getTokenValue(token));
      return this.createLiteral(token, 'string', value);
    }
    
    // Booleans
    if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
      this.advance();
      return this.createLiteral(token, 'boolean', token.type === TokenType.TRUE);
    }
    
    // Null
    if (this.match(TokenType.NULL)) {
      return this.createLiteral(this.previous(), 'null', null);
    }
    
    // Variables
    if (token.type === TokenType.THIS || 
        token.type === TokenType.INDEX || 
        token.type === TokenType.TOTAL ||
        token.type === TokenType.ENV_VAR) {
      this.advance();
      return this.createVariable(token);
    }
    
    // Identifiers (including 'null' as identifier)
    if (token.type === TokenType.IDENTIFIER) {
      const value = this.getTokenValue(token);
      if (value === 'null') {
        this.advance();
        return this.createLiteral(token, 'null', null);
      }
      this.advance();
      return this.createIdentifier(token);
    }
    
    // Parentheses
    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')'");
      return expr;
    }
    
    // Collections
    if (token.type === TokenType.LBRACE) {
      this.advance();
      const elements = this.parseCollectionElements();
      this.consume(TokenType.RBRACE, "Expected '}'");
      return this.createCollection(this.previous(), elements);
    }
    
    // Unary operators - check if token has precedence but we're at start of expression
    const precedence = (token.type >>> DynamicParserOptimized.PRECEDENCE_SHIFT) & DynamicParserOptimized.PRECEDENCE_MASK;
    if (precedence > 0 && this.isUnaryOperator(token.type)) {
      this.advance();
      const operand = this.parseExpressionWithPrecedence(80); // High precedence for unary
      return this.createUnaryOp(token, operand);
    }
    
    throw new Error(`Unexpected token: ${this.getTokenValue(token)}`);
  }
  
  // All the helper methods remain the same...
  private parseInvocation(): ASTNode {
    const token = this.peek();
    
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      return this.createIdentifier(token);
    }
    
    throw new Error(`Expected identifier after '.', got: ${this.getTokenValue(token)}`);
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
  
  private parseStringValue(raw: string): string {
    const content = raw.slice(1, -1);
    return content.replace(/\\(.)/g, (_, char) => {
      switch (char) {
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case '\\': return '\\';
        case "'": return "'";
        case '"': return '"';
        default: return char;
      }
    });
  }
  
  private isUnaryOperator(tokenType: TokenTypeValue): boolean {
    const op = this.registry.getOperator(tokenType);
    if (op && op.symbol === '-') return true;
    return tokenType === TokenType.PLUS || tokenType === TokenType.MINUS;
  }
  
  private isFunctionCall(node: ASTNode): boolean {
    return node.type === NodeType.Identifier;
  }
  
  private peek(): Token {
    return this.tokens[this.current] || 
           { type: TokenType.EOF, start: 0, end: 0, line: 1, column: 1 };
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
  
  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }
  
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  private match(...types: TokenTypeValue[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private check(type: TokenTypeValue): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  
  private consume(type: TokenTypeValue, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at position ${this.peek().start}`);
  }
  
  private getTokenValue(token: Token): string {
    return this.lexer.getTokenValue(token);
  }
  
  // Node creation methods
  private createLiteral(token: Token, valueType: LiteralNode['valueType'], value: any): LiteralNode {
    return {
      type: NodeType.Literal,
      valueType,
      value,
      start: token.start,
      end: token.end,
    };
  }
  
  private createIdentifier(token: Token): IdentifierNode {
    return {
      type: NodeType.Identifier,
      name: this.getTokenValue(token),
      start: token.start,
      end: token.end,
    };
  }
  
  private createBinaryOp(token: Token, left: ASTNode, right: ASTNode): BinaryOpNode {
    return {
      type: NodeType.BinaryOp,
      operator: token.type,
      operatorSymbol: this.getTokenValue(token),
      left,
      right,
      start: left.start,
      end: right.end,
    };
  }
  
  private createUnaryOp(token: Token, operand: ASTNode): UnaryOpNode {
    return {
      type: NodeType.UnaryOp,
      operator: token.type,
      operatorSymbol: this.getTokenValue(token),
      operand,
      start: token.start,
      end: operand.end,
    };
  }
  
  private createFunctionCall(name: ASTNode, args: ASTNode[]): FunctionCallNode {
    const nameNode = name as IdentifierNode;
    return {
      type: NodeType.FunctionCall,
      name: nameNode.name,
      arguments: args,
      start: name.start,
      end: args.length > 0 ? args[args.length - 1].end : name.end,
    };
  }
  
  private createMemberAccess(object: ASTNode, member: ASTNode): MemberAccessNode {
    const memberNode = member as IdentifierNode;
    return {
      type: NodeType.MemberAccess,
      object,
      member: memberNode.name,
      start: object.start,
      end: member.end,
    };
  }
  
  private createIndex(object: ASTNode, index: ASTNode): IndexNode {
    return {
      type: NodeType.Index,
      object,
      index,
      start: object.start,
      end: this.previous().end,
    };
  }
  
  private createCollection(token: Token, elements: ASTNode[]): CollectionNode {
    return {
      type: NodeType.Collection,
      elements,
      start: token.start - 1,
      end: token.end,
    };
  }
  
  private createVariable(token: Token): VariableNode {
    return {
      type: NodeType.Variable,
      name: this.getTokenValue(token),
      start: token.start,
      end: token.end,
    };
  }
}