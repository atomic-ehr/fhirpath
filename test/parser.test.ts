import { describe, it, expect } from 'bun:test';
import { parseForEvaluation } from '../src/api';
import type { ASTNode, BinaryNode, LiteralNode, IdentifierNode, FunctionNode, UnionNode, IndexNode, CollectionNode, TypeCastNode, MembershipTestNode } from '../src/parser/ast';
import { NodeType } from '../src/parser/ast';
import { TokenType } from '../src/lexer/token';

// Test helpers
const parse = parseForEvaluation;

const expectLiteral = (ast: ASTNode, value: any, type: 'string' | 'number' | 'boolean' | 'datetime' | 'date' | 'time' | 'null') => {
  expect(ast.type).toBe(NodeType.Literal);
  expect((ast as LiteralNode).value).toBe(value);
  expect((ast as LiteralNode).valueType).toBe(type);
};

const expectIdentifier = (ast: ASTNode, name: string, typeOrId = false) => {
  expect(ast.type).toBe(typeOrId ? NodeType.TypeOrIdentifier : NodeType.Identifier);
  expect((ast as IdentifierNode).name).toBe(name);
};

const expectBinary = (ast: ASTNode, op: TokenType) => {
  expect(ast.type).toBe(NodeType.Binary);
  expect((ast as BinaryNode).operator).toBe(op);
  return ast as BinaryNode;
};

const expectFunction = (ast: ASTNode, name: string, argCount?: number) => {
  expect(ast.type).toBe(NodeType.Function);
  const func = ast as FunctionNode;
  expect((func.name as IdentifierNode).name).toBe(name);
  if (argCount !== undefined) {
    expect(func.arguments.length).toBe(argCount);
  }
  return func;
};

const expectVariable = (ast: ASTNode, name: string) => {
  expect(ast.type).toBe(NodeType.Variable);
  expect((ast as any).name).toBe(name);
};

const expectCollection = (ast: ASTNode, size: number) => {
  expect(ast.type).toBe(NodeType.Collection);
  expect((ast as CollectionNode).elements.length).toBe(size);
  return ast as CollectionNode;
};

describe('FHIRPath Parser', () => {
  
  describe('Literals', () => {
    it('number literals', () => {
      expectLiteral(parse('42'), 42, 'number');
      expectLiteral(parse('3.14'), 3.14, 'number');
      expectLiteral(parse('0'), 0, 'number');
    });
    
    it('string literals', () => {
      expectLiteral(parse("'hello'"), 'hello', 'string');
      expectLiteral(parse("'with spaces'"), 'with spaces', 'string');
      expectLiteral(parse("''"), '', 'string');
    });
    
    it('boolean literals', () => {
      expectLiteral(parse('true'), true, 'boolean');
      expectLiteral(parse('false'), false, 'boolean');
    });
    
    it('collections', () => {
      expectCollection(parse('{}'), 0);
      const col = expectCollection(parse('{1, 2, 3}'), 3);
      expectLiteral(col.elements[0]!, 1, 'number');
      expectLiteral(col.elements[1]!, 2, 'number');
      expectLiteral(col.elements[2]!, 3, 'number');
    });
  });
  
  describe('Variables', () => {
    it('special variables', () => {
      expectVariable(parse('$this'), '$this');
      expectVariable(parse('$index'), '$index');
      expectVariable(parse('$total'), '$total');
    });
    
    it('environment variables', () => {
      expectVariable(parse('%context'), 'context');
      expectVariable(parse('%resource'), 'resource');
    });
  });
  
  describe('Identifiers', () => {
    it('lowercase identifiers', () => {
      expectIdentifier(parse('name'), 'name');
      expectIdentifier(parse('patient'), 'patient');
      expectIdentifier(parse('given'), 'given');
    });
    
    it('uppercase identifiers as TypeOrIdentifier', () => {
      expectIdentifier(parse('Patient'), 'Patient', true);
      expectIdentifier(parse('Bundle'), 'Bundle', true);
      expectIdentifier(parse('Observation'), 'Observation', true);
    });
    
    it('type distinction in navigation', () => {
      const ast = expectBinary(parse('Patient.name'), TokenType.DOT);
      expectIdentifier(ast.left, 'Patient', true);
      expectIdentifier(ast.right, 'name');
    });
  });
  
  describe('Unary Operators', () => {
    it('unary plus and minus', () => {
      const plus = parse('+5');
      expect(plus.type).toBe(NodeType.Unary);
      expect((plus as any).operator).toBe(TokenType.PLUS);
      expectLiteral((plus as any).operand, 5, 'number');
      
      const minus = parse('-5');
      expect(minus.type).toBe(NodeType.Unary);
      expect((minus as any).operator).toBe(TokenType.MINUS);
      expectLiteral((minus as any).operand, 5, 'number');
    });
  });
  
  describe('Binary Operators', () => {
    it('arithmetic', () => {
      expectBinary(parse('2 + 3'), TokenType.PLUS);
      expectBinary(parse('5 - 3'), TokenType.MINUS);
      expectBinary(parse('2 * 3'), TokenType.STAR);
      expectBinary(parse('10 / 2'), TokenType.SLASH);
      expectBinary(parse('10 div 3'), TokenType.DIV);
      expectBinary(parse('10 mod 3'), TokenType.MOD);
    });
    
    it('comparison', () => {
      expectBinary(parse('5 > 3'), TokenType.GT);
      expectBinary(parse('5 < 3'), TokenType.LT);
      expectBinary(parse('5 >= 3'), TokenType.GTE);
      expectBinary(parse('5 <= 3'), TokenType.LTE);
      expectBinary(parse('5 = 3'), TokenType.EQ);
      expectBinary(parse('5 != 3'), TokenType.NEQ);
    });
    
    it('logical', () => {
      expectBinary(parse('true and false'), TokenType.AND);
      expectBinary(parse('true or false'), TokenType.OR);
      expectBinary(parse('true xor false'), TokenType.XOR);
      expectBinary(parse('true implies false'), TokenType.IMPLIES);
    });
    
    it('navigation', () => {
      const ast = expectBinary(parse('patient.name'), TokenType.DOT);
      expectIdentifier(ast.left, 'patient');
      expectIdentifier(ast.right, 'name');
    });
  });
  
  describe('Precedence', () => {
    it('respects operator precedence', () => {
      // Multiplication before addition
      const ast1 = expectBinary(parse('2 + 3 * 4'), TokenType.PLUS);
      expectLiteral(ast1.left, 2, 'number');
      const mult = expectBinary(ast1.right, TokenType.STAR);
      expectLiteral(mult.left, 3, 'number');
      expectLiteral(mult.right, 4, 'number');
      
      // Parentheses override
      const ast2 = expectBinary(parse('(2 + 3) * 4'), TokenType.STAR);
      const add = expectBinary(ast2.left, TokenType.PLUS);
      expectLiteral(add.left, 2, 'number');
      expectLiteral(add.right, 3, 'number');
      expectLiteral(ast2.right, 4, 'number');
    });
    
    it('dot has highest precedence', () => {
      const ast = parse('Patient.name.given | Patient.name.family');
      expect(ast.type).toBe(NodeType.Union);
      const union = ast as UnionNode;
      expect(union.operands.length).toBe(2);
      
      // Both operands should be dot chains
      expectBinary(union.operands[0]!, TokenType.DOT);
      expectBinary(union.operands[1]!, TokenType.DOT);
    });
  });
  
  describe('Functions', () => {
    it('no arguments', () => {
      expectFunction(parse('count()'), 'count', 0);
      expectFunction(parse('empty()'), 'empty', 0);
      expectFunction(parse('exists()'), 'exists', 0);
    });
    
    it('with arguments', () => {
      const sub = expectFunction(parse('substring(0, 5)'), 'substring', 2);
      expectLiteral(sub.arguments[0]!, 0, 'number');
      expectLiteral(sub.arguments[1]!, 5, 'number');
    });
    
    it('method syntax', () => {
      const ast = expectBinary(parse('name.substring(0)'), TokenType.DOT);
      expectIdentifier(ast.left, 'name');
      const func = expectFunction(ast.right, 'substring', 1);
      expectLiteral(func.arguments[0]!, 0, 'number');
    });
    
    it('special function handling', () => {
      const ofType = expectFunction(parse('ofType(Patient)'), 'ofType', 1);
      expect(ofType.arguments[0]!.type).toBe(NodeType.TypeReference);
      expect((ofType.arguments[0] as any).typeName).toBe('Patient');
    });
  });
  
  describe('Type Operators', () => {
    it('membership test (is)', () => {
      const ast = parse('value is Patient');
      expect(ast.type).toBe(NodeType.MembershipTest);
      const test = ast as MembershipTestNode;
      expectIdentifier(test.expression, 'value');
      expect(test.targetType).toBe('Patient');
    });
    
    it('type cast (as)', () => {
      const ast = parse('value as Patient');
      expect(ast.type).toBe(NodeType.TypeCast);
      const cast = ast as TypeCastNode;
      expectIdentifier(cast.expression, 'value');
      expect(cast.targetType).toBe('Patient');
    });
  });
  
  describe('Union Operator', () => {
    it('unions multiple values', () => {
      const ast = parse('a | b | c | d');
      expect(ast.type).toBe(NodeType.Union);
      const union = ast as UnionNode;
      expect(union.operands.length).toBe(4);
      union.operands.forEach((op, i) => {
        expectIdentifier(op, String.fromCharCode(97 + i)); // 'a', 'b', 'c', 'd'
      });
    });
  });
  
  describe('Indexing', () => {
    it('array access', () => {
      const ast = parse('items[0]');
      expect(ast.type).toBe(NodeType.Index);
      const idx = ast as IndexNode;
      expectIdentifier(idx.expression, 'items');
      expectLiteral(idx.index, 0, 'number');
    });
    
    it('nested indexing', () => {
      const ast = parse('matrix[0][1]');
      expect(ast.type).toBe(NodeType.Index);
      const outer = ast as IndexNode;
      expectLiteral(outer.index, 1, 'number');
      expect(outer.expression.type).toBe(NodeType.Index);
      const inner = outer.expression as IndexNode;
      expectIdentifier(inner.expression, 'matrix');
      expectLiteral(inner.index, 0, 'number');
    });
  });
  
  describe('Complex Expressions', () => {
    it('navigation with filtering', () => {
      const ast = parse("Patient.name.where(use = 'official').given");
      // Complex structure - just verify it parses correctly
      expect(ast.type).toBe(NodeType.Binary);
      const bin = ast as BinaryNode;
      expect(bin.operator).toBe(TokenType.DOT);
    });
    
    it('nested function calls', () => {
      const ast = expectBinary(parse("name.substring(indexOf('.'), length())"), TokenType.DOT);
      const func = expectFunction(ast.right, 'substring', 2);
      expectFunction(func.arguments[0]!, 'indexOf', 1);
      expectFunction(func.arguments[1]!, 'length', 0);
    });
    
    it('complex navigation chains', () => {
      const ast = parse('Bundle.entry.resource.ofType(Patient).name.given');
      // Just verify it parses without error and has expected root structure
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as BinaryNode).operator).toBe(TokenType.DOT);
    });
  });
  
  describe('Error Handling', () => {
    it('detects syntax errors', () => {
      expect(() => parse('(1 + 2')).toThrow("Expected ')' after expression");
      expect(() => parse('1 +')).toThrow('Expected expression');
      expect(() => parse('value is')).toThrow('Expected type name');
      expect(() => parse('items[')).toThrow('Expected expression');
      expect(() => parse('{1, 2, 3')).toThrow("Expected '}' after collection");
    });
  });
  
  describe('Edge Cases', () => {
    it('deeply nested parentheses', () => {
      expectLiteral(parse('((((((1))))))'), 1, 'number');
    });
    
    it('empty expressions', () => {
      expectCollection(parse('{}'), 0);
    });
    
    it('null is parsed as identifier', () => {
      // Current parser treats 'null' as identifier, not literal
      expectIdentifier(parse('null'), 'null');
    });
  });

    
  describe('Context-Sensitive Keywords', () => {
    it('keywords as identifiers', () => {
      expectIdentifier(parse('contains'), 'contains');
      expectIdentifier(parse('as'), 'as');
      expectIdentifier(parse('div'), 'div');
      expectIdentifier(parse('mod'), 'mod');
    });
    
    it('keywords as operators', () => {
      expectBinary(parse("'hello' contains 'ell'"), TokenType.CONTAINS);
      expect(parse('value as Patient').type).toBe(NodeType.TypeCast);
      expectBinary(parse('10 div 3'), TokenType.DIV);
      expectBinary(parse('10 mod 3'), TokenType.MOD);
    });
    
    it('keywords in navigation', () => {
      const ast = expectBinary(parse('Patient.contains'), TokenType.DOT);
      expectIdentifier(ast.left, 'Patient', true);
      expectIdentifier(ast.right, 'contains');
    });
    
    it('keywords as function names', () => {
      expectFunction(parse('as(uri)'), 'as', 1);
      expectFunction(parse('contains(x)'), 'contains', 1);
    });
  });
});