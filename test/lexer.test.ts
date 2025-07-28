import { describe, it, expect } from 'bun:test';
import { Lexer, TokenType } from '../src/lexer';
import type { Token } from '../src/lexer';

describe('New Simplified Lexer', () => {
  function tokenize(input: string): Token[] {
    const lexer = new Lexer(input);
    return lexer.tokenize();
  }
  
  function tokenValues(input: string): string[] {
    return tokenize(input).map(t => t.value);
  }
  
  function getToken(tokens: Token[], index: number): Token {
    const token = tokens[index];
    if (!token) {
      throw new Error(`Token at index ${index} is undefined`);
    }
    return token;
  }
  
  function tokenTypesAndValues(input: string): string[] {
    return tokenize(input).map(t => {
      const typeName = TokenType[t.type];
      if (t.type === TokenType.IDENTIFIER) {
        return `ID:${t.value}`;
      } else if (t.type === TokenType.SPECIAL_IDENTIFIER) {
        return `$:${t.value.substring(1)}`; // Show without the $ prefix for clarity
      } else if (t.type === TokenType.OPERATOR) {
        return `OP:${t.value}`;
      } else if (t.type === TokenType.ENVIRONMENT_VARIABLE) {
        return `ENV:${t.value}`;
      } else {
        return typeName;
      }
    });
  }

  describe('Identifiers and Keywords', () => {
    it('should tokenize all keywords as identifiers', () => {
      const keywords = ['and', 'or', 'xor', 'implies', 'div', 'mod', 'in', 'contains', 'is', 'as', 
                       'true', 'false', 'where', 'select', 'year', 'month', 'day'];
      
      for (const keyword of keywords) {
        const tokens = tokenize(keyword);
        expect(getToken(tokens, 0).type).toBe(TokenType.IDENTIFIER);
        expect(getToken(tokens, 0).value).toBe(keyword);
      }
    });

    it('should allow keywords in property access', () => {
      const result = tokenTypesAndValues('Patient.where.contains.true');
      expect(result).toEqual(['ID:Patient', 'DOT', 'ID:where', 'DOT', 'ID:contains', 'DOT', 'ID:true', 'EOF']);
    });

    it('should parse complex expressions with keyword operators', () => {
      const result = tokenTypesAndValues('a and b or c implies d');
      expect(result).toEqual(['ID:a', 'ID:and', 'ID:b', 'ID:or', 'ID:c', 'ID:implies', 'ID:d', 'EOF']);
    });
  });

  describe('Symbol Operators', () => {
    it('should tokenize arithmetic operators', () => {
      const result = tokenTypesAndValues('1 + 2 - 3 * 4 / 5');
      expect(result).toEqual(['NUMBER', 'OP:+', 'NUMBER', 'OP:-', 'NUMBER', 'OP:*', 'NUMBER', 'OP:/', 'NUMBER', 'EOF']);
    });

    it('should tokenize comparison operators', () => {
      const result = tokenTypesAndValues('a < b > c <= d >= e');
      expect(result).toEqual(['ID:a', 'OP:<', 'ID:b', 'OP:>', 'ID:c', 'OP:<=', 'ID:d', 'OP:>=', 'ID:e', 'EOF']);
    });

    it('should tokenize equality operators', () => {
      const result = tokenTypesAndValues('a = b != c ~ d !~ e');
      expect(result).toEqual(['ID:a', 'OP:=', 'ID:b', 'OP:!=', 'ID:c', 'OP:~', 'ID:d', 'OP:!~', 'ID:e', 'EOF']);
    });

    it('should tokenize other operators', () => {
      const result = tokenTypesAndValues('a | b & c');
      expect(result).toEqual(['ID:a', 'OP:|', 'ID:b', 'OP:&', 'ID:c', 'EOF']);
    });

    it('should preserve operator values in tokens', () => {
      const tokens = tokenize('+ - * / < > <= >= = != ~ !~ | &');
      const operators = tokens.filter(t => t.type === TokenType.OPERATOR);
      const values = operators.map(t => t.value);
      expect(values).toEqual(['+', '-', '*', '/', '<', '>', '<=', '>=', '=', '!=', '~', '!~', '|', '&']);
    });
  });

  describe('Literals', () => {
    it('should tokenize numbers', () => {
      const tokens = tokenize('42 3.14 0.001');
      expect(getToken(tokens, 0).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 0).value).toBe('42');
      expect(getToken(tokens, 1).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 1).value).toBe('3.14');
      expect(getToken(tokens, 2).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 2).value).toBe('0.001');
    });

    it('should tokenize strings with single quotes', () => {
      const tokens = tokenize("'hello' 'world'");
      expect(getToken(tokens, 0).type).toBe(TokenType.STRING);
      expect(getToken(tokens, 0).value).toBe("'hello'");
      expect(getToken(tokens, 1).value).toBe("'world'");
    });

    it('should tokenize strings with double quotes', () => {
      const tokens = tokenize('"hello" "world"');
      expect(getToken(tokens, 0).type).toBe(TokenType.STRING);
      expect(getToken(tokens, 0).value).toBe('"hello"');
    });

    it('should handle escaped characters in strings', () => {
      const tokens = tokenize("'hello\\'world' 'line1\\nline2'");
      expect(getToken(tokens, 0).type).toBe(TokenType.STRING);
      expect(getToken(tokens, 0).value).toBe("'hello\\'world'");
    });

    it('should tokenize datetime literals', () => {
      const datetimes = [
        '@2023',
        '@2023-12',
        '@2023-12-25',
        '@2023-12-25T10:30:00',
        '@2023-12-25T10:30:00Z',
        '@2023-12-25T10:30:00+05:30'
      ];
      
      for (const dt of datetimes) {
        const tokens = tokenize(dt);
        expect(getToken(tokens, 0).type).toBe(TokenType.DATETIME);
        expect(getToken(tokens, 0).value).toBe(dt);
      }
    });

    it('should tokenize time literals', () => {
      const times = ['@T10:30', '@T10:30:45', '@T10:30:45.123'];
      
      for (const time of times) {
        const tokens = tokenize(time);
        expect(getToken(tokens, 0).type).toBe(TokenType.TIME);
        expect(getToken(tokens, 0).value).toBe(time);
      }
    });
  });

  describe('Environment Variables', () => {
    it('should tokenize simple environment variables', () => {
      const result = tokenTypesAndValues('%ucum %context');
      expect(result).toEqual(['ENV:%ucum', 'ENV:%context', 'EOF']);
    });

    it('should tokenize delimited environment variables', () => {
      const result = tokenTypesAndValues('%`us-zip` %`my-var`');
      expect(result).toEqual(['ENV:%`us-zip`', 'ENV:%`my-var`', 'EOF']);
    });

    it('should tokenize string-style environment variables (backwards compatibility)', () => {
      const result = tokenTypesAndValues("%'us-zip' %'my-var'");
      expect(result).toEqual(["ENV:%'us-zip'", "ENV:%'my-var'", 'EOF']);
    });

    it('should preserve the full value of environment variables', () => {
      const tokens = tokenize('%ucum %`us-zip` %\'test\'');
      expect(getToken(tokens, 0).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 0).value).toBe('%ucum');
      expect(getToken(tokens, 1).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 1).value).toBe('%`us-zip`');
      expect(getToken(tokens, 2).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 2).value).toBe("%'test'");
    });

    it('should handle escaped characters in delimited environment variables', () => {
      const tokens = tokenize('%`with\\`backtick`');
      expect(getToken(tokens, 0).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 0).value).toBe('%`with\\`backtick`');
    });

    it('should throw error for invalid environment variable names', () => {
      expect(() => tokenize('%')).toThrow('Invalid environment variable name');
      expect(() => tokenize('% ')).toThrow('Invalid environment variable name');
      expect(() => tokenize('%123')).toThrow('Invalid environment variable name');
    });

    it('should throw error for unterminated environment variables', () => {
      expect(() => tokenize('%`unterminated')).toThrow('Unterminated environment variable');
      expect(() => tokenize("%'unterminated")).toThrow('Unterminated environment variable');
    });
  });

  describe('Special Identifiers', () => {
    it('should tokenize all $... as SPECIAL_IDENTIFIER', () => {
      const result = tokenTypesAndValues('$this $index $total $custom $var123');
      expect(result).toEqual(['$:this', '$:index', '$:total', '$:custom', '$:var123', 'EOF']);
    });

    it('should preserve the full value of special identifiers', () => {
      const tokens = tokenize('$this $custom_var $test123');
      expect(getToken(tokens, 0).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe('$this');
      expect(getToken(tokens, 1).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 1).value).toBe('$custom_var');
      expect(getToken(tokens, 2).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 2).value).toBe('$test123');
    });

    it('should handle $ without following identifier', () => {
      const tokens = tokenize('$ $');
      expect(getToken(tokens, 0).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe('$');
      expect(getToken(tokens, 1).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 1).value).toBe('$');
    });

    it('should tokenize delimited identifiers', () => {
      const tokens = tokenize('`special identifier` `with spaces`');
      expect(getToken(tokens, 0).type).toBe(TokenType.IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe('`special identifier`');
      expect(getToken(tokens, 1).value).toBe('`with spaces`');
    });

    it('should handle escaped backticks in delimited identifiers', () => {
      const tokens = tokenize('`with\\`backtick`');
      expect(getToken(tokens, 0).type).toBe(TokenType.IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe('`with\\`backtick`');
    });
  });

  describe('Structural Tokens', () => {
    it('should tokenize parentheses', () => {
      const result = tokenTypesAndValues('(a + b)');
      expect(result).toEqual(['LPAREN', 'ID:a', 'OP:+', 'ID:b', 'RPAREN', 'EOF']);
    });

    it('should tokenize brackets', () => {
      const result = tokenTypesAndValues('a[0]');
      expect(result).toEqual(['ID:a', 'LBRACKET', 'NUMBER', 'RBRACKET', 'EOF']);
    });

    it('should tokenize braces', () => {
      const result = tokenTypesAndValues('{}');
      expect(result).toEqual(['LBRACE', 'RBRACE', 'EOF']);
    });

    it('should tokenize dots', () => {
      const result = tokenTypesAndValues('a.b.c');
      expect(result).toEqual(['ID:a', 'DOT', 'ID:b', 'DOT', 'ID:c', 'EOF']);
    });

    it('should tokenize commas', () => {
      const result = tokenTypesAndValues('a, b, c');
      expect(result).toEqual(['ID:a', 'COMMA', 'ID:b', 'COMMA', 'ID:c', 'EOF']);
    });
  });

  describe('Comments', () => {
    it('should skip line comments', () => {
      const result = tokenTypesAndValues('a + b // this is a comment\n+ c');
      expect(result).toEqual(['ID:a', 'OP:+', 'ID:b', 'OP:+', 'ID:c', 'EOF']);
    });

    it('should skip block comments', () => {
      const result = tokenTypesAndValues('a /* comment */ + /* another */ b');
      expect(result).toEqual(['ID:a', 'OP:+', 'ID:b', 'EOF']);
    });

    it('should handle multi-line block comments', () => {
      const result = tokenTypesAndValues('a /* line1\nline2\nline3 */ + b');
      expect(result).toEqual(['ID:a', 'OP:+', 'ID:b', 'EOF']);
    });
  });

  describe('Complex Expressions', () => {
    it('should tokenize FHIRPath navigation', () => {
      const result = tokenTypesAndValues('Patient.name.given.first()');
      expect(result).toEqual(['ID:Patient', 'DOT', 'ID:name', 'DOT', 'ID:given', 'DOT', 'ID:first', 'LPAREN', 'RPAREN', 'EOF']);
    });

    it('should tokenize expressions with mixed operators', () => {
      const result = tokenTypesAndValues('age >= 18 and status = "active"');
      expect(result).toEqual(['ID:age', 'OP:>=', 'NUMBER', 'ID:and', 'ID:status', 'OP:=', 'STRING', 'EOF']);
    });

    it('should tokenize function calls with arguments', () => {
      const result = tokenTypesAndValues('where(use = "official").given');
      expect(result).toEqual([
        'ID:where', 'LPAREN', 'ID:use', 'OP:=', 'STRING', 'RPAREN', 'DOT', 'ID:given', 'EOF'
      ]);
    });

    it('should tokenize complex boolean expressions', () => {
      const result = tokenTypesAndValues('a or b and c implies d');
      expect(result).toEqual(['ID:a', 'ID:or', 'ID:b', 'ID:and', 'ID:c', 'ID:implies', 'ID:d', 'EOF']);
    });
  });

  describe('Position Tracking', () => {
    it('should track token positions', () => {
      const tokens = tokenize('a + b');
      
      expect(getToken(tokens, 0).start).toBe(0);
      expect(getToken(tokens, 0).end).toBe(1);
      expect(getToken(tokens, 0).line).toBe(1);
      expect(getToken(tokens, 0).column).toBe(1);
      
      expect(getToken(tokens, 1).start).toBe(2);
      expect(getToken(tokens, 1).end).toBe(3);
      expect(getToken(tokens, 1).line).toBe(1);
      expect(getToken(tokens, 1).column).toBe(3);
      
      expect(getToken(tokens, 2).start).toBe(4);
      expect(getToken(tokens, 2).end).toBe(5);
      expect(getToken(tokens, 2).line).toBe(1);
      expect(getToken(tokens, 2).column).toBe(5);
    });

    it('should track line numbers', () => {
      const tokens = tokenize('a\n+\nb');
      
      expect(getToken(tokens, 0).line).toBe(1);
      expect(getToken(tokens, 1).line).toBe(2);
      expect(getToken(tokens, 2).line).toBe(3);
    });

    it('should handle position tracking option', () => {
      const lexer = new Lexer('a + b', { trackPosition: false });
      const tokens = lexer.tokenize();
      
      expect(getToken(tokens, 0).line).toBe(0);
      expect(getToken(tokens, 0).column).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const result = tokenTypesAndValues('');
      expect(result).toEqual(['EOF']);
    });

    it('should handle whitespace-only input', () => {
      const result = tokenTypesAndValues('   \n\t  ');
      expect(result).toEqual(['EOF']);
    });

    it('should handle invalid characters', () => {
      expect(() => tokenize('#')).toThrow("Unexpected character '#'");
    });

    it('should handle unterminated strings', () => {
      expect(() => tokenize("'unterminated")).toThrow('Unterminated string');
    });

    it('should handle unterminated delimited identifiers', () => {
      expect(() => tokenize('`unterminated')).toThrow('Unterminated delimited identifier');
    });

    it('should handle invalid datetime formats', () => {
      expect(() => tokenize('@20')).toThrow('Invalid datetime format');
      expect(() => tokenize('@2023-1')).toThrow('Invalid datetime format');
    });

    it('should handle single exclamation mark', () => {
      expect(() => tokenize('a ! b')).toThrow("Unexpected character '!'");
    });
  });

  describe('Real-world Examples', () => {
    it('should tokenize FHIR resource paths', () => {
      const result = tokenTypesAndValues('Patient.identifier.where(system = "http://example.org").value');
      expect(result).toEqual([
        'ID:Patient', 'DOT', 'ID:identifier', 'DOT', 'ID:where', 'LPAREN',
        'ID:system', 'OP:=', 'STRING', 'RPAREN', 'DOT', 'ID:value', 'EOF'
      ]);
    });

    it('should tokenize complex filter expressions', () => {
      const result = tokenTypesAndValues('Observation.where(code.coding.exists(system = "LOINC" and code = "1234-5"))');
      expect(result).toEqual([
        'ID:Observation', 'DOT', 'ID:where', 'LPAREN',
        'ID:code', 'DOT', 'ID:coding', 'DOT', 'ID:exists', 'LPAREN',
        'ID:system', 'OP:=', 'STRING', 'ID:and', 'ID:code', 'OP:=', 'STRING',
        'RPAREN', 'RPAREN', 'EOF'
      ]);
    });

    it('should handle quantity literals (as separate tokens)', () => {
      const result = tokenTypesAndValues('5 days');
      expect(result).toEqual(['NUMBER', 'ID:days', 'EOF']);
    });

    it('should tokenize expressions with environment variables', () => {
      const result = tokenTypesAndValues('value.matches(%`us-zip`) and system = %ucum');
      expect(result).toEqual([
        'ID:value', 'DOT', 'ID:matches', 'LPAREN', 'ENV:%`us-zip`', 'RPAREN', 
        'ID:and', 'ID:system', 'OP:=', 'ENV:%ucum', 'EOF'
      ]);
    });
  });
});