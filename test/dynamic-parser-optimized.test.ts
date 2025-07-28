import { describe, it, expect } from 'bun:test';
import { DynamicRegistryOptimized } from '../src/dynamic-registry-optimized';
import { DynamicParserOptimized } from '../src/dynamic-parser-optimized';
import { NodeType, printAST } from '../src/dynamic-parser';
import type { BinaryOpNode, LiteralNode } from '../src/dynamic-parser';

describe('Dynamic Parser Optimized', () => {
  const createRegistry = () => {
    const registry = new DynamicRegistryOptimized();
    
    // Register standard operators
    const operators = [
      { symbol: '+', name: 'plus', precedence: 70 },
      { symbol: '-', name: 'minus', precedence: 70 },
      { symbol: '*', name: 'multiply', precedence: 80 },
      { symbol: '/', name: 'divide', precedence: 80 },
      { symbol: '**', name: 'power', precedence: 90, associativity: 'right' as const },
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
        associativity: op.associativity || 'left',
        description: `${op.name} operator`,
        examples: [],
        signatures: []
      });
    });
    
    return registry;
  };
  
  it('should parse with bit-encoded precedence', () => {
    const registry = createRegistry();
    const parser = new DynamicParserOptimized('2 + 3 * 4', registry);
    const ast = parser.parse();
    
    // Should parse as 2 + (3 * 4)
    expect(ast.type).toBe(NodeType.BinaryOp);
    const plus = ast as BinaryOpNode;
    expect(plus.operatorSymbol).toBe('+');
    
    const mult = plus.right as BinaryOpNode;
    expect(mult.operatorSymbol).toBe('*');
    expect((mult.left as LiteralNode).value).toBe(3);
    expect((mult.right as LiteralNode).value).toBe(4);
  });
  
  it('should handle right associativity', () => {
    const registry = createRegistry();
    const parser = new DynamicParserOptimized('2 ** 3 ** 2', registry);
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
  
  it('should handle complex expressions', () => {
    const registry = createRegistry();
    const parser = new DynamicParserOptimized('a > 5 and b < 10 or c = 0', registry);
    const ast = parser.parse();
    
    // Should parse as ((a > 5) and (b < 10)) or (c = 0)
    const printed = printAST(ast);
    expect(printed).toContain('BinaryOp(or)');
    expect(printed).toContain('BinaryOp(and)');
    expect(printed).toContain('BinaryOp(>)');
    expect(printed).toContain('BinaryOp(<)');
    expect(printed).toContain('BinaryOp(=)');
  });
  
  it('should verify precedence extraction is working', () => {
    const registry = createRegistry();
    
    // Get token types for our operators
    const plusToken = registry.getOperatorBySymbol('+')!.tokenType;
    const multToken = registry.getOperatorBySymbol('*')!.tokenType;
    const andToken = registry.getOperatorBySymbol('and')!.tokenType;
    
    // Verify precedence is correctly encoded
    const plusPrec = (plusToken >>> 24) & 0xFF;
    const multPrec = (multToken >>> 24) & 0xFF;
    const andPrec = (andToken >>> 24) & 0xFF;
    
    expect(plusPrec).toBe(70);
    expect(multPrec).toBe(80);
    expect(andPrec).toBe(30);
    
    // Verify parser would make correct decisions
    expect(multPrec).toBeGreaterThan(plusPrec); // * binds tighter than +
    expect(plusPrec).toBeGreaterThan(andPrec); // + binds tighter than and
  });
});