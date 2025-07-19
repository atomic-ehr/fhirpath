import { describe, it, expect } from 'bun:test';
import { lex } from '../src/lexer/lexer';
import { TokenType } from '../src/lexer/token';

describe('FHIRPath Lexer - Basic Tokens', () => {
  it('should tokenize single character tokens', () => {
    const tokens = lex('()[]{}.,+-*/&|~=');
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.LPAREN, TokenType.RPAREN,
      TokenType.LBRACKET, TokenType.RBRACKET,
      TokenType.NULL, // {}
      TokenType.DOT, TokenType.COMMA,
      TokenType.PLUS, TokenType.MINUS,
      TokenType.STAR, TokenType.SLASH,
      TokenType.CONCAT, TokenType.PIPE,
      TokenType.EQUIV, TokenType.EQ,
      TokenType.EOF
    ]);
  });
  
  it('should tokenize multi-character operators', () => {
    const tokens = lex('<= >= != !~');
    expect(tokens.map(t => t.value)).toEqual(['<=', '>=', '!=', '!~', '']);
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.LTE, TokenType.GTE, 
      TokenType.NEQ, TokenType.NEQUIV,
      TokenType.EOF
    ]);
  });
  
  it('should tokenize keywords', () => {
    const tokens = lex('true false and or not in contains as is div mod');
    const types = tokens.slice(0, -1).map(t => t.type); // Remove EOF
    expect(types).toEqual([
      TokenType.TRUE, TokenType.FALSE,
      TokenType.AND, TokenType.OR,
      TokenType.IDENTIFIER, // 'not' is not a keyword
      TokenType.IN, TokenType.CONTAINS,
      TokenType.AS, TokenType.IS,
      TokenType.DIV, TokenType.MOD
    ]);
  });
  
  it('should distinguish keywords from identifiers', () => {
    const tokens = lex('trueValue false_flag android');
    const values = tokens.slice(0, -1).map(t => t.value);
    const types = tokens.slice(0, -1).map(t => t.type);
    
    expect(values).toEqual(['trueValue', 'false_flag', 'android']);
    expect(types).toEqual([
      TokenType.IDENTIFIER,
      TokenType.IDENTIFIER, 
      TokenType.IDENTIFIER
    ]);
  });
  
  it('should handle comments', () => {
    const tokens = lex(`
      // This is a comment
      true /* multi
      line
      comment */ false
    `);
    
    const nonEofTokens = tokens.slice(0, -1);
    expect(nonEofTokens.map(t => t.type)).toEqual([
      TokenType.TRUE, TokenType.FALSE
    ]);
  });
  
  it('should handle whitespace', () => {
    const tokens = lex('  true   false\n\ttrue\r\nfalse  ');
    const nonEofTokens = tokens.slice(0, -1);
    expect(nonEofTokens.map(t => t.type)).toEqual([
      TokenType.TRUE, TokenType.FALSE,
      TokenType.TRUE, TokenType.FALSE
    ]);
  });
  
  it('should track token positions', () => {
    const tokens = lex('true\nfalse');
    
    expect(tokens[0]!!.position).toEqual({ line: 1, column: 1, offset: 0 });
    expect(tokens[1]!!.position).toEqual({ line: 2, column: 1, offset: 5 });
  });
});