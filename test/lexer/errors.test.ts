import { describe, it, expect } from 'bun:test';
import { lex } from '../../src/lexer/lexer';
import { LexerError, formatError } from '../../src/lexer/errors';
import { TokenType } from '../../src/lexer/token';

describe('FHIRPath Lexer - Error Cases', () => {
  it('should report unterminated string', () => {
    expect(() => lex("'unterminated")).toThrow(LexerError);
    expect(() => lex("'unterminated")).toThrow('Unterminated string');
  });
  
  it('should report invalid escape sequence', () => {
    expect(() => lex("'\\q'")).toThrow(LexerError);
    expect(() => lex("'\\q'")).toThrow('Invalid escape sequence: \\q');
  });
  
  it('should report invalid unicode escape', () => {
    expect(() => lex("'\\u123'")).toThrow('Invalid unicode escape sequence');
    expect(() => lex("'\\u12GH'")).toThrow('Invalid unicode escape sequence');
  });
  
  it('should report invalid date format', () => {
    expect(() => lex('@202')).toThrow('Invalid date/time format: expected 4-digit year');
    expect(() => lex('@2024-1')).toThrow('Invalid month');
    expect(() => lex('@2024-01-1')).toThrow('Invalid day');
  });
  
  it('should report invalid time format', () => {
    expect(() => lex('@T1')).toThrow(LexerError);
    expect(() => lex('@T14:3')).toThrow('Invalid time format: expected 2-digit minute');
    expect(() => lex('@T14:30:1')).toThrow('Invalid time format: expected 2-digit second');
  });
  
  it('should report invalid timezone', () => {
    expect(() => lex('@2024-01-15T10:30:00+1')).toThrow('Invalid timezone: expected 2-digit hour');
    expect(() => lex('@2024-01-15T10:30:00+01')).toThrow('Invalid timezone: expected ":" after hour');
    expect(() => lex('@2024-01-15T10:30:00+01:3')).toThrow('Invalid timezone: expected 2-digit minute');
  });
  
  it('should report unexpected characters', () => {
    expect(() => lex('#')).toThrow('Unexpected character: #');
    expect(() => lex('€')).toThrow('Unexpected character: €');
  });
  
  it('should report invalid special variable', () => {
    expect(() => lex('$invalid')).toThrow('Invalid special variable: $invalid');
    expect(() => lex('$')).toThrow(LexerError);
  });
  
  it('should report incomplete operators', () => {
    expect(() => lex('!')).toThrow('Expected "=" or "~" after "!"');
  });
  
  it('should report unterminated delimited identifier', () => {
    expect(() => lex('`unterminated')).toThrow('Unterminated delimited identifier');
  });
  
  it('should report unterminated null literal', () => {
    expect(() => lex('{')).toThrow('Expected "}" for null literal');
  });
  
  it('should include position in errors', () => {
    try {
      lex('valid + @invalid');
    } catch (e) {
      expect(e).toBeInstanceOf(LexerError);
      const error = e as LexerError;
      expect(error.position).toEqual({ line: 1, column: 10, offset: 9 });
      expect(error.char).toBe('i');
    }
  });
  
  it('should track position across lines', () => {
    try {
      lex('line1\nline2\n@bad');
    } catch (e) {
      expect(e).toBeInstanceOf(LexerError);
      const error = e as LexerError;
      expect(error.position).toEqual({ line: 3, column: 2, offset: 13 });
    }
  });
  
  it('should format errors nicely', () => {
    const input = 'valid + @invalid';
    try {
      lex(input);
    } catch (e) {
      const formatted = formatError(e as LexerError, input);
      expect(formatted).toContain('LexerError:');
      expect(formatted).toContain('at 1:10');
      expect(formatted).toContain('valid + @invalid');
      expect(formatted).toContain('         ^');
    }
  });
  
  it('should handle errors in multi-line input', () => {
    const input = `Patient.name
  .where(use = 'official)
  .given`;
    
    try {
      lex(input);
    } catch (e) {
      const formatted = formatError(e as LexerError, input);
      expect(formatted).toContain('Unterminated string');
      expect(formatted).toContain('at 3:9'); // Error happens when reaching end of file
    }
  });
  
  it('should handle empty input', () => {
    const tokens = lex('');
    expect(tokens.length).toBe(1);
    expect(tokens[0]!!.type).toBe(TokenType.EOF);
  });
  
  it('should handle whitespace-only input', () => {
    const tokens = lex('   \n\t  ');
    expect(tokens.length).toBe(1);
    expect(tokens[0]!!.type).toBe(TokenType.EOF);
  });
});