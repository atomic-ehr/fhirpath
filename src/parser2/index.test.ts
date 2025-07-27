import { describe, it, expect } from 'bun:test';
import { parse, NodeType } from './index';

describe('Parser2', () => {
  describe('literals', () => {
    it('parses numbers', () => {
      const ast = parse('42');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(42);
      expect((ast as any).valueType).toBe('number');
    });

    it('parses decimal numbers', () => {
      const ast = parse('3.14');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(3.14);
      expect((ast as any).valueType).toBe('number');
    });

    it('parses strings', () => {
      const ast = parse("'hello world'");
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe('hello world');
      expect((ast as any).valueType).toBe('string');
    });

    it('parses booleans', () => {
      let ast = parse('true');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(true);
      expect((ast as any).valueType).toBe('boolean');

      ast = parse('false');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(false);
      expect((ast as any).valueType).toBe('boolean');
    });

    it('parses null', () => {
      const ast = parse('null');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(null);
      expect((ast as any).valueType).toBe('null');
    });

    it('parses datetime', () => {
      const ast = parse('@2023-01-01T12:00:00');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe('2023-01-01T12:00:00');
      expect((ast as any).valueType).toBe('datetime');
    });

    it('parses time', () => {
      const ast = parse('@T12:00:00');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe('T12:00:00');
      expect((ast as any).valueType).toBe('time');
    });
  });

  describe('identifiers', () => {
    it('parses simple identifiers', () => {
      const ast = parse('name');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('name');
    });

    it('parses type identifiers', () => {
      const ast = parse('Patient');
      expect(ast.type).toBe(NodeType.TypeOrIdentifier);
      expect((ast as any).name).toBe('Patient');
    });

    it('parses delimited identifiers', () => {
      const ast = parse('`special-name`');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('special-name');
    });
  });

  describe('variables', () => {
    it('parses $this', () => {
      const ast = parse('$this');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('$this');
    });

    it('parses $index', () => {
      const ast = parse('$index');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('$index');
    });

    it('parses environment variables', () => {
      const ast = parse('%env');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('%env');
    });
  });

  describe('binary operators', () => {
    it('parses arithmetic operators', () => {
      let ast = parse('1 + 2');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.value).toBe(1);
      expect((ast as any).right.value).toBe(2);

      ast = parse('5 - 3');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.value).toBe(5);
      expect((ast as any).right.value).toBe(3);

      ast = parse('2 * 3');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.value).toBe(2);
      expect((ast as any).right.value).toBe(3);

      ast = parse('10 / 2');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.value).toBe(10);
      expect((ast as any).right.value).toBe(2);
    });

    it('respects operator precedence', () => {
      const ast = parse('1 + 2 * 3');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.value).toBe(1);
      expect((ast as any).right.type).toBe(NodeType.Binary);
      expect((ast as any).right.left.value).toBe(2);
      expect((ast as any).right.right.value).toBe(3);
    });

    it('handles parentheses', () => {
      const ast = parse('(1 + 2) * 3');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.type).toBe(NodeType.Binary);
      expect((ast as any).left.left.value).toBe(1);
      expect((ast as any).left.right.value).toBe(2);
      expect((ast as any).right.value).toBe(3);
    });

    it('parses comparison operators', () => {
      const ast = parse('age > 18');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.name).toBe('age');
      expect((ast as any).right.value).toBe(18);
    });

    it('parses logical operators', () => {
      const ast = parse('true and false');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.value).toBe(true);
      expect((ast as any).right.value).toBe(false);
    });
  });

  describe('unary operators', () => {
    it('parses unary plus', () => {
      const ast = parse('+5');
      expect(ast.type).toBe(NodeType.Unary);
      expect((ast as any).operand.value).toBe(5);
    });

    it('parses unary minus', () => {
      const ast = parse('-5');
      expect(ast.type).toBe(NodeType.Unary);
      expect((ast as any).operand.value).toBe(5);
    });
  });

  describe('member access', () => {
    it('parses dot notation', () => {
      const ast = parse('Patient.name');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.name).toBe('Patient');
      expect((ast as any).right.name).toBe('name');
    });

    it('parses chained access', () => {
      const ast = parse('Patient.name.given');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).left.type).toBe(NodeType.Binary);
      expect((ast as any).left.left.name).toBe('Patient');
      expect((ast as any).left.right.name).toBe('name');
      expect((ast as any).right.name).toBe('given');
    });
  });

  describe('function calls', () => {
    it('parses function calls without arguments', () => {
      const ast = parse('empty()');
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('empty');
      expect((ast as any).arguments).toHaveLength(0);
    });

    it('parses function calls with arguments', () => {
      const ast = parse('where(active = true)');
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('where');
      expect((ast as any).arguments).toHaveLength(1);
      expect((ast as any).arguments[0].type).toBe(NodeType.Binary);
    });

    it('parses function calls with multiple arguments', () => {
      const ast = parse('substring(0, 5)');
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('substring');
      expect((ast as any).arguments).toHaveLength(2);
      expect((ast as any).arguments[0].value).toBe(0);
      expect((ast as any).arguments[1].value).toBe(5);
    });
  });

  describe('indexing', () => {
    it('parses indexing', () => {
      const ast = parse('list[0]');
      expect(ast.type).toBe(NodeType.Index);
      expect((ast as any).expression.name).toBe('list');
      expect((ast as any).index.value).toBe(0);
    });

    it('parses chained indexing', () => {
      const ast = parse('matrix[0][1]');
      expect(ast.type).toBe(NodeType.Index);
      expect((ast as any).expression.type).toBe(NodeType.Index);
      expect((ast as any).index.value).toBe(1);
    });
  });

  describe('collections', () => {
    it('parses empty collection', () => {
      const ast = parse('{}');
      expect(ast.type).toBe(NodeType.Collection);
      expect((ast as any).elements).toHaveLength(0);
    });

    it('parses collection with elements', () => {
      const ast = parse('{1, 2, 3}');
      expect(ast.type).toBe(NodeType.Collection);
      expect((ast as any).elements).toHaveLength(3);
      expect((ast as any).elements[0].value).toBe(1);
      expect((ast as any).elements[1].value).toBe(2);
      expect((ast as any).elements[2].value).toBe(3);
    });
  });

  describe('union operator', () => {
    it('parses union operator', () => {
      const ast = parse('a | b');
      expect(ast.type).toBe(NodeType.Union);
      expect((ast as any).operands).toHaveLength(2);
      expect((ast as any).operands[0].name).toBe('a');
      expect((ast as any).operands[1].name).toBe('b');
    });

    it('parses multiple unions', () => {
      const ast = parse('a | b | c');
      expect(ast.type).toBe(NodeType.Union);
      expect((ast as any).operands).toHaveLength(3);
      expect((ast as any).operands[0].name).toBe('a');
      expect((ast as any).operands[1].name).toBe('b');
      expect((ast as any).operands[2].name).toBe('c');
    });
  });

  describe('type operations', () => {
    it('parses is operator', () => {
      const ast = parse('value is String');
      expect(ast.type).toBe(NodeType.MembershipTest);
      expect((ast as any).expression.name).toBe('value');
      expect((ast as any).targetType).toBe('String');
    });

    it('parses as operator', () => {
      const ast = parse('value as String');
      expect(ast.type).toBe(NodeType.TypeCast);
      expect((ast as any).expression.name).toBe('value');
      expect((ast as any).targetType).toBe('String');
    });
  });

  describe('complex expressions', () => {
    it('parses method chaining with function calls', () => {
      const ast = parse('Patient.name.where(use = \'official\').given');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).right.name).toBe('given');
      
      const whereCall = (ast as any).left;
      expect(whereCall.type).toBe(NodeType.Binary);
      expect(whereCall.right.type).toBe(NodeType.Function);
      expect((whereCall.right as any).name.name).toBe('where');
    });

    it('parses complex arithmetic', () => {
      const ast = parse('(age + 5) * 2 - 10');
      expect(ast.type).toBe(NodeType.Binary);
      // Further assertions on the structure...
    });
    it('parses complex arithmetic', async () => {
      const ast = parse('Patient.name.given.where(use = "official").given');
      await Bun.write('./tmp/out.json', JSON.stringify(ast, null, 2));
    });
  });
});