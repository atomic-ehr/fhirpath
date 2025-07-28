import { describe, it, expect } from 'bun:test';
import { DynamicRegistry } from '../src/dynamic-registry';
import { DynamicParser, NodeType, printAST } from '../src/dynamic-parser';
import type { BinaryOpNode, LiteralNode, IdentifierNode } from '../src/dynamic-parser';

describe('Dynamic Parser', () => {
  const createRegistry = () => {
    const registry = new DynamicRegistry();
    
    // Register standard operators
    registry.registerOperator({
      symbol: '+',
      name: 'plus',
      category: ['arithmetic'],
      precedence: 70,
      associativity: 'left',
      description: 'Addition',
      examples: [],
      signatures: []
    });
    
    registry.registerOperator({
      symbol: '-',
      name: 'minus',
      category: ['arithmetic'],
      precedence: 70,
      associativity: 'left',
      description: 'Subtraction',
      examples: [],
      signatures: []
    });
    
    registry.registerOperator({
      symbol: '*',
      name: 'multiply',
      category: ['arithmetic'],
      precedence: 80,
      associativity: 'left',
      description: 'Multiplication',
      examples: [],
      signatures: []
    });
    
    registry.registerOperator({
      symbol: '/',
      name: 'divide',
      category: ['arithmetic'],
      precedence: 80,
      associativity: 'left',
      description: 'Division',
      examples: [],
      signatures: []
    });
    
    registry.registerOperator({
      symbol: '=',
      name: 'equal',
      category: ['comparison'],
      precedence: 40,
      associativity: 'left',
      description: 'Equality',
      examples: [],
      signatures: []
    });
    
    registry.registerOperator({
      symbol: 'and',
      name: 'and',
      category: ['logical'],
      precedence: 30,
      associativity: 'left',
      description: 'Logical AND',
      examples: [],
      signatures: []
    });
    
    registry.registerOperator({
      symbol: 'or',
      name: 'or',
      category: ['logical'],
      precedence: 20,
      associativity: 'left',
      description: 'Logical OR',
      examples: [],
      signatures: []
    });
    
    return registry;
  };
  
  describe('Basic Parsing', () => {
    it('should parse literals', () => {
      const registry = createRegistry();
      const parser = new DynamicParser('42', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.Literal);
      const literal = ast as LiteralNode;
      expect(literal.valueType).toBe('number');
      expect(literal.value).toBe(42);
    });
    
    it('should parse strings', () => {
      const registry = createRegistry();
      const parser = new DynamicParser('"hello world"', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.Literal);
      const literal = ast as LiteralNode;
      expect(literal.valueType).toBe('string');
      expect(literal.value).toBe('hello world');
    });
    
    it('should parse identifiers', () => {
      const parser = new DynamicParser('Patient', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.Identifier);
      const ident = ast as IdentifierNode;
      expect(ident.name).toBe('Patient');
    });
  });
  
  describe('Binary Operations', () => {
    it('should parse simple binary operations', () => {
      const parser = new DynamicParser('2 + 3', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.BinaryOp);
      const binOp = ast as BinaryOpNode;
      expect(binOp.operatorSymbol).toBe('+');
      
      expect(binOp.left.type).toBe(NodeType.Literal);
      expect((binOp.left as LiteralNode).value).toBe(2);
      
      expect(binOp.right.type).toBe(NodeType.Literal);
      expect((binOp.right as LiteralNode).value).toBe(3);
    });
    
    it('should respect operator precedence', () => {
      const parser = new DynamicParser('2 + 3 * 4', registry);
      const ast = parser.parse();
      
      // Should parse as 2 + (3 * 4)
      expect(ast.type).toBe(NodeType.BinaryOp);
      const plus = ast as BinaryOpNode;
      expect(plus.operatorSymbol).toBe('+');
      
      expect(plus.left.type).toBe(NodeType.Literal);
      expect((plus.left as LiteralNode).value).toBe(2);
      
      expect(plus.right.type).toBe(NodeType.BinaryOp);
      const mult = plus.right as BinaryOpNode;
      expect(mult.operatorSymbol).toBe('*');
      expect((mult.left as LiteralNode).value).toBe(3);
      expect((mult.right as LiteralNode).value).toBe(4);
    });
    
    it('should handle left associativity', () => {
      const parser = new DynamicParser('1 - 2 - 3', registry);
      const ast = parser.parse();
      
      // Should parse as (1 - 2) - 3
      const outer = ast as BinaryOpNode;
      expect(outer.operatorSymbol).toBe('-');
      expect((outer.right as LiteralNode).value).toBe(3);
      
      const inner = outer.left as BinaryOpNode;
      expect(inner.operatorSymbol).toBe('-');
      expect((inner.left as LiteralNode).value).toBe(1);
      expect((inner.right as LiteralNode).value).toBe(2);
    });
  });
  
  describe('Custom Operators', () => {
    it('should parse custom operators', () => {
      // Add a custom operator
      registry.registerOperator({
        symbol: '**',
        name: 'power',
        category: ['arithmetic'],
        precedence: 90,
        associativity: 'right',
        description: 'Power',
        examples: [],
        signatures: []
      });
      
      const parser = new DynamicParser('2 ** 3 ** 2', registry);
      const ast = parser.parse();
      
      // Should parse as 2 ** (3 ** 2) due to right associativity
      const outer = ast as BinaryOpNode;
      expect(outer.operatorSymbol).toBe('**');
      expect((outer.left as LiteralNode).value).toBe(2);
      
      const inner = outer.right as BinaryOpNode;
      expect(inner.operatorSymbol).toBe('**');
      expect((inner.left as LiteralNode).value).toBe(3);
      expect((inner.right as LiteralNode).value).toBe(2);
    });
    
    it('should handle operators added dynamically', () => {
      // Add operator after parser creation
      registry.registerOperator({
        symbol: '??',
        name: 'null-coalesce',
        category: ['null-handling'],
        precedence: 35,
        associativity: 'left',
        description: 'Null coalescing',
        examples: [],
        signatures: []
      });
      
      const parser = new DynamicParser('value ?? "default"', registry);
      const ast = parser.parse();
      
      const binOp = ast as BinaryOpNode;
      expect(binOp.operatorSymbol).toBe('??');
      expect((binOp.left as IdentifierNode).name).toBe('value');
      expect((binOp.right as LiteralNode).value).toBe('default');
    });
  });
  
  describe('Complex Expressions', () => {
    it('should parse member access', () => {
      const parser = new DynamicParser('Patient.name.given', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.MemberAccess);
    });
    
    it('should parse function calls', () => {
      const parser = new DynamicParser('substring(0, 5)', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.FunctionCall);
    });
    
    it('should parse collections', () => {
      const parser = new DynamicParser('{1, 2, 3}', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.Collection);
    });
    
    it('should parse mixed expressions', () => {
      const parser = new DynamicParser('Patient.age > 18 and Patient.active = true', registry);
      const ast = parser.parse();
      
      expect(ast.type).toBe(NodeType.BinaryOp);
      const andOp = ast as BinaryOpNode;
      expect(andOp.operatorSymbol).toBe('and');
    });
  });
  
  describe('AST Printing', () => {
    it('should pretty-print AST', () => {
      const parser = new DynamicParser('2 + 3 * 4', registry);
      const ast = parser.parse();
      const printed = printAST(ast);
      
      expect(printed).toContain('BinaryOp(+)');
      expect(printed).toContain('Literal(number: 2)');
      expect(printed).toContain('BinaryOp(*)');
      expect(printed).toContain('Literal(number: 3)');
      expect(printed).toContain('Literal(number: 4)');
    });
  });
  
  describe('Error Handling', () => {
    it('should throw on unexpected tokens', () => {
      const parser = new DynamicParser('2 + + 3', registry);
      expect(() => parser.parse()).toThrow();
    });
    
    it('should throw on unclosed parentheses', () => {
      const parser = new DynamicParser('(2 + 3', registry);
      expect(() => parser.parse()).toThrow("Expected ')'");
    });
  });
});