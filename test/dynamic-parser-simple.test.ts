import { describe, it, expect } from 'bun:test';
import { DynamicRegistry } from '../src/dynamic-registry';
import { DynamicParser, NodeType, printAST } from '../src/dynamic-parser';
import type { BinaryOpNode, LiteralNode, IdentifierNode } from '../src/dynamic-parser';

describe('Dynamic Parser', () => {
  const createRegistry = () => {
    const registry = new DynamicRegistry();
    
    // Register standard operators
    const operators = [
      { symbol: '+', name: 'plus', precedence: 70 },
      { symbol: '-', name: 'minus', precedence: 70 },
      { symbol: '*', name: 'multiply', precedence: 80 },
      { symbol: '/', name: 'divide', precedence: 80 },
      { symbol: '=', name: 'equal', precedence: 40 },
      { symbol: '>', name: 'greater-than', precedence: 50 },
      { symbol: '<', name: 'less-than', precedence: 50 },
      { symbol: 'and', name: 'and', precedence: 30 },
      { symbol: 'or', name: 'or', precedence: 20 },
    ];
    
    operators.forEach(op => {
      registry.registerOperator({
        symbol: op.symbol,
        name: op.name,
        category: ['standard'],
        precedence: op.precedence,
        associativity: 'left',
        description: `${op.name} operator`,
        examples: [],
        signatures: []
      });
    });
    
    return registry;
  };
  
  it('should parse literals', () => {
    const registry = createRegistry();
    const parser = new DynamicParser('42', registry);
    const ast = parser.parse();
    
    expect(ast.type).toBe(NodeType.Literal);
    const literal = ast as LiteralNode;
    expect(literal.valueType).toBe('number');
    expect(literal.value).toBe(42);
  });
  
  it('should parse simple binary operations', () => {
    const registry = createRegistry();
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
    const registry = createRegistry();
    const parser = new DynamicParser('2 + 3 * 4', registry);
    const ast = parser.parse();
    
    // Should parse as 2 + (3 * 4)
    expect(ast.type).toBe(NodeType.BinaryOp);
    const plus = ast as BinaryOpNode;
    expect(plus.operatorSymbol).toBe('+');
    
    expect((plus.left as LiteralNode).value).toBe(2);
    
    const mult = plus.right as BinaryOpNode;
    expect(mult.operatorSymbol).toBe('*');
    expect((mult.left as LiteralNode).value).toBe(3);
    expect((mult.right as LiteralNode).value).toBe(4);
  });
  
  it('should handle custom operators', () => {
    const registry = createRegistry();
    
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
    
    const parser = new DynamicParser('2 ** 3', registry);
    const ast = parser.parse();
    
    const binOp = ast as BinaryOpNode;
    expect(binOp.operatorSymbol).toBe('**');
    expect((binOp.left as LiteralNode).value).toBe(2);
    expect((binOp.right as LiteralNode).value).toBe(3);
  });
  
  it('should parse member access', () => {
    const registry = createRegistry();
    const parser = new DynamicParser('Patient.name', registry);
    const ast = parser.parse();
    
    expect(ast.type).toBe(NodeType.MemberAccess);
  });
  
  it('should parse collections', () => {
    const registry = createRegistry();
    const parser = new DynamicParser('{1, 2, 3}', registry);
    const ast = parser.parse();
    
    expect(ast.type).toBe(NodeType.Collection);
  });
  
  it('should pretty-print AST', () => {
    const registry = createRegistry();
    const parser = new DynamicParser('2 + 3 * 4', registry);
    const ast = parser.parse();
    const printed = printAST(ast);
    console.log(printed);
    
    expect(printed).toContain('BinaryOp(+)');
    expect(printed).toContain('Literal(number: 2)');
    expect(printed).toContain('BinaryOp(*)');
  });
});