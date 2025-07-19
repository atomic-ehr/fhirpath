import { describe, it, expect } from 'bun:test';
import { lex } from '../../src/lexer/lexer';
import { TokenType } from '../../src/lexer/token';

describe('FHIRPath Lexer - Literals', () => {
  describe('Number literals', () => {
    it('should tokenize integers', () => {
      const tokens = lex('42 0 123 0123');
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['42', '0', '123', '0123']);
      tokens.slice(0, -1).forEach(t => {
        expect(t.type).toBe(TokenType.NUMBER);
      });
    });
    
    it('should tokenize decimals', () => {
      const tokens = lex('3.14 0.5 123.456');
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['3.14', '0.5', '123.456']);
    });
    
    it('should handle leading zeros', () => {
      const tokens = lex('0123 0012.34');
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['0123', '0012.34']);
    });
  });
  
  describe('String literals', () => {
    it('should tokenize simple strings', () => {
      const tokens = lex("'hello' 'world' ''");
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['hello', 'world', '']);
    });
    
    it('should handle escape sequences', () => {
      const tokens = lex("'hello\\nworld' 'tab\\there' 'quote\\'s'");
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['hello\nworld', 'tab\there', "quote's"]);
    });
    
    it('should handle unicode escapes', () => {
      const tokens = lex("'\\u0041\\u0042\\u0043' '\\u03B1\\u03B2'");
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['ABC', 'αβ']);
    });
    
    it('should handle all escape types', () => {
      const tokens = lex("'\\`\\'\\\\\\/\\f\\n\\r\\t'");
      expect(tokens[0]!.value).toBe("`'\\/\f\n\r\t");
    });
  });
  
  describe('Boolean literals', () => {
    it('should tokenize boolean values', () => {
      const tokens = lex('true false');
      expect(tokens[0]!.type).toBe(TokenType.TRUE);
      expect(tokens[1]!.type).toBe(TokenType.FALSE);
    });
  });
  
  describe('Null literal', () => {
    it('should tokenize null literal', () => {
      const tokens = lex('{}');
      expect(tokens[0]!.type).toBe(TokenType.NULL);
      expect(tokens[0]!.value).toBe('{}');
    });
  });
  
  describe('Date/Time literals', () => {
    it('should tokenize partial dates', () => {
      const dates = [
        '@2024',
        '@2024-01',
        '@2024-01-15'
      ];
      
      dates.forEach(date => {
        const tokens = lex(date);
        expect(tokens[0]!.type).toBe(TokenType.DATE);
        expect(tokens[0]!.value).toBe(date);
      });
    });
    
    it('should tokenize full datetime', () => {
      const datetimes = [
        '@2024-01-15T10:30:00',
        '@2024-01-15T10:30:00.123',
        '@2024-01-15T10:30:00Z',
        '@2024-01-15T10:30:00+05:30',
        '@2024-01-15T10:30:00-08:00'
      ];
      
      datetimes.forEach(dt => {
        const tokens = lex(dt);
        expect(tokens[0]!.type).toBe(TokenType.DATETIME);
        expect(tokens[0]!.value).toBe(dt);
      });
    });
    
    it('should tokenize time literals', () => {
      const times = [
        '@T14:30',
        '@T14:30:00',
        '@T14:30:00.123'
      ];
      
      times.forEach(time => {
        const tokens = lex(time);
        expect(tokens[0]!.type).toBe(TokenType.TIME);
        expect(tokens[0]!.value).toBe(time);
      });
    });
    
    it('should handle edge case datetime formats', () => {
      // Year with time but no month/day
      const tokens1 = lex('@2024T10:30:00');
      expect(tokens1[0]!.type).toBe(TokenType.DATETIME);
      
      // Month without day but with time
      const tokens2 = lex('@2024-01T10:30:00');
      expect(tokens2[0]!.type).toBe(TokenType.DATETIME);
    });
  });
  
  describe('Special variables', () => {
    it('should tokenize special variables', () => {
      const tokens = lex('$this $index $total');
      expect(tokens[0]!.type).toBe(TokenType.THIS);
      expect(tokens[1]!.type).toBe(TokenType.INDEX);
      expect(tokens[2]!.type).toBe(TokenType.TOTAL);
    });
  });
  
  describe('Environment variables', () => {
    it('should tokenize simple environment variables', () => {
      const tokens = lex('%context %resource');
      expect(tokens[0]!.type).toBe(TokenType.ENV_VAR);
      expect(tokens[0]!.value).toBe('context');
      expect(tokens[1]!.type).toBe(TokenType.ENV_VAR);
      expect(tokens[1]!.value).toBe('resource');
    });
    
    it('should tokenize delimited environment variables', () => {
      const tokens = lex('%`vs-name` %`complex-name`');
      expect(tokens[0]!.type).toBe(TokenType.ENV_VAR);
      expect(tokens[0]!.value).toBe('vs-name');
      expect(tokens[1]!.type).toBe(TokenType.ENV_VAR);
      expect(tokens[1]!.value).toBe('complex-name');
    });
    
    it('should tokenize string environment variables', () => {
      const tokens = lex("%'string value' %'another'");
      expect(tokens[0]!.type).toBe(TokenType.ENV_VAR);
      expect(tokens[0]!.value).toBe('string value');
      expect(tokens[1]!.type).toBe(TokenType.ENV_VAR);
      expect(tokens[1]!.value).toBe('another');
    });
  });
  
  describe('Delimited identifiers', () => {
    it('should tokenize delimited identifiers', () => {
      const tokens = lex('`identifier` `complex name` `with-dashes`');
      const values = tokens.slice(0, -1).map(t => t.value);
      expect(values).toEqual(['identifier', 'complex name', 'with-dashes']);
      tokens.slice(0, -1).forEach(t => {
        expect(t.type).toBe(TokenType.DELIMITED_IDENTIFIER);
      });
    });
    
    it('should handle escapes in delimited identifiers', () => {
      const tokens = lex('`with\\nnewline` `with\\`backtick`');
      expect(tokens[0]!.value).toBe('with\nnewline');
      expect(tokens[1]!.value).toBe('with`backtick');
    });
  });
  
  describe('Time units', () => {
    it('should tokenize time units as keywords', () => {
      const units = 'year years month months week weeks day days hour hours minute minutes second seconds millisecond milliseconds';
      const tokens = lex(units);
      tokens.slice(0, -1).forEach(t => {
        expect(t.type).toBe(TokenType.UNIT);
      });
    });
  });
});