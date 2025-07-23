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
import { Registry } from '../registry';

export class ParseError extends Error {
  constructor(
    message: string,
    public position: Position,
    public token: Token
  ) {
    super(message);
  }
}

// Precedence levels for reference (from spec)
// INVOCATION: 1,      // . (dot), function calls
// POSTFIX: 2,         // [] indexing
// UNARY: 3,           // unary +, -, not
// MULTIPLICATIVE: 4,  // *, /, div, mod
// ADDITIVE: 5,        // +, -, &
// TYPE: 6,            // is, as
// UNION: 7,           // |
// RELATIONAL: 8,      // <, >, <=, >=
// EQUALITY: 9,        // =, ~, !=, !~
// MEMBERSHIP: 10,     // in, contains
// AND: 11,            // and
// OR: 12,             // or, xor
// IMPLIES: 13,        // implies

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
      if (this.check(TokenType.LBRACKET) && minPrecedence >= 2) { // POSTFIX precedence
        left = this.parseIndex(left);
        continue;
      }
      
      // Handle function calls that come from primary() or after dots
      // This allows for chained method calls like exists().not()
      if (this.check(TokenType.DOT) && minPrecedence >= 1) { // INVOCATION precedence
        const dotToken = this.peek();
        const precedence = this.getPrecedence(dotToken);
        if (precedence > minPrecedence) break;
        
        left = this.parseBinary(left, dotToken, precedence);
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
    // Handle registry-based literals
    if (this.match(TokenType.LITERAL)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.literalValue ?? token.value,
        valueType: this.inferLiteralType(token.literalValue ?? token.value),
        raw: token.value,
        operation: token.operation,
        position: token.position
      } as LiteralNode;
    }
    
    // Handle legacy literals
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
      
      // Check for method calls after parentheses (e.g., (expr).method())
      let result = expr;
      while (this.check(TokenType.DOT)) {
        const dotToken = this.advance();
        
        // After a dot, handle keywords that can be method names
        let right: ASTNode;
        const next = this.peek();
        if (this.isOperatorKeyword(next.type)) {
          // Treat keyword as identifier
          this.advance();
          right = {
            type: NodeType.Identifier,
            name: next.value,
            position: next.position
          } as IdentifierNode;
        } else {
          right = this.primary();
        }
        
        // If the right side is a function call, handle it
        if (this.check(TokenType.LPAREN)) {
          const methodNode: BinaryNode = {
            type: NodeType.Binary,
            operator: TokenType.DOT,
            operation: Registry.getByToken(TokenType.DOT),
            left: result,
            right: right,
            position: dotToken.position
          };
          result = this.functionCall(methodNode);
        } else {
          // Regular property access
          result = {
            type: NodeType.Binary,
            operator: TokenType.DOT,
            operation: Registry.getByToken(TokenType.DOT),
            left: result,
            right: right,
            position: dotToken.position
          } as BinaryNode;
        }
      }
      
      return result;
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
      const operation = op.operation || Registry.getByToken(op.type);
      const right = this.expression(3); // UNARY precedence
      return {
        type: NodeType.Unary,
        operator: op.type,
        operation: operation,
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
    
    // Handle operator keywords as identifiers/functions at expression start
    if (this.isOperatorKeyword(this.peek().type)) {
      const token = this.advance();
      const identifier: IdentifierNode = {
        type: NodeType.Identifier,
        name: token.value,
        position: token.position
      };
      
      // Check for function call
      if (this.check(TokenType.LPAREN)) {
        return this.functionCall(identifier);
      }
      
      return identifier;
    }
    
    throw this.error("Expected expression");
  }
  
  // Parse binary operators with precedence
  private parseBinary(left: ASTNode, op: Token, precedence: number): ASTNode {
    const operation = op.operation || Registry.getByToken(op.type);
    if (!operation && op.type !== TokenType.DOT && op.type !== TokenType.IS && op.type !== TokenType.AS) {
      throw this.error(`Unknown operator: ${op.value}`);
    }
    // Special handling for type operators
    if (op.type === TokenType.IS || op.type === TokenType.AS) {
      this.advance(); // consume operator
      
      // Type name can be either a simple identifier or in parentheses (for is() function syntax)
      let typeName: string;
      if (this.check(TokenType.LPAREN)) {
        // Handle is(TypeName) syntax
        this.advance(); // consume (
        typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
        this.consume(TokenType.RPAREN, "Expected ')' after type name");
      } else {
        // Regular is TypeName syntax
        typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
      }
      
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
      // After a dot, we need to handle keywords that can be method names
      let right: ASTNode;
      
      // Check if next token is a keyword that can be used as a method name
      const next = this.peek();
      if (this.isOperatorKeyword(next.type)) {
        // Treat keyword as identifier
        this.advance();
        right = {
          type: NodeType.Identifier,
          name: next.value,
          position: next.position
        } as IdentifierNode;
      } else {
        right = this.primary();
      }
      
      // Check for function call after dot
      if (this.peek().type === TokenType.LPAREN) {
        const dotNode: BinaryNode = {
          type: NodeType.Binary,
          operator: TokenType.DOT,
          operation: operation,
          left: left,
          right: right,
          position: op.position
        };
        return this.functionCall(dotNode);
      }
      
      return {
        type: NodeType.Binary,
        operator: TokenType.DOT,
        operation: operation,
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
      operation: operation,
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
    
    let result: ASTNode = {
      type: NodeType.Function,
      name: func,
      arguments: args,
      position: func.position
    } as FunctionNode;
    
    // Check for method calls after the function (e.g., exists().not())
    while (this.check(TokenType.DOT)) {
      const dotToken = this.advance();
      
      // After a dot, handle keywords that can be method names
      let right: ASTNode;
      const next = this.peek();
      if (this.isOperatorKeyword(next.type)) {
        // Treat keyword as identifier
        this.advance();
        right = {
          type: NodeType.Identifier,
          name: next.value,
          position: next.position
        } as IdentifierNode;
      } else {
        right = this.primary();
      }
      
      // If the right side is a function call, handle it
      if (this.check(TokenType.LPAREN)) {
        const methodNode: BinaryNode = {
          type: NodeType.Binary,
          operator: TokenType.DOT,
          operation: Registry.getByToken(TokenType.DOT),
          left: result,
          right: right,
          position: dotToken.position
        };
        result = this.functionCall(methodNode);
      } else {
        // Regular property access
        result = {
          type: NodeType.Binary,
          operator: TokenType.DOT,
          operation: Registry.getByToken(TokenType.DOT),
          left: result,
          right: right,
          position: dotToken.position
        } as BinaryNode;
      }
    }
    
    return result;
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
      // Special handling for is(TypeName) - treat as regular function
      if (identifier.name === 'is') {
        return this.functionCall(identifier);
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
    // Special case for DOT which might not be in registry yet
    if (token.type === TokenType.DOT) return 1;
    
    // Use registry for all other operators
    const registryPrecedence = Registry.getPrecedence(token.type);
    
    // Registry uses standard convention (higher number = higher precedence)
    // Parser uses inverted convention (lower number = higher precedence)
    // So we need to invert the value
    if (registryPrecedence === 0) return 0; // No precedence
    
    // The Registry precedence values seem to be inverted from FHIRPath spec
    // We need to map them correctly:
    // Registry -> Parser (lower is higher precedence)
    // 1 (implies) -> 13
    // 2 (or) -> 12  
    // 3 (and) -> 11
    // 5 (additive) -> 5
    // 6 (multiplicative, type) -> 4
    // 8 (relational) -> 8
    // 9 (equality) -> 9
    // 10 (membership, unary) -> 10 or 3
    // 13 (union) -> 7
    
    // For now, use the simple inversion but adjust for proper ordering
    // Multiplicative (6) should have higher precedence than comparison (8-9)
    // So we need a different mapping
    const precedenceMap: Record<number, number> = {
      1: 13,  // implies - lowest
      2: 12,  // or, xor
      3: 11,  // and
      5: 5,   // additive (+, -, &)
      6: 4,   // multiplicative (*, /, div, mod) and type (is, as)
      8: 8,   // relational (<, >, <=, >=)
      9: 9,   // equality (=, !=, ~, !~)
      10: 10, // membership (in, contains) - but unary should be 3
      13: 7   // union (|)
    };
    
    return precedenceMap[registryPrecedence] ?? (15 - registryPrecedence);
  }
  
  // Helper to infer literal type from value
  private inferLiteralType(value: any): 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null' {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (value instanceof Date) {
      // Check if it has time component
      const hasTime = value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
      return hasTime ? 'datetime' : 'date';
    }
    // Check for time-only values (stored as strings like "14:30:00")
    if (typeof value === 'object' && value.type === 'time') return 'time';
    return 'string'; // default
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
  
  // Check if a token type is an operator keyword that can also be identifier/function
  private isOperatorKeyword(type: TokenType): boolean {
    return type === TokenType.DIV || 
           type === TokenType.MOD ||
           type === TokenType.CONTAINS ||
           type === TokenType.IN ||
           type === TokenType.AND ||
           type === TokenType.OR ||
           type === TokenType.XOR ||
           type === TokenType.IMPLIES ||
           type === TokenType.IS ||
           type === TokenType.AS ||
           type === TokenType.NOT ||
           type === TokenType.TRUE ||
           type === TokenType.FALSE;
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