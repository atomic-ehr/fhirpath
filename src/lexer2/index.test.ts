import { describe, it, expect } from 'bun:test';
import { Lexer, TokenType } from './index';

describe('Lexer', () => {
  function getTokenTypes(expression: string): TokenType[] {
    const lexer = new Lexer(expression);
    const tokens = lexer.tokenize();
    return tokens.map(t => t.type);
  }
  
  describe('literals', () => {
    it('tokenizes null literal', () => {
      expect(getTokenTypes('{}')).toEqual([
        TokenType.LBRACE,
        TokenType.RBRACE,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes boolean literals', () => {
      expect(getTokenTypes('true false')).toEqual([
        TokenType.TRUE,
        TokenType.FALSE,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes string literals', () => {
      // Single-quoted strings
      expect(getTokenTypes("'hello world'")).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      expect(getTokenTypes("'hello\\nworld\\t\\r\\\\'")).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      expect(getTokenTypes("'\\u0048\\u0065\\u006C\\u006C\\u006F'")).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      // Double-quoted strings
      expect(getTokenTypes('"hello world"')).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      expect(getTokenTypes('"hello\\nworld\\t\\r\\\\\\""')).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      expect(getTokenTypes('"\\u0048\\u0065\\u006C\\u006C\\u006F"')).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      // Mixed quotes
      expect(getTokenTypes(`"single ' quote inside"`)).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      expect(getTokenTypes(`'double " quote inside'`)).toEqual([
        TokenType.STRING,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes numbers', () => {
      expect(getTokenTypes('42 3.14 0.5 123.456')).toEqual([
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.NUMBER,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes datetime literals', () => {
      expect(getTokenTypes('@2023 @2023-12 @2023-12-25 @2023-12-25T10:30:45.123Z')).toEqual([
        TokenType.DATETIME,
        TokenType.DATETIME,
        TokenType.DATETIME,
        TokenType.DATETIME,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes time literals', () => {
      expect(getTokenTypes('@T10:30 @T10:30:45 @T10:30:45.123')).toEqual([
        TokenType.TIME,
        TokenType.TIME,
        TokenType.TIME,
        TokenType.EOF
      ]);
    });
  });
  
  describe('identifiers', () => {
    it('tokenizes simple identifiers', () => {
      expect(getTokenTypes('foo bar_baz _test Test123')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes delimited identifiers with Unicode', () => {
      // Unicode must be in delimited identifiers per spec
      expect(getTokenTypes('`café` `münchen` `Σ` `λ`')).toEqual([
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.EOF
      ]);
      
      // Mixed ASCII and Unicode in delimited identifiers
      expect(getTokenTypes('`test_café` `value_π` `x²`')).toEqual([
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.EOF
      ]);
      
      // Various Unicode categories in delimited identifiers
      expect(getTokenTypes('`日本語` `中文` `한글` `العربية`')).toEqual([
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes delimited identifiers', () => {
      expect(getTokenTypes('`foo bar` `with\\`backtick`')).toEqual([
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.DELIMITED_IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes special identifiers', () => {
      expect(getTokenTypes('$this $index $total')).toEqual([
        TokenType.THIS,
        TokenType.INDEX,
        TokenType.TOTAL,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes environment variables', () => {
      // Identifier form
      expect(getTokenTypes('%context %sct %vs')).toEqual([
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.EOF
      ]);
      
      // String form
      expect(getTokenTypes(`%'simple string' %'with\\nescapes' %'unicode\\u0048'`)).toEqual([
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.EOF
      ]);
      
      // Delimited form
      expect(getTokenTypes('%`any string name` %`with\\`backtick` %`complex-name_123`')).toEqual([
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.EOF
      ]);
      
      // Mixed with percent operator
      expect(getTokenTypes('value % 10 %context')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.PERCENT,
        TokenType.NUMBER,
        TokenType.ENV_VAR,
        TokenType.EOF
      ]);
      
      // Unicode in delimited form
      expect(getTokenTypes('%`café` %`münchen` %`日本語`')).toEqual([
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.ENV_VAR,
        TokenType.EOF
      ]);
    });
  });
  
  describe('keywords', () => {
    it('tokenizes keywords', () => {
      expect(getTokenTypes('as contains in is div mod and or xor implies')).toEqual([
        TokenType.AS,
        TokenType.CONTAINS,
        TokenType.IN,
        TokenType.IS,
        TokenType.DIV,
        TokenType.MOD,
        TokenType.AND,
        TokenType.OR,
        TokenType.XOR,
        TokenType.IMPLIES,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes time units', () => {
      expect(getTokenTypes('year month week day hour minute second millisecond')).toEqual([
        TokenType.YEAR,
        TokenType.MONTH,
        TokenType.WEEK,
        TokenType.DAY,
        TokenType.HOUR,
        TokenType.MINUTE,
        TokenType.SECOND,
        TokenType.MILLISECOND,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes plural time units', () => {
      expect(getTokenTypes('years months weeks days hours minutes seconds milliseconds')).toEqual([
        TokenType.YEARS,
        TokenType.MONTHS,
        TokenType.WEEKS,
        TokenType.DAYS,
        TokenType.HOURS,
        TokenType.MINUTES,
        TokenType.SECONDS,
        TokenType.MILLISECONDS,
        TokenType.EOF
      ]);
    });
  });
  
  describe('operators', () => {
    it('tokenizes single-character operators', () => {
      expect(getTokenTypes('. ( ) [ ] { } + - * / & | < > = ~ , % @')).toEqual([
        TokenType.DOT,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.LBRACKET,
        TokenType.RBRACKET,
        TokenType.LBRACE,
        TokenType.RBRACE,
        TokenType.PLUS,
        TokenType.MINUS,
        TokenType.MULTIPLY,
        TokenType.DIVIDE,
        TokenType.AMPERSAND,
        TokenType.PIPE,
        TokenType.LT,
        TokenType.GT,
        TokenType.EQ,
        TokenType.SIMILAR,
        TokenType.COMMA,
        TokenType.PERCENT,
        TokenType.AT,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes two-character operators', () => {
      expect(getTokenTypes('<= >= != !~')).toEqual([
        TokenType.LTE,
        TokenType.GTE,
        TokenType.NEQ,
        TokenType.NOT_SIMILAR,
        TokenType.EOF
      ]);
    });
  });
  
  describe('whitespace and comments', () => {
    it('skips whitespace by default', () => {
      expect(getTokenTypes('a   b\t\tc\r\nd')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('includes whitespace when configured', () => {
      const lexer = new Lexer('a b', { skipWhitespace: false });
      const types = lexer.tokenize().map(t => t.type);
      expect(types).toEqual([
        TokenType.IDENTIFIER,
        TokenType.WHITESPACE,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('skips comments by default', () => {
      expect(getTokenTypes('a /* comment */ b // line comment\nc')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('includes comments when configured', () => {
      const lexer = new Lexer('a /* comment */ b', { skipComments: false, skipWhitespace: false });
      const types = lexer.tokenize().map(t => t.type);
      expect(types).toEqual([
        TokenType.IDENTIFIER,
        TokenType.WHITESPACE,
        TokenType.COMMENT,
        TokenType.WHITESPACE,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
  });
  
  describe('complex expressions', () => {
    it('tokenizes property access', () => {
      expect(getTokenTypes('Patient.name.given')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes function calls', () => {
      expect(getTokenTypes('where(active = true)')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.EQ,
        TokenType.TRUE,
        TokenType.RPAREN,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes arithmetic expressions', () => {
      expect(getTokenTypes('5 + 3 * 2 - 1')).toEqual([
        TokenType.NUMBER,
        TokenType.PLUS,
        TokenType.NUMBER,
        TokenType.MULTIPLY,
        TokenType.NUMBER,
        TokenType.MINUS,
        TokenType.NUMBER,
        TokenType.EOF
      ]);
    });
    
    it('tokenizes quantity with units', () => {
      expect(getTokenTypes("5 years 3.5 'mg'")).toEqual([
        TokenType.NUMBER,
        TokenType.YEARS,
        TokenType.NUMBER,
        TokenType.STRING,
        TokenType.EOF
      ]);
    });

    it("human readable", () => {    
      const lexer = new Lexer("Patient.name.where(given = 'John')");
      const tokens = lexer.tokenize();
      console.log(tokens);
    });
    
    it('tokenizes expressions with double-quoted strings', () => {
      expect(getTokenTypes(`"Hello" + " " + "World"`)).toEqual([
        TokenType.STRING,
        TokenType.PLUS,
        TokenType.STRING,
        TokenType.PLUS,
        TokenType.STRING,
        TokenType.EOF
      ]);
      
      expect(getTokenTypes(`name.where(use = "official")`)).toEqual([
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.IDENTIFIER,
        TokenType.EQ,
        TokenType.STRING,
        TokenType.RPAREN,
        TokenType.EOF
      ]);
    });
  });
  
  describe('error handling', () => {
    it('throws on unexpected character', () => {
      expect(() => new Lexer('a $ b').tokenize()).toThrow('Unexpected character');
    });
    
    it('throws on unterminated string', () => {
      expect(() => new Lexer("'unterminated").tokenize()).toThrow('Unterminated string');
      expect(() => new Lexer('"unterminated').tokenize()).toThrow('Unterminated string');
    });
    
    it('throws on invalid escape sequence', () => {
      expect(() => new Lexer("'\\q'").tokenize()).toThrow('Invalid escape sequence');
      expect(() => new Lexer('"\\q"').tokenize()).toThrow('Invalid escape sequence');
    });
    
    it('throws on invalid unicode escape', () => {
      expect(() => new Lexer("'\\uXYZ'").tokenize()).toThrow('Invalid unicode escape');
      expect(() => new Lexer('"\\uXYZ"').tokenize()).toThrow('Invalid unicode escape');
    });
    
    it('throws on unterminated environment variables', () => {
      expect(() => new Lexer("%'unterminated").tokenize()).toThrow('Unterminated environment variable string');
      expect(() => new Lexer("%`unterminated").tokenize()).toThrow('Unterminated environment variable delimiter');
    });
    
    it('throws on invalid escape in environment variables', () => {
      expect(() => new Lexer("%'\\q'").tokenize()).toThrow('Invalid escape sequence');
      expect(() => new Lexer("%'\\uXYZ'").tokenize()).toThrow('Invalid unicode escape');
    });
    
    it('throws on Unicode in regular identifiers', () => {
      // Unicode is not allowed in regular identifiers per spec
      expect(() => new Lexer('café').tokenize()).toThrow('Unexpected character');
      expect(() => new Lexer('münchen').tokenize()).toThrow('Unexpected character');
      expect(() => new Lexer('日本語').tokenize()).toThrow('Unexpected character');
    });
  });
});