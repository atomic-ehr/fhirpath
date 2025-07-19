import { describe, it, expect } from 'bun:test';
import { lex } from '../../src/lexer/lexer';
import { TokenType } from '../../src/lexer/token';

describe('FHIRPath Lexer - Complex Expressions', () => {
  it('should tokenize member access expression', () => {
    const tokens = lex("Patient.name.where(use = 'official')");
    const types = tokens.map(t => t.type);
    const values = tokens.map(t => t.value);
    
    expect(types).toEqual([
      TokenType.IDENTIFIER,  // Patient
      TokenType.DOT,
      TokenType.IDENTIFIER,  // name
      TokenType.DOT,
      TokenType.IDENTIFIER,  // where
      TokenType.LPAREN,
      TokenType.IDENTIFIER,  // use
      TokenType.EQ,
      TokenType.STRING,      // 'official'
      TokenType.RPAREN,
      TokenType.EOF
    ]);
    
    expect(values[8]).toBe('official'); // Check string value
  });
  
  it('should tokenize union expression', () => {
    const tokens = lex('name.given | name.family');
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.IDENTIFIER,  // name
      TokenType.DOT,
      TokenType.IDENTIFIER,  // given
      TokenType.PIPE,
      TokenType.IDENTIFIER,  // name
      TokenType.DOT,
      TokenType.IDENTIFIER,  // family
      TokenType.EOF
    ]);
  });
  
  it('should tokenize boolean expression', () => {
    const tokens = lex("age >= 18 and status != 'inactive'");
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.IDENTIFIER,  // age
      TokenType.GTE,
      TokenType.NUMBER,      // 18
      TokenType.AND,
      TokenType.IDENTIFIER,  // status
      TokenType.NEQ,
      TokenType.STRING,      // 'inactive'
      TokenType.EOF
    ]);
  });
  
  it('should tokenize date comparison', () => {
    const tokens = lex('@2024-01-15T10:30:00Z > @2024-01-01');
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.DATETIME,
      TokenType.GT,
      TokenType.DATE,
      TokenType.EOF
    ]);
  });
  
  it('should tokenize complex nested expression', () => {
    const expr = "Patient.contact.where(relationship.coding.exists(code = 'emergency')).telecom.where(use = 'mobile').value.first()";
    const tokens = lex(expr);
    
    // Check some key tokens
    const whereIndices = tokens
      .map((t, i) => t.value === 'where' ? i : -1)
      .filter(i => i >= 0);
    expect(whereIndices.length).toBe(2);
    
    const stringTokens = tokens.filter(t => t.type === TokenType.STRING);
    expect(stringTokens.map(t => t.value)).toEqual(['emergency', 'mobile']);
  });
  
  it('should tokenize arithmetic expression', () => {
    const tokens = lex('(value * 1.5 + 10) div 2 mod 3');
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.LPAREN,
      TokenType.IDENTIFIER,  // value
      TokenType.STAR,
      TokenType.NUMBER,      // 1.5
      TokenType.PLUS,
      TokenType.NUMBER,      // 10
      TokenType.RPAREN,
      TokenType.DIV,
      TokenType.NUMBER,      // 2
      TokenType.MOD,
      TokenType.NUMBER,      // 3
      TokenType.EOF
    ]);
  });
  
  it('should tokenize type checking expression', () => {
    const tokens = lex('value is Integer and value as String');
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.IDENTIFIER,  // value
      TokenType.IS,
      TokenType.IDENTIFIER,  // Integer
      TokenType.AND,
      TokenType.IDENTIFIER,  // value
      TokenType.AS,
      TokenType.IDENTIFIER,  // String
      TokenType.EOF
    ]);
  });
  
  it('should tokenize indexer expression', () => {
    const tokens = lex('items[0].name');
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.IDENTIFIER,  // items
      TokenType.LBRACKET,
      TokenType.NUMBER,      // 0
      TokenType.RBRACKET,
      TokenType.DOT,
      TokenType.IDENTIFIER,  // name
      TokenType.EOF
    ]);
  });
  
  it('should tokenize special variables in context', () => {
    const tokens = lex('$this.name = $index and $total > 0');
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.THIS,
      TokenType.DOT,
      TokenType.IDENTIFIER,  // name
      TokenType.EQ,
      TokenType.INDEX,
      TokenType.AND,
      TokenType.TOTAL,
      TokenType.GT,
      TokenType.NUMBER,      // 0
      TokenType.EOF
    ]);
  });
  
  it('should tokenize membership operators', () => {
    const tokens = lex("'active' in status.code and allergies contains 'peanut'");
    const types = tokens.map(t => t.type);
    
    expect(types).toEqual([
      TokenType.STRING,      // 'active'
      TokenType.IN,
      TokenType.IDENTIFIER,  // status
      TokenType.DOT,
      TokenType.IDENTIFIER,  // code
      TokenType.AND,
      TokenType.IDENTIFIER,  // allergies
      TokenType.CONTAINS,
      TokenType.STRING,      // 'peanut'
      TokenType.EOF
    ]);
  });
  
  it('should handle complex whitespace and formatting', () => {
    const expr = `
      Patient
        .name
        .where(
          use = 'official' 
          and 
          given.count() > 0
        )
        .given
        .first()
    `;
    
    const tokens = lex(expr);
    const nonWhitespaceTokens = tokens.filter(t => t.value.trim() !== '');
    
    // Check the expression is tokenized correctly despite formatting
    expect(nonWhitespaceTokens[0]!!.value).toBe('Patient');
    expect(nonWhitespaceTokens[1]!!.type).toBe(TokenType.DOT);
    expect(nonWhitespaceTokens[2]!!.value).toBe('name');
  });
});