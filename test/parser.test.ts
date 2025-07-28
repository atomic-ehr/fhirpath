import { describe, it, expect } from 'bun:test';
import { Parser } from '../src/parser';
import { NodeType } from '../src/parser';

describe('FHIRPath Parser', () => {
  function parse(expr: string) {
    const parser = new Parser(expr);
    return parser.parse();
  }

  describe('Literals', () => {
    it('should parse numbers', () => {
      const ast = parse('42');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(42);
      expect(ast.valueType).toBe('number');
    });

    it('should parse decimal numbers', () => {
      const ast = parse('3.14');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(3.14);
      expect(ast.valueType).toBe('number');
    });

    it('should parse strings with single quotes', () => {
      const ast = parse("'hello world'");
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe('hello world');
      expect(ast.valueType).toBe('string');
    });

    it('should parse strings with double quotes', () => {
      const ast = parse('"hello world"');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe('hello world');
      expect(ast.valueType).toBe('string');
    });

    it('should parse boolean true', () => {
      const ast = parse('true');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(true);
      expect(ast.valueType).toBe('boolean');
    });

    it('should parse boolean false', () => {
      const ast = parse('false');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(false);
      expect(ast.valueType).toBe('boolean');
    });

    it('should parse null', () => {
      const ast = parse('null');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(null);
      expect(ast.valueType).toBe('null');
    });

    it('should parse datetime literals', () => {
      const ast = parse('@2023-12-25T10:30:00Z');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe('2023-12-25T10:30:00Z');
      expect(ast.valueType).toBe('datetime');
    });

    it('should parse time literals', () => {
      const ast = parse('@T10:30:00');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe('T10:30:00');
      expect(ast.valueType).toBe('time');
    });

    it('should parse collections', () => {
      const ast = parse('{1, 2, 3}');
      expect(ast.type).toBe(NodeType.Collection);
      expect(ast.elements).toHaveLength(3);
      expect(ast.elements[0].value).toBe(1);
      expect(ast.elements[1].value).toBe(2);
      expect(ast.elements[2].value).toBe(3);
    });

    it('should parse empty collections', () => {
      const ast = parse('{}');
      expect(ast.type).toBe(NodeType.Collection);
      expect(ast.elements).toHaveLength(0);
    });
  });

  describe('Identifiers', () => {
    it('should parse simple identifiers', () => {
      const ast = parse('name');
      expect(ast.type).toBe(NodeType.Identifier);
      expect(ast.name).toBe('name');
    });

    it('should parse identifiers starting with uppercase as TypeOrIdentifier', () => {
      const ast = parse('Patient');
      expect(ast.type).toBe(NodeType.TypeOrIdentifier);
      expect(ast.name).toBe('Patient');
    });

    it('should parse delimited identifiers', () => {
      const ast = parse('`special identifier`');
      expect(ast.type).toBe(NodeType.Identifier);
      expect(ast.name).toBe('special identifier');
    });
  });

  describe('Variables', () => {
    it('should parse special identifiers', () => {
      const ast = parse('$this');
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe('$this');
    });

    it('should parse $index', () => {
      const ast = parse('$index');
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe('$index');
    });

    it('should parse environment variables', () => {
      const ast = parse('%ucum');
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe('%ucum');
    });

    it('should parse delimited environment variables', () => {
      const ast = parse('%`us-zip`');
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe('%`us-zip`');
    });

    it('should parse string-style environment variables', () => {
      const ast = parse("%'my-var'");
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe("%'my-var'");
    });
  });

  describe('Binary Operators', () => {
    describe('Arithmetic', () => {
      it('should parse addition', () => {
        const ast = parse('5 + 3');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('+');
        expect(ast.left.value).toBe(5);
        expect(ast.right.value).toBe(3);
      });

      it('should parse subtraction', () => {
        const ast = parse('10 - 4');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('-');
        expect(ast.left.value).toBe(10);
        expect(ast.right.value).toBe(4);
      });

      it('should parse multiplication', () => {
        const ast = parse('6 * 7');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('*');
        expect(ast.left.value).toBe(6);
        expect(ast.right.value).toBe(7);
      });

      it('should parse division', () => {
        const ast = parse('20 / 4');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('/');
        expect(ast.left.value).toBe(20);
        expect(ast.right.value).toBe(4);
      });

      it('should parse div operator', () => {
        const ast = parse('20 div 3');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('div');
        expect(ast.left.value).toBe(20);
        expect(ast.right.value).toBe(3);
      });

      it('should parse mod operator', () => {
        const ast = parse('20 mod 3');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('mod');
        expect(ast.left.value).toBe(20);
        expect(ast.right.value).toBe(3);
      });
    });

    describe('Comparison', () => {
      it('should parse less than', () => {
        const ast = parse('a < b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('<');
      });

      it('should parse greater than', () => {
        const ast = parse('a > b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('>');
      });

      it('should parse less than or equal', () => {
        const ast = parse('a <= b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('<=');
      });

      it('should parse greater than or equal', () => {
        const ast = parse('a >= b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('>=');
      });

      it('should parse equality', () => {
        const ast = parse('a = b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('=');
      });

      it('should parse inequality', () => {
        const ast = parse('a != b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('!=');
      });

      it('should parse similarity', () => {
        const ast = parse('a ~ b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('~');
      });

      it('should parse not similar', () => {
        const ast = parse('a !~ b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('!~');
      });
    });

    describe('Logical', () => {
      it('should parse and operator', () => {
        const ast = parse('true and false');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('and');
      });

      it('should parse or operator', () => {
        const ast = parse('true or false');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('or');
      });

      it('should parse xor operator', () => {
        const ast = parse('true xor false');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('xor');
      });

      it('should parse implies operator', () => {
        const ast = parse('a implies b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('implies');
      });
    });

    describe('Membership', () => {
      it('should parse in operator', () => {
        const ast = parse('5 in list');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('in');
      });

      it('should parse contains operator', () => {
        const ast = parse('list contains 5');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('contains');
      });
    });

    describe('Other', () => {
      it('should parse pipe operator', () => {
        const ast = parse('a | b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('|');
      });

      it('should parse ampersand operator', () => {
        const ast = parse('a & b');
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe('&');
      });
    });
  });

  describe('Unary Operators', () => {
    it('should parse unary plus', () => {
      const ast = parse('+5');
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe('+');
      expect(ast.operand.value).toBe(5);
    });

    it('should parse unary minus', () => {
      const ast = parse('-5');
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe('-');
      expect(ast.operand.value).toBe(5);
    });

    it('should parse not operator', () => {
      const ast = parse('not active');
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe('not');
      expect(ast.operand.name).toBe('active');
    });

    it('should parse unary on identifiers', () => {
      const ast = parse('-value');
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe('-');
      expect(ast.operand.type).toBe(NodeType.Identifier);
      expect(ast.operand.name).toBe('value');
    });
  });

  describe('Navigation', () => {
    it('should parse simple navigation', () => {
      const ast = parse('Patient.name');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      expect(ast.left.name).toBe('Patient');
      expect(ast.right.name).toBe('name');
    });

    it('should parse chained navigation', () => {
      const ast = parse('Patient.name.given');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      expect(ast.left.type).toBe(NodeType.Binary);
      expect(ast.left.operator).toBe('.');
      expect(ast.right.name).toBe('given');
    });

    it('should parse navigation with environment variables', () => {
      const ast = parse('Patient.%resource');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      expect(ast.left.name).toBe('Patient');
      expect(ast.right.type).toBe(NodeType.Variable);
      expect(ast.right.name).toBe('%resource');
    });
  });

  describe('Functions', () => {
    it('should parse function calls with no arguments', () => {
      const ast = parse('count()');
      expect(ast.type).toBe(NodeType.Function);
      expect(ast.name.name).toBe('count');
      expect(ast.arguments).toHaveLength(0);
    });

    it('should parse function calls with arguments', () => {
      const ast = parse('substring(0, 5)');
      expect(ast.type).toBe(NodeType.Function);
      expect(ast.name.name).toBe('substring');
      expect(ast.arguments).toHaveLength(2);
      expect(ast.arguments[0].value).toBe(0);
      expect(ast.arguments[1].value).toBe(5);
    });

    it('should parse method syntax', () => {
      const ast = parse('name.first()');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      expect(ast.right.type).toBe(NodeType.Function);
      expect(ast.right.name.name).toBe('first');
    });

    it('should parse functions with complex arguments', () => {
      const ast = parse('where(use = "official")');
      expect(ast.type).toBe(NodeType.Function);
      expect(ast.name.name).toBe('where');
      expect(ast.arguments).toHaveLength(1);
      expect(ast.arguments[0].type).toBe(NodeType.Binary);
      expect(ast.arguments[0].operator).toBe('=');
    });
  });

  describe('Type Operators', () => {
    it('should parse is operator', () => {
      const ast = parse('value is String');
      expect(ast.type).toBe(NodeType.MembershipTest);
      expect(ast.expression.name).toBe('value');
      expect(ast.targetType).toBe('String');
    });

    it('should parse as operator', () => {
      const ast = parse('value as String');
      expect(ast.type).toBe(NodeType.TypeCast);
      expect(ast.expression.name).toBe('value');
      expect(ast.targetType).toBe('String');
    });
  });

  describe('Indexing', () => {
    it('should parse array indexing', () => {
      const ast = parse('items[0]');
      expect(ast.type).toBe(NodeType.Index);
      expect(ast.expression.name).toBe('items');
      expect(ast.index.value).toBe(0);
    });

    it('should parse indexing with expressions', () => {
      const ast = parse('items[index + 1]');
      expect(ast.type).toBe(NodeType.Index);
      expect(ast.expression.name).toBe('items');
      expect(ast.index.type).toBe(NodeType.Binary);
      expect(ast.index.operator).toBe('+');
    });

    it('should parse chained indexing', () => {
      const ast = parse('matrix[0][1]');
      expect(ast.type).toBe(NodeType.Index);
      expect(ast.expression.type).toBe(NodeType.Index);
      expect(ast.index.value).toBe(1);
    });
  });

  describe('Precedence', () => {
    it('should respect arithmetic precedence', () => {
      const ast = parse('2 + 3 * 4');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('+');
      expect(ast.left.value).toBe(2);
      expect(ast.right.type).toBe(NodeType.Binary);
      expect(ast.right.operator).toBe('*');
      expect(ast.right.left.value).toBe(3);
      expect(ast.right.right.value).toBe(4);
    });

    it('should respect comparison vs logical precedence', () => {
      const ast = parse('a < b and c > d');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('and');
      expect(ast.left.operator).toBe('<');
      expect(ast.right.operator).toBe('>');
    });

    it('should respect parentheses', () => {
      const ast = parse('(2 + 3) * 4');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('*');
      expect(ast.left.type).toBe(NodeType.Binary);
      expect(ast.left.operator).toBe('+');
    });

    it('should handle right associativity of implies', () => {
      const ast = parse('a implies b implies c');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('implies');
      expect(ast.left.name).toBe('a');
      expect(ast.right.type).toBe(NodeType.Binary);
      expect(ast.right.operator).toBe('implies');
    });

    it('should give dot highest precedence', () => {
      const ast = parse('a.b + c.d');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('+');
      expect(ast.left.type).toBe(NodeType.Binary);
      expect(ast.left.operator).toBe('.');
      expect(ast.right.type).toBe(NodeType.Binary);
      expect(ast.right.operator).toBe('.');
    });
  });

  describe('Complex Expressions', () => {
    it('should parse navigation with filtering', () => {
      const ast = parse('Patient.name.where(use = "official").given');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      const whereCall = ast.left.right;
      expect(whereCall.type).toBe(NodeType.Function);
      expect(whereCall.name.name).toBe('where');
    });

    it('should parse nested function calls', () => {
      const ast = parse('name.substring(0, indexOf(" "))');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      const substring = ast.right;
      expect(substring.type).toBe(NodeType.Function);
      expect(substring.arguments[1].type).toBe(NodeType.Function);
      expect(substring.arguments[1].name.name).toBe('indexOf');
    });

    it('should parse complex boolean expressions', () => {
      const ast = parse('age >= 18 and status = "active" or priority = 1');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('or');
      expect(ast.left.type).toBe(NodeType.Binary);
      expect(ast.left.operator).toBe('and');
    });

    it('should parse union expressions', () => {
      const ast = parse('name | alias | nickname');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('|');
      expect(ast.right.name).toBe('nickname');
      expect(ast.left.type).toBe(NodeType.Binary);
      expect(ast.left.operator).toBe('|');
    });
  });

  describe('Error Handling', () => {
    it('should throw on unexpected tokens', () => {
      expect(() => parse('5 +')).toThrow();
    });

    it('should throw on unclosed parentheses', () => {
      expect(() => parse('(5 + 3')).toThrow();
    });

    it('should throw on unclosed brackets', () => {
      expect(() => parse('items[0')).toThrow();
    });

    it('should throw on invalid characters', () => {
      expect(() => parse('5 # 3')).toThrow();
    });

    it('should throw on trailing tokens', () => {
      expect(() => parse('5 + 3 )')).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should parse deeply nested parentheses', () => {
      const ast = parse('((((5))))');
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(5);
    });

    it('should parse expressions with lots of whitespace', () => {
      const ast = parse('  5   +   3  ');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('+');
    });

    it('should parse single character identifiers', () => {
      const ast = parse('a');
      expect(ast.type).toBe(NodeType.Identifier);
      expect(ast.name).toBe('a');
    });

  });

  describe('Keywords as Identifiers', () => {
    it('should allow keywords as property names', () => {
      const ast = parse('Patient.where');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      expect(ast.right.name).toBe('where');
    });

    it('should allow keywords after dot', () => {
      const ast = parse('obj.and');
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe('.');
      expect(ast.right.name).toBe('and');
    });

    it('should distinguish keyword operators from identifiers', () => {
      const ast1 = parse('a and b');
      expect(ast1.type).toBe(NodeType.Binary);
      expect(ast1.operator).toBe('and');

      const ast2 = parse('and');
      expect(ast2.type).toBe(NodeType.Identifier);
      expect(ast2.name).toBe('and');
    });
  });
});