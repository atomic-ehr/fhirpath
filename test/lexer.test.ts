import { describe, it, expect } from "bun:test";
import { Lexer, TokenType, Channel } from "../src/lexer";
import type { Token } from "../src/lexer";

describe("New Simplified Lexer", () => {
  function tokenize(input: string): Token[] {
    const lexer = new Lexer(input);
    return lexer.tokenize();
  }

  function tokenValues(input: string): string[] {
    return tokenize(input).map((t) => t.value);
  }

  function tokenizeWith(
    input: string,
    options: { trackPosition?: boolean; preserveTrivia?: boolean } = {},
  ): Token[] {
    const lexer = new Lexer(input, options);
    return lexer.tokenize();
  }

  function getToken(tokens: Token[], index: number): Token {
    const token = tokens[index];
    if (!token) {
      throw new Error(`Token at index ${index} is undefined`);
    }
    return token;
  }

  function tokenTypesAndValues(input: string): string[] {
    return tokenize(input).map((t) => {
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

  describe("Identifiers and Keywords", () => {
    it("should tokenize all keywords as identifiers", async () => {
      const keywords = [
        "and",
        "or",
        "xor",
        "implies",
        "div",
        "mod",
        "in",
        "contains",
        "is",
        "as",
        "true",
        "false",
        "where",
        "select",
        "year",
        "month",
        "day",
      ];

      for (const keyword of keywords) {
        const tokens = tokenize(keyword);
        expect(getToken(tokens, 0).type).toBe(TokenType.IDENTIFIER);
        expect(getToken(tokens, 0).value).toBe(keyword);
      }
    });

    it("should allow keywords in property access", async () => {
      const result = tokenTypesAndValues("Patient.where.contains.true");
      expect(result).toEqual([
        "ID:Patient",
        "DOT",
        "ID:where",
        "DOT",
        "ID:contains",
        "DOT",
        "ID:true",
        "EOF",
      ]);
    });

    it("should parse complex expressions with keyword operators", async () => {
      const result = tokenTypesAndValues("a and b or c implies d");
      expect(result).toEqual([
        "ID:a",
        "ID:and",
        "ID:b",
        "ID:or",
        "ID:c",
        "ID:implies",
        "ID:d",
        "EOF",
      ]);
    });
  });

  describe("Symbol Operators", () => {
    it("should tokenize arithmetic operators", async () => {
      const result = tokenTypesAndValues("1 + 2 - 3 * 4 / 5");
      expect(result).toEqual([
        "NUMBER",
        "OP:+",
        "NUMBER",
        "OP:-",
        "NUMBER",
        "OP:*",
        "NUMBER",
        "OP:/",
        "NUMBER",
        "EOF",
      ]);
    });

    it("should tokenize comparison operators", async () => {
      const result = tokenTypesAndValues("a < b > c <= d >= e");
      expect(result).toEqual([
        "ID:a",
        "OP:<",
        "ID:b",
        "OP:>",
        "ID:c",
        "OP:<=",
        "ID:d",
        "OP:>=",
        "ID:e",
        "EOF",
      ]);
    });

    it("should tokenize equality operators", async () => {
      const result = tokenTypesAndValues("a = b != c ~ d !~ e");
      expect(result).toEqual([
        "ID:a",
        "OP:=",
        "ID:b",
        "OP:!=",
        "ID:c",
        "OP:~",
        "ID:d",
        "OP:!~",
        "ID:e",
        "EOF",
      ]);
    });

    it("should tokenize other operators", async () => {
      const result = tokenTypesAndValues("a | b & c");
      expect(result).toEqual(["ID:a", "OP:|", "ID:b", "OP:&", "ID:c", "EOF"]);
    });

    it("should preserve operator values in tokens", async () => {
      const tokens = tokenize("+ - * / < > <= >= = != ~ !~ | &");
      const operators = tokens.filter((t) => t.type === TokenType.OPERATOR);
      const values = operators.map((t) => t.value);
      expect(values).toEqual([
        "+",
        "-",
        "*",
        "/",
        "<",
        ">",
        "<=",
        ">=",
        "=",
        "!=",
        "~",
        "!~",
        "|",
        "&",
      ]);
    });
  });

  describe("Literals", () => {
    it("should tokenize numbers", async () => {
      const tokens = tokenize("42 3.14 0.001");
      expect(getToken(tokens, 0).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 0).value).toBe("42");
      expect(getToken(tokens, 1).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 1).value).toBe("3.14");
      expect(getToken(tokens, 2).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 2).value).toBe("0.001");
    });

    it("should tokenize strings with single quotes", async () => {
      const tokens = tokenize("'hello' 'world'");
      expect(getToken(tokens, 0).type).toBe(TokenType.STRING);
      expect(getToken(tokens, 0).value).toBe("'hello'");
      expect(getToken(tokens, 1).value).toBe("'world'");
    });

    it("should tokenize strings with double quotes", async () => {
      const tokens = tokenize('"hello" "world"');
      expect(getToken(tokens, 0).type).toBe(TokenType.DOUBLE_QUOTED_STRING);
      expect(getToken(tokens, 0).value).toBe('"hello"');
    });

    it("should handle escaped characters in strings", async () => {
      const tokens = tokenize("'hello\\'world' 'line1\\nline2'");
      expect(getToken(tokens, 0).type).toBe(TokenType.STRING);
      expect(getToken(tokens, 0).value).toBe("'hello\\'world'");
    });

    it("should tokenize date and datetime literals", async () => {
      // Pure dates (no T) should be TokenType.DATE
      const dates = [
        "@2023",
        "@2023-12",
        "@2023-12-25",
      ];

      for (const dt of dates) {
        const tokens = tokenize(dt);
        expect(getToken(tokens, 0).type).toBe(TokenType.DATE);
        expect(getToken(tokens, 0).value).toBe(dt);
      }

      // DateTime (with T) should be TokenType.DATETIME
      const datetimes = [
        "@2023-12-25T10:30:00",
        "@2023-12-25T10:30:00Z",
        "@2023-12-25T10:30:00+05:30",
      ];

      for (const dt of datetimes) {
        const tokens = tokenize(dt);
        expect(getToken(tokens, 0).type).toBe(TokenType.DATETIME);
        expect(getToken(tokens, 0).value).toBe(dt);
      }
    });

    it("should tokenize time literals", async () => {
      const times = ["@T10:30", "@T10:30:45", "@T10:30:45.123"];

      for (const time of times) {
        const tokens = tokenize(time);
        expect(getToken(tokens, 0).type).toBe(TokenType.TIME);
        expect(getToken(tokens, 0).value).toBe(time);
      }
    });

    it("should track full span of complex datetime literals including timezone", async () => {
      const s = "@2023-12-25T10:30:45.123+05:30";
      const tokens = tokenize(s);
      const t = getToken(tokens, 0);
      expect(t.type).toBe(TokenType.DATETIME);
      expect(t.start).toBe(0);
      expect(t.end).toBe(s.length);
      expect(t.range?.start.line).toBe(0);
      expect(t.range?.start.character).toBe(0);
      expect(t.range?.end.line).toBe(0);
      expect(t.range?.end.character).toBe(s.length);
    });
  });

  describe("Environment Variables", () => {
    it("should tokenize simple environment variables", async () => {
      const result = tokenTypesAndValues("%ucum %context");
      expect(result).toEqual(["ENV:%ucum", "ENV:%context", "EOF"]);
    });

    it("should tokenize delimited environment variables", async () => {
      const result = tokenTypesAndValues("%`us-zip` %`my-var`");
      expect(result).toEqual(["ENV:%`us-zip`", "ENV:%`my-var`", "EOF"]);
    });

    it("should tokenize string-style environment variables (backwards compatibility)", async () => {
      const result = tokenTypesAndValues("%'us-zip' %'my-var'");
      expect(result).toEqual(["ENV:%'us-zip'", "ENV:%'my-var'", "EOF"]);
    });

    it("should preserve the full value of environment variables", async () => {
      const tokens = tokenize("%ucum %`us-zip` %'test'");
      expect(getToken(tokens, 0).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 0).value).toBe("%ucum");
      expect(getToken(tokens, 1).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 1).value).toBe("%`us-zip`");
      expect(getToken(tokens, 2).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 2).value).toBe("%'test'");
    });

    it("should handle escaped characters in delimited environment variables", async () => {
      const tokens = tokenize("%`with\\`backtick`");
      expect(getToken(tokens, 0).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 0).value).toBe("%`with\\`backtick`");
    });

    it("should handle escaped quotes in string-style environment variables", async () => {
      const tokens = tokenize("%'foo\\'bar'");
      expect(getToken(tokens, 0).type).toBe(TokenType.ENVIRONMENT_VARIABLE);
      expect(getToken(tokens, 0).value).toBe("%'foo\\'bar'");
    });

    it("should throw error for invalid environment variable names", async () => {
      expect(() => tokenize("%")).toThrow("Invalid environment variable name");
      expect(() => tokenize("% ")).toThrow("Invalid environment variable name");
      expect(() => tokenize("%123")).toThrow(
        "Invalid environment variable name",
      );
    });

    it("should throw error for unterminated environment variables", async () => {
      expect(() => tokenize("%`unterminated")).toThrow(
        "Unterminated environment variable",
      );
      expect(() => tokenize("%'unterminated")).toThrow(
        "Unterminated environment variable",
      );
    });
  });

  describe("Special Identifiers", () => {
    it("should tokenize all $... as SPECIAL_IDENTIFIER", async () => {
      const result = tokenTypesAndValues("$this $index $total $custom $var123");
      expect(result).toEqual([
        "$:this",
        "$:index",
        "$:total",
        "$:custom",
        "$:var123",
        "EOF",
      ]);
    });

    it("should preserve the full value of special identifiers", async () => {
      const tokens = tokenize("$this $custom_var $test123");
      expect(getToken(tokens, 0).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe("$this");
      expect(getToken(tokens, 1).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 1).value).toBe("$custom_var");
      expect(getToken(tokens, 2).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 2).value).toBe("$test123");
    });

    it("should handle $ without following identifier", async () => {
      const tokens = tokenize("$ $");
      expect(getToken(tokens, 0).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe("$");
      expect(getToken(tokens, 1).type).toBe(TokenType.SPECIAL_IDENTIFIER);
      expect(getToken(tokens, 1).value).toBe("$");
    });

    it("should tokenize delimited identifiers", async () => {
      const tokens = tokenize("`special identifier` `with spaces`");
      expect(getToken(tokens, 0).type).toBe(TokenType.IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe("`special identifier`");
      expect(getToken(tokens, 1).value).toBe("`with spaces`");
    });

    it("should handle escaped backticks in delimited identifiers", async () => {
      const tokens = tokenize("`with\\`backtick`");
      expect(getToken(tokens, 0).type).toBe(TokenType.IDENTIFIER);
      expect(getToken(tokens, 0).value).toBe("`with\\`backtick`");
    });
  });

  describe("Structural Tokens", () => {
    it("should tokenize parentheses", async () => {
      const result = tokenTypesAndValues("(a + b)");
      expect(result).toEqual([
        "LPAREN",
        "ID:a",
        "OP:+",
        "ID:b",
        "RPAREN",
        "EOF",
      ]);
    });

    it("should tokenize brackets", async () => {
      const result = tokenTypesAndValues("a[0]");
      expect(result).toEqual(["ID:a", "LBRACKET", "NUMBER", "RBRACKET", "EOF"]);
    });

    it("should tokenize braces", async () => {
      const result = tokenTypesAndValues("{}");
      expect(result).toEqual(["LBRACE", "RBRACE", "EOF"]);
    });

    it("should tokenize dots", async () => {
      const result = tokenTypesAndValues("a.b.c");
      expect(result).toEqual(["ID:a", "DOT", "ID:b", "DOT", "ID:c", "EOF"]);
    });

    it("should tokenize commas", async () => {
      const result = tokenTypesAndValues("a, b, c");
      expect(result).toEqual(["ID:a", "COMMA", "ID:b", "COMMA", "ID:c", "EOF"]);
    });
  });

  describe("Comments", () => {
    it("should skip line comments", async () => {
      const result = tokenTypesAndValues("a + b // this is a comment\n+ c");
      expect(result).toEqual(["ID:a", "OP:+", "ID:b", "OP:+", "ID:c", "EOF"]);
    });

    it("should skip block comments", async () => {
      const result = tokenTypesAndValues("a /* comment */ + /* another */ b");
      expect(result).toEqual(["ID:a", "OP:+", "ID:b", "EOF"]);
    });

    it("should handle multi-line block comments", async () => {
      const result = tokenTypesAndValues("a /* line1\nline2\nline3 */ + b");
      expect(result).toEqual(["ID:a", "OP:+", "ID:b", "EOF"]);
    });

    it("should preserve trivia tokens and ranges when enabled", async () => {
      const input = "a  /*x*/\n //y\n b";
      const tokens = tokenizeWith(input, { preserveTrivia: true });
      // Expect presence of whitespace and both comment token types
      expect(tokens.some((t) => t.type === TokenType.WHITESPACE)).toBe(true);
      const block = tokens.find((t) => t.type === TokenType.BLOCK_COMMENT)!;
      const line = tokens.find((t) => t.type === TokenType.LINE_COMMENT)!;
      expect(block).toBeTruthy();
      expect(line).toBeTruthy();
      expect(block.channel).toBe(Channel.HIDDEN);
      expect(line.channel).toBe(Channel.HIDDEN);
      expect(block.value).toBe("/*x*/");
      expect(line.value).toBe("//y");
      // Ranges: block on line 0, line comment ends on line 1 before newline
      expect(block.range?.start.line).toBe(0);
      expect(line.range?.end.line).toBe(1);
    });
  });

  describe("Complex Expressions", () => {
    it("should tokenize FHIRPath navigation", async () => {
      const result = tokenTypesAndValues("Patient.name.given.first()");
      expect(result).toEqual([
        "ID:Patient",
        "DOT",
        "ID:name",
        "DOT",
        "ID:given",
        "DOT",
        "ID:first",
        "LPAREN",
        "RPAREN",
        "EOF",
      ]);
    });

    it("should tokenize expressions with mixed operators", async () => {
      const result = tokenTypesAndValues("age >= 18 and status = 'active'");
      expect(result).toEqual([
        "ID:age",
        "OP:>=",
        "NUMBER",
        "ID:and",
        "ID:status",
        "OP:=",
        "STRING",
        "EOF",
      ]);
    });

    it("should tokenize function calls with arguments", async () => {
      const result = tokenTypesAndValues("where(use = 'official').given");
      expect(result).toEqual([
        "ID:where",
        "LPAREN",
        "ID:use",
        "OP:=",
        "STRING",
        "RPAREN",
        "DOT",
        "ID:given",
        "EOF",
      ]);
    });

    it("should tokenize complex boolean expressions", async () => {
      const result = tokenTypesAndValues("a or b and c implies d");
      expect(result).toEqual([
        "ID:a",
        "ID:or",
        "ID:b",
        "ID:and",
        "ID:c",
        "ID:implies",
        "ID:d",
        "EOF",
      ]);
    });
  });

  describe("Position Tracking", () => {
    it("should track token positions", async () => {
      const tokens = tokenize("a + b");

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

    it("should track line numbers", async () => {
      const tokens = tokenize("a\n+\nb");

      expect(getToken(tokens, 0).line).toBe(1);
      expect(getToken(tokens, 1).line).toBe(2);
      expect(getToken(tokens, 2).line).toBe(3);
    });

    it("should handle position tracking option", async () => {
      const lexer = new Lexer("a + b", { trackPosition: false });
      const tokens = lexer.tokenize();

      expect(getToken(tokens, 0).line).toBe(0);
      expect(getToken(tokens, 0).column).toBe(0);
    });

    it("should populate LSP ranges with correct offsets", async () => {
      const input = "a +\n b"; // indexes: 0:a 1:space 2:+ 3:\n 4:space 5:b
      const tokens = tokenize(input);
      const a = getToken(tokens, 0);
      const plus = getToken(tokens, 1);
      const b = getToken(tokens, 2);
      // 'a'
      expect(a.range?.start.line).toBe(0);
      expect(a.range?.start.character).toBe(0);
      expect(a.range?.end.line).toBe(0);
      expect(a.range?.end.character).toBe(1);
      // '+'
      expect(plus.range?.start.line).toBe(0);
      expect(plus.range?.start.character).toBe(2);
      expect(plus.range?.end.line).toBe(0);
      expect(plus.range?.end.character).toBe(3);
      // 'b'
      expect(b.range?.start.line).toBe(1);
      expect(b.range?.start.character).toBe(1);
      expect(b.range?.end.line).toBe(1);
      expect(b.range?.end.character).toBe(2);
    });

    it("should handle CRLF and CR newlines in ranges and legacy line/column", async () => {
      const crlf = tokenize("a\r\n+\r\nb");
      expect(getToken(crlf, 0).line).toBe(1);
      expect(getToken(crlf, 0).column).toBe(1);
      expect(getToken(crlf, 0).range?.start.line).toBe(0);
      expect(getToken(crlf, 1).range?.start.line).toBe(1);
      expect(getToken(crlf, 2).range?.start.line).toBe(2);

      const crOnly = tokenize("a\rb");
      expect(getToken(crOnly, 0).line).toBe(1);
      expect(getToken(crOnly, 1).line).toBe(2);
      expect(getToken(crOnly, 1).column).toBe(1);
      expect(getToken(crOnly, 1).range?.start.line).toBe(1);
      expect(getToken(crOnly, 1).range?.start.character).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input", async () => {
      const result = tokenTypesAndValues("");
      expect(result).toEqual(["EOF"]);
    });

    it("should handle whitespace-only input", async () => {
      const result = tokenTypesAndValues("   \n\t  ");
      expect(result).toEqual(["EOF"]);
    });

    it("should handle invalid characters", async () => {
      expect(() => tokenize("#")).toThrow("Unexpected character '#'");
    });

    it("should handle unterminated strings", async () => {
      expect(() => tokenize("'unterminated")).toThrow("Unterminated string");
    });

    it("should handle unterminated delimited identifiers", async () => {
      expect(() => tokenize("`unterminated")).toThrow(
        "Unterminated delimited identifier",
      );
    });

    it("should handle invalid datetime formats", async () => {
      expect(() => tokenize("@20")).toThrow("Invalid datetime format");
      expect(() => tokenize("@2023-1")).toThrow("Invalid datetime format");
    });

    it("should handle single exclamation mark", async () => {
      expect(() => tokenize("a ! b")).toThrow("Unexpected character '!'");
    });

    it("should not combine '!' with separated '='", async () => {
      expect(() => tokenize("a ! = b")).toThrow("Unexpected character '!'");
    });

    it("should error on '!' at end of input", async () => {
      expect(() => tokenize("a !")).toThrow("Unexpected character '!'");
    });
  });

  describe("Real-world Examples", () => {
    it("should tokenize FHIR resource paths", async () => {
      const result = tokenTypesAndValues(
        "Patient.identifier.where(system = 'http://example.org').value",
      );
      expect(result).toEqual([
        "ID:Patient",
        "DOT",
        "ID:identifier",
        "DOT",
        "ID:where",
        "LPAREN",
        "ID:system",
        "OP:=",
        "STRING",
        "RPAREN",
        "DOT",
        "ID:value",
        "EOF",
      ]);
    });

    it("should tokenize complex filter expressions", async () => {
      const result = tokenTypesAndValues(
        "Observation.where(code.coding.exists(system = 'LOINC' and code = '1234-5'))",
      );
      expect(result).toEqual([
        "ID:Observation",
        "DOT",
        "ID:where",
        "LPAREN",
        "ID:code",
        "DOT",
        "ID:coding",
        "DOT",
        "ID:exists",
        "LPAREN",
        "ID:system",
        "OP:=",
        "STRING",
        "ID:and",
        "ID:code",
        "OP:=",
        "STRING",
        "RPAREN",
        "RPAREN",
        "EOF",
      ]);
    });

    it("should handle quantity literals (as separate tokens)", async () => {
      const result = tokenTypesAndValues("5 days");
      expect(result).toEqual(["NUMBER", "ID:days", "EOF"]);
    });

    it("should tokenize expressions with environment variables", async () => {
      const result = tokenTypesAndValues(
        "value.matches(%`us-zip`) and system = %ucum",
      );
      expect(result).toEqual([
        "ID:value",
        "DOT",
        "ID:matches",
        "LPAREN",
        "ENV:%`us-zip`",
        "RPAREN",
        "ID:and",
        "ID:system",
        "OP:=",
        "ENV:%ucum",
        "EOF",
      ]);
    });

    it("manual", async () => {
      const result = tokenize("Patient.name.given");
      expect(result).toBeDefined();
    });
  });

  describe("QUANTITY", () => {
    it("should tokenize UCUM quantity as a single QUANTITY token", async () => {
      const input = "5 'mg'";
      const tokens = tokenize(input);
      expect(getToken(tokens, 0).type).toBe(TokenType.QUANTITY);
      expect(getToken(tokens, 0).value).toBe("5 'mg'");
      expect(getToken(tokens, 0).start).toBe(0);
      expect(getToken(tokens, 0).end).toBe(input.length);
    });

    it("should support decimal and no-space UCUM quantities", async () => {
      const t1 = tokenize("0.25 'g'");
      expect(getToken(t1, 0).type).toBe(TokenType.QUANTITY);
      expect(getToken(t1, 0).value).toBe("0.25 'g'");

      const t2 = tokenize("5'mg'");
      expect(getToken(t2, 0).type).toBe(TokenType.QUANTITY);
      expect(getToken(t2, 0).value).toBe("5'mg'");
    });

    it("should set LSP range to full span of quantity", async () => {
      const input = "0.5 'mL'";
      const tok = getToken(tokenize(input), 0);
      expect(tok.range?.start.line).toBe(0);
      expect(tok.range?.start.character).toBe(0);
      expect(tok.range?.end.character).toBe(input.length);
    });

    it("should support escaped quotes inside UCUM unit", async () => {
      const input = "5 'm\\'g'";
      const tok = getToken(tokenize(input), 0);
      expect(tok.type).toBe(TokenType.QUANTITY);
      expect(tok.value).toBe("5 'm\\'g'");
    });
  });
});
