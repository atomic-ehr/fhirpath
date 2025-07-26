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
  type ErrorNode,
  type IncompleteNode,
  NodeType
} from './ast';
import { Registry } from '../registry';
import { 
  type ParserOptions, 
  type ParseResult, 
  type TextRange
} from './types';
import { DiagnosticCollector } from './diagnostics';
import { SourceMapper } from './source-mapper';
import { ContextualErrorReporter, ParseContext } from './error-reporter';
import { FHIRPathDiagnostics } from './diagnostic-messages';
import { ErrorCode } from '../api/errors';

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
  private throwOnError: boolean;
  private trackRanges: boolean;
  private errorRecovery: boolean;
  private diagnostics?: DiagnosticCollector;
  private sourceMapper?: SourceMapper;
  private errorReporter?: ContextualErrorReporter;
  private input: string;
  private isPartial: boolean = false;
  private currentContext: ParseContext = ParseContext.Expression;
  
  constructor(input: string | Token[], options: ParserOptions = {}) {
    this.throwOnError = options.throwOnError ?? false;
    this.trackRanges = options.trackRanges ?? false;
    this.errorRecovery = options.errorRecovery ?? false;
    
    if (typeof input === 'string') {
      this.input = input;
      try {
        this.tokens = lex(input);
      } catch (error: any) {
        // If throwOnError is true, re-throw lexer errors
        if (this.throwOnError) {
          throw error;
        }
        // Otherwise, we'll handle lexer errors in parse()
        this.tokens = [];
        // Store the lexer error for later processing
        (this as any).lexerError = error;
      }
    } else {
      this.tokens = input;
      // For token array input, we'll construct a minimal input string
      this.input = input.map(t => t.value).join(' ');
    }
    
    this.current = 0;
    this.initializeForMode(this.input, options);
  }
  
  private initializeForMode(input: string, options: ParserOptions): void {
    // Always create diagnostic collector unless throwOnError is true
    if (!this.throwOnError) {
      this.diagnostics = new DiagnosticCollector(options.maxErrors);
    }
    
    // Only create source mapper if needed
    if (this.trackRanges || !this.throwOnError) {
      this.sourceMapper = new SourceMapper(input);
    }
    
    // Only create error reporter if error recovery is enabled
    if (this.errorRecovery && this.diagnostics && this.sourceMapper) {
      this.errorReporter = new ContextualErrorReporter(this.sourceMapper, this.diagnostics);
    }
  }
  
  // Main entry point
  parse(): ParseResult {
    if (this.errorRecovery) {
      return this.parseWithRecovery();
    } else {
      return this.parseStandard();
    }
  }
  
  
  private parseStandard(): ParseResult {
    let ast: ASTNode;
    
    // Check for lexer errors first
    if ((this as any).lexerError) {
      const error = (this as any).lexerError;
      
      // If throwOnError is true, throw immediately
      if (this.throwOnError) {
        throw error;
      }
      
      // Map lexer error positions to our range format
      const range: TextRange = {
        start: { 
          line: error.position.line - 1,  // Lexer uses 1-based lines, we use 0-based
          character: error.position.column - 1,  // Lexer uses 1-based columns, we use 0-based
          offset: error.position.offset 
        },
        end: { 
          line: error.position.line - 1, 
          character: error.position.column,  // One character after the error
          offset: error.position.offset + 1 
        }
      };
      
      // Map specific lexer errors to appropriate error codes
      let errorCode = ErrorCode.SYNTAX_ERROR;
      if (error.message.includes('Invalid escape sequence')) {
        errorCode = ErrorCode.INVALID_ESCAPE;
      } else if (error.message.includes('Unterminated string')) {
        errorCode = ErrorCode.UNTERMINATED_STRING;
      }
      
      this.diagnostics!.addError(range, error.message, errorCode);
      
      // Return minimal AST with error
      return {
        ast: {
          type: NodeType.Literal,
          value: null,
          valueType: 'null',
          position: { line: 1, column: 1, offset: 0 }
        } as LiteralNode,
        diagnostics: this.diagnostics!.getDiagnostics(),
        hasErrors: true
      };
    }
    
    try {
      ast = this.expression();
      
      if (!this.isAtEnd()) {
        if (this.throwOnError) {
          throw this.error("Unexpected token after expression", ErrorCode.UNEXPECTED_TOKEN);
        }
        // Otherwise, report as diagnostic
        const unexpectedToken = this.peek();
        const range = this.sourceMapper!.tokenToRange(unexpectedToken);
        this.diagnostics!.addError(
          range,
          `Unexpected token '${unexpectedToken.value}' after expression`,
          ErrorCode.UNEXPECTED_TOKEN
        );
      }
    } catch (error) {
      if (this.throwOnError) {
        throw error;
      }
      // Otherwise, try to recover and report diagnostic
      if (error instanceof ParseError) {
        // Don't add the error again - it was already added in the error() method
        // Just create a minimal error AST node
        ast = {
          type: NodeType.Literal,
          value: null,
          valueType: 'null',
          position: error.position
        } as LiteralNode;
      } else {
        throw error;
      }
    }
    
    const result: ParseResult = {
      ast,
      diagnostics: this.diagnostics ? this.diagnostics.getDiagnostics() : [],
      hasErrors: this.diagnostics ? this.diagnostics.hasErrors() : false
    };
    
    // Add ranges if tracking is enabled
    if (this.trackRanges && this.sourceMapper) {
      result.ranges = this.collectNodeRanges(ast);
    }
    
    return result;
  }
  
  private parseWithRecovery(): ParseResult {
    let ast: ASTNode;
    const ranges = this.trackRanges ? new Map<ASTNode, TextRange>() : undefined;
    
    // Check for lexer errors first
    if ((this as any).lexerError) {
      const error = (this as any).lexerError;
      // Map lexer error positions to our range format
      const range: TextRange = {
        start: { 
          line: error.position.line - 1,  // Lexer uses 1-based lines, we use 0-based
          character: error.position.column - 1,  // Lexer uses 1-based columns, we use 0-based
          offset: error.position.offset 
        },
        end: { 
          line: error.position.line - 1, 
          character: error.position.column,  // One character after the error
          offset: error.position.offset + 1 
        }
      };
      
      // Map specific lexer errors to appropriate error codes
      let errorCode = ErrorCode.SYNTAX_ERROR;
      if (error.message.includes('Invalid escape sequence')) {
        errorCode = ErrorCode.INVALID_ESCAPE;
      } else if (error.message.includes('Unterminated string')) {
        errorCode = ErrorCode.UNTERMINATED_STRING;
      }
      
      this.diagnostics!.addError(range, error.message, errorCode);
      
      // Create error node
      ast = {
        type: NodeType.Error,
        position: { line: 1, column: 1, offset: 0 },
        expectedTokens: [],
        diagnostic: {
          severity: 1,
          range,
          message: error.message,
          code: errorCode,
          source: 'fhirpath-parser'
        }
      } as ErrorNode;
      
      const result: ParseResult = {
        ast,
        diagnostics: this.diagnostics!.getDiagnostics(),
        hasErrors: true,
        isPartial: true
      };
      if (this.trackRanges && ranges) {
        result.ranges = ranges;
      }
      return result;
    }
    
    try {
      ast = this.expressionWithRecovery();
      
      if (!this.isAtEnd()) {
        // In diagnostic mode, try to consume remaining tokens
        const unexpectedToken = this.peek();
        this.errorReporter!.reportExpectedToken(
          [TokenType.EOF],
          unexpectedToken,
          ParseContext.Expression
        );
        
        // Try to recover by consuming remaining tokens
        while (!this.isAtEnd()) {
          this.advance();
        }
      }
    } catch (error) {
      // In diagnostic mode, create error node and mark as partial
      if (error instanceof ParseError) {
        ast = this.createErrorNode(error.token, error.message);
        this.isPartial = true;
      } else {
        throw error;
      }
    }
    
    const result: ParseResult = {
      ast,
      diagnostics: this.diagnostics!.getDiagnostics(),
      hasErrors: this.diagnostics!.hasErrors()
    };
    
    if (this.errorRecovery) {
      result.isPartial = this.isPartial;
    }
    
    if (this.trackRanges && this.sourceMapper) {
      result.ranges = this.collectNodeRanges(ast);
    }
    
    return result;
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
      this.consume(TokenType.RPAREN, "Expected ')' after expression", ErrorCode.UNCLOSED_PARENTHESIS);
      
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
      const lbrace = this.previous();
      const startPos = lbrace.position;
      const elements: ASTNode[] = [];
      
      if (!this.check(TokenType.RBRACE)) {
        const previousContext = this.currentContext;
        this.currentContext = ParseContext.CollectionLiteral;
        
        do {
          // Check for trailing comma before trying to parse expression
          if (this.check(TokenType.RBRACE)) {
            // We have a trailing comma
            if (this.diagnostics) {
              const commaToken = this.previous(); // The comma we just consumed
              const diagnostic = FHIRPathDiagnostics.trailingComma(commaToken, this.sourceMapper!);
              this.diagnostics!.addError(diagnostic.range, diagnostic.message, diagnostic.code);
            }
            break;
          }
          
          try {
            elements.push(this.errorRecovery ? this.expressionWithRecovery() : this.expression());
          } catch (error) {
            if (error instanceof ParseError && this.errorRecovery) {
              elements.push(this.createErrorNode(error.token, error.message));
              // Skip to next comma or closing brace
              while (!this.isAtEnd() && !this.check(TokenType.COMMA) && !this.check(TokenType.RBRACE)) {
                this.advance();
              }
              if (this.check(TokenType.COMMA)) {
                continue;
              } else {
                break;
              }
            } else {
              throw error;
            }
          }
        } while (this.match(TokenType.COMMA));
        
        this.currentContext = previousContext;
      }
      
      if (!this.match(TokenType.RBRACE)) {
        if (this.diagnostics) {
          this.errorReporter?.reportUnclosedDelimiter(lbrace, '}') ||
            this.diagnostics!.addError(
              this.sourceMapper!.tokenToRange(lbrace),
              "Expected '}' to close collection literal",
              ErrorCode.UNCLOSED_BRACE
            );
          this.isPartial = true;
        } else {
          throw this.error("Expected '}' after collection elements", ErrorCode.UNCLOSED_BRACE);
        }
      }
      
      // Restore context if we set it earlier
      if (!this.check(TokenType.RBRACE)) {
        this.currentContext = ParseContext.Expression;
      }
      
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
    
    const token = this.peek();
    let message = "Expected expression";
    
    // Add context-specific information
    if (this.currentContext === ParseContext.CollectionLiteral) {
      message = "Expected expression in collection";
    } else if (this.currentContext === ParseContext.FunctionCall) {
      message = "Expected expression in function call";
    } else if (this.currentContext === ParseContext.IndexExpression) {
      message = "Expected expression in index";
    }
    
    if (token.type !== TokenType.EOF) {
      message += `, found '${token.value}'`;
    }
    throw this.error(message, ErrorCode.EXPECTED_EXPRESSION);
  }
  
  // Parse binary operators with precedence
  private parseBinary(left: ASTNode, op: Token, precedence: number): ASTNode {
    const operation = op.operation || Registry.getByToken(op.type);
    if (!operation && op.type !== TokenType.DOT && op.type !== TokenType.IS && op.type !== TokenType.AS) {
      throw this.error(`Unknown operator: ${op.value}`, ErrorCode.INVALID_OPERATOR);
    }
    // Special handling for type operators
    if (op.type === TokenType.IS || op.type === TokenType.AS) {
      this.advance(); // consume operator
      
      // Type name can be either a simple identifier or in parentheses (for is() function syntax)
      let typeName: string;
      if (this.check(TokenType.LPAREN)) {
        // Handle is(TypeName) syntax
        this.advance(); // consume (
        typeName = this.consume(TokenType.IDENTIFIER, "Expected type name", ErrorCode.EXPECTED_IDENTIFIER).value;
        this.consume(TokenType.RPAREN, "Expected ')' after type name", ErrorCode.UNCLOSED_PARENTHESIS);
      } else {
        // Regular is TypeName syntax
        const typeToken = this.peek();
        if (!this.match(TokenType.IDENTIFIER)) {
          if (this.errorRecovery) {
            const context = op.type === TokenType.AS ? ParseContext.TypeCast : ParseContext.MembershipTest;
            this.errorReporter!.reportExpectedToken(
              [TokenType.IDENTIFIER],
              typeToken,
              context
            );
            // Create incomplete node
            return this.createIncompleteNode(left, ['type name']);
          } else if (!this.errorRecovery && this.diagnostics) {
            // In standard mode, add error once and throw
            const range = this.sourceMapper!.tokenToRange(typeToken);
            this.diagnostics!.addError(
              range,
              `Expected type name after '${op.value}'`,
              ErrorCode.EXPECTED_IDENTIFIER
            );
            // Throw without adding duplicate diagnostic
            const pos = typeToken.position;
            const fullMessage = `Expected type name at line ${pos.line}, column ${pos.column}`;
            throw new ParseError(fullMessage, pos, typeToken);
          }
          throw this.error("Expected type name", ErrorCode.EXPECTED_IDENTIFIER);
        }
        typeName = this.previous().value;
      }
      
      return {
        type: op.type === TokenType.IS ? NodeType.MembershipTest : NodeType.TypeCast,
        expression: left,
        targetType: typeName,
        position: op.position
      } as MembershipTestNode | TypeCastNode;
    }
    
    this.advance(); // consume operator
    
    // Check for common mistake: == instead of =
    if (op.type === TokenType.EQ && this.check(TokenType.EQ)) {
      const secondEq = this.peek();
      if (this.diagnostics) {
        const range = this.sourceMapper!.mergeRanges(
          this.sourceMapper!.tokenToRange(op),
          this.sourceMapper!.tokenToRange(secondEq)
        );
        this.diagnostics!.addError(
          range,
          "'==' is not valid in FHIRPath, use '=' for equality",
          ErrorCode.INVALID_OPERATOR
        );
        // Skip the extra = to avoid cascading errors
        this.advance();
      } else if (this.throwOnError) {
        throw this.error("'==' is not valid in FHIRPath, use '=' for equality", ErrorCode.INVALID_OPERATOR);
      }
    }
    
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
      // Check for double dot error
      if (this.check(TokenType.DOT)) {
        const secondDot = this.peek();
        if (this.diagnostics) {
          const diagnostic = FHIRPathDiagnostics.doubleDotOperator(op, secondDot, this.sourceMapper!);
          this.diagnostics!.addError(diagnostic.range, diagnostic.message, diagnostic.code);
          
          // Skip the extra dot to avoid cascading errors
          this.advance();
          
          if (this.errorRecovery) {
            this.isPartial = true;
          }
        }
        
        if (this.throwOnError) {
          throw this.error("Invalid '..' operator - use single '.' for navigation", ErrorCode.INVALID_OPERATOR);
        }
      }
      
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
        // Check for invalid syntax like .[ or .123
        if (this.check(TokenType.LBRACKET) || this.check(TokenType.NUMBER)) {
          if (this.diagnostics) {
            this.errorReporter?.reportExpectedToken(
              [TokenType.IDENTIFIER],
              this.peek(),
              ParseContext.Expression
            ) || this.diagnostics!.addError(
              this.sourceMapper!.tokenToRange(this.peek()),
              "Expected property name after '.'",
              ErrorCode.EXPECTED_IDENTIFIER
            );
            
            if (this.errorRecovery) {
              // Create error node and continue to parse the index
              right = this.createErrorNode(this.peek(), "Expected identifier");
              return {
                type: NodeType.Binary,
                operator: TokenType.DOT,
                operation: operation,
                left: left,
                right: right,
                position: op.position
              } as BinaryNode;
            }
          }
          throw this.error("Expected property name after '.'", ErrorCode.EXPECTED_IDENTIFIER);;
        }
        
        try {
          right = this.primary();
        } catch (error) {
          if (error instanceof ParseError && this.errorRecovery) {
            // Report missing identifier after dot
            this.errorReporter!.reportMissingIdentifier(this.peek(), "after '.'");
            return this.createIncompleteNode(left, ['property']);
          }
          throw error;
        }
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
    
    let right: ASTNode;
    try {
      right = this.expression(precedence + associativity);
    } catch (error) {
      if (error instanceof ParseError && (this.diagnostics)) {
        // Report missing operand
        const diagnostic = FHIRPathDiagnostics.missingOperand(op, 'right', this.sourceMapper!);
        this.diagnostics!.addError(diagnostic.range, diagnostic.message, diagnostic.code);
        
        if (this.errorRecovery) {
          return this.createIncompleteNode(left, ['right operand']);
        }
      }
      throw error;
    }
    
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
    const lparen = this.peek();
    
    if (!this.match(TokenType.LPAREN)) {
      if (this.errorRecovery) {
        this.errorReporter!.reportExpectedToken(
          [TokenType.LPAREN],
          this.peek(),
          ParseContext.FunctionCall
        );
        return this.createIncompleteNode(func, ['function arguments']);
      }
      throw this.error("Expected '(' after function", ErrorCode.MISSING_ARGUMENTS);
    }
    
    const args: ASTNode[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      const previousContext = this.currentContext;
      this.currentContext = ParseContext.FunctionCall;
      // Check for immediate unexpected tokens in function context
      if (this.check(TokenType.RBRACKET) || this.check(TokenType.RBRACE)) {
        if (this.errorRecovery) {
          this.errorReporter!.reportExpectedToken(
            [TokenType.IDENTIFIER, TokenType.NUMBER, TokenType.STRING, TokenType.LPAREN, TokenType.LBRACE],
            this.peek(),
            ParseContext.FunctionCall
          );
          // Skip the unexpected token
          this.advance();
        }
      }
      
      do {
        try {
          args.push(this.errorRecovery ? this.expressionWithRecovery() : this.expression());
        } catch (error) {
          if (error instanceof ParseError && this.errorRecovery) {
            // Report contextual error for function arguments
            this.errorReporter!.reportExpectedToken(
              [TokenType.IDENTIFIER, TokenType.NUMBER, TokenType.STRING, TokenType.LPAREN, TokenType.LBRACE],
              error.token,
              ParseContext.FunctionCall
            );
            args.push(this.createErrorNode(error.token, error.message));
            
            // Skip to next comma or closing paren
            while (!this.isAtEnd() && !this.check(TokenType.COMMA) && !this.check(TokenType.RPAREN)) {
              this.advance();
            }
            
            if (this.check(TokenType.COMMA)) {
              continue;
            } else {
              break;
            }
          } else {
            throw error;
          }
        }
      } while (this.match(TokenType.COMMA));
      
      this.currentContext = previousContext;
    }
    
    // Check for empty function that requires arguments
    const funcName = func.type === NodeType.Identifier ? (func as IdentifierNode).name : '';
    if (args.length === 0 && funcName === 'where') {
      if (this.errorRecovery) {
        this.errorReporter!.reportMissingArguments(funcName, lparen);
      }
    }
    
    if (!this.match(TokenType.RPAREN)) {
      if (this.errorRecovery) {
        // Report unclosed parenthesis
        this.errorReporter!.reportUnclosedDelimiter(lparen, ')');
        this.isPartial = true;
      } else {
        throw this.error("Expected ')' after arguments", ErrorCode.UNCLOSED_PARENTHESIS);
      }
    }
    
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
    const lbracket = this.peek();
    
    if (!this.match(TokenType.LBRACKET)) {
      throw this.error("Expected '['", ErrorCode.UNEXPECTED_TOKEN);
    }
    
    // Check for empty brackets
    if (this.check(TokenType.RBRACKET)) {
      if (this.diagnostics) {
        const diagnostic = FHIRPathDiagnostics.emptyBrackets(lbracket, this.sourceMapper!);
        this.diagnostics!.addError(diagnostic.range, diagnostic.message, diagnostic.code);
      }
      if (this.throwOnError) {
        throw this.error("Expected expression in index", ErrorCode.EXPECTED_EXPRESSION);
      }
    }
    
    let index: ASTNode;
    try {
      index = this.errorRecovery ? this.expressionWithRecovery() : this.expression();
    } catch (error) {
      if (error instanceof ParseError && this.errorRecovery) {
        index = this.createErrorNode(error.token, error.message);
      } else {
        throw error;
      }
    }
    
    if (!this.match(TokenType.RBRACKET)) {
      if (this.diagnostics) {
        this.errorReporter?.reportUnclosedDelimiter(lbracket, ']') ||
          this.diagnostics.addError(
            this.sourceMapper!.tokenToRange(lbracket),
            "Expected ']' after index expression",
            ErrorCode.UNCLOSED_BRACKET
          );
        this.isPartial = true;
      } else {
        throw this.error("Expected ']'", ErrorCode.UNCLOSED_BRACKET);
      }
    }
    
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
    this.consume(TokenType.LPAREN, "Expected '(' after ofType", ErrorCode.MISSING_ARGUMENTS);
    const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name", ErrorCode.EXPECTED_IDENTIFIER).value;
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
  
  private consume(type: TokenType, message: string, code: ErrorCode = ErrorCode.UNEXPECTED_TOKEN): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message, code);
  }
  
  private error(message: string, code: ErrorCode = ErrorCode.PARSE_ERROR): ParseError {
    const token = this.peek();
    const pos = token.position;
    
    // If not throwOnError, add to diagnostics
    if (!this.throwOnError && this.diagnostics && this.sourceMapper) {
      const range = this.sourceMapper.tokenToRange(token);
      this.diagnostics.addError(range, message, code);
    }
    
    const fullMessage = `${message} at line ${pos.line}, column ${pos.column}`;
    return new ParseError(fullMessage, pos, token);
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
  
  // Error recovery methods
  private expressionWithRecovery(minPrecedence: number = 14): ASTNode {
    try {
      return this.expression(minPrecedence);
    } catch (error) {
      if (error instanceof ParseError && this.errorRecovery) {
        const errorNode = this.createErrorNode(error.token, error.message);
        this.recoverToSyncPoint();
        
        // Try to continue parsing after recovery
        if (!this.isAtEnd() && !this.isAtSyncPoint()) {
          // Only try to recover if we're not already at a sync point
          try {
            const recovered = this.expression(minPrecedence); // Use regular expression, not recursive recovery
            // Create a binary node with error on left
            return {
              type: NodeType.Binary,
              operator: TokenType.DOT,
              left: errorNode,
              right: recovered,
              position: errorNode.position
            } as BinaryNode;
          } catch {
            // If recovery fails, just return the error node
            return errorNode;
          }
        }
        
        return errorNode;
      }
      throw error;
    }
  }
  
  private primaryWithRecovery(): ASTNode {
    try {
      return this.primary();
    } catch (error) {
      if (error instanceof ParseError && this.errorRecovery) {
        const errorNode = this.createErrorNode(error.token, error.message);
        this.recoverToSyncPoint();
        return errorNode;
      }
      throw error;
    }
  }
  
  private createErrorNode(token: Token, message: string): ErrorNode {
    const range = this.sourceMapper!.tokenToRange(token);
    const diagnostic = this.diagnostics!.getDiagnostics().slice(-1)[0];
    
    this.isPartial = true;
    
    return {
      type: NodeType.Error,
      position: token.position,
      range,
      expectedTokens: [], // Could be enhanced to track expected tokens
      actualToken: token,
      diagnostic: diagnostic || {
        range,
        severity: 1,
        code: ErrorCode.PARSE_ERROR,
        message,
        source: 'fhirpath-parser'
      }
    };
  }
  
  private createIncompleteNode(partialNode: ASTNode | undefined, missingParts: string[]): IncompleteNode {
    const position = partialNode?.position || this.peek().position;
    const range = partialNode?.range || this.sourceMapper!.tokenToRange(this.peek());
    
    this.isPartial = true;
    
    return {
      type: NodeType.Incomplete,
      position,
      range,
      partialNode,
      missingParts
    };
  }
  
  private recoverToSyncPoint(): void {
    while (!this.isAtEnd() && !this.isAtSyncPoint()) {
      this.advance();
    }
  }
  
  private isAtSyncPoint(): boolean {
    const token = this.peek();
    return token.type === TokenType.COMMA ||
           token.type === TokenType.RPAREN ||
           token.type === TokenType.RBRACKET ||
           token.type === TokenType.RBRACE ||
           token.type === TokenType.PIPE ||
           token.type === TokenType.AND ||
           token.type === TokenType.OR ||
           this.isStatementBoundary(token);
  }
  
  private isStatementBoundary(token: Token): boolean {
    // For future multi-statement support
    return token.type === TokenType.EOF;
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

  // Add helper method to collect node ranges
  private collectNodeRanges(ast: ASTNode): Map<ASTNode, TextRange> {
    const ranges = new Map<ASTNode, TextRange>();
    
    const visit = (node: ASTNode) => {
      if (this.sourceMapper && node.position) {
        // Create range from node position
        const range: TextRange = {
          start: {
            line: node.position.line - 1,
            character: node.position.column - 1,
            offset: node.position.offset
          },
          end: {
            line: node.position.line - 1,
            character: node.position.column - 1,
            offset: node.position.offset
          }
        };
        ranges.set(node, range);
      }
      
      // Visit child nodes based on node type
      switch (node.type) {
        case NodeType.Binary:
          visit((node as BinaryNode).left);
          visit((node as BinaryNode).right);
          break;
        case NodeType.Unary:
          visit((node as UnaryNode).operand);
          break;
        case NodeType.Function:
          (node as FunctionNode).arguments.forEach(visit);
          break;
        case NodeType.Index:
          visit((node as IndexNode).expression);
          visit((node as IndexNode).index);
          break;
        case NodeType.Union:
          (node as UnionNode).operands.forEach(visit);
          break;
        case NodeType.Collection:
          (node as CollectionNode).elements.forEach(visit);
          break;
        case NodeType.MembershipTest:
          visit((node as MembershipTestNode).expression);
          break;
        case NodeType.TypeCast:
          visit((node as TypeCastNode).expression);
          break;
      }
    };
    
    visit(ast);
    return ranges;
  }
}

// Export convenience function - for backward compatibility
export function parse(input: string | Token[]): ASTNode {
  const parser = new FHIRPathParser(input, { throwOnError: true });
  const result = parser.parse();
  return result.ast;
}