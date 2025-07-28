import { describe, it, expect } from 'bun:test';
import { DynamicRegistryOptimized } from '../src/dynamic-registry-optimized';
import { TokenType } from '../src/registry-tokens';

describe('Dynamic Registry Optimized', () => {
  describe('Bit-encoded Precedence', () => {
    it('should encode precedence in token values', () => {
      const registry = new DynamicRegistryOptimized();
      
      const plusToken = registry.registerOperator({
        symbol: '+',
        name: 'plus',
        category: ['arithmetic'],
        precedence: 70,
        associativity: 'left',
        description: 'Addition',
        examples: [],
        signatures: []
      });
      
      const multiplyToken = registry.registerOperator({
        symbol: '*',
        name: 'multiply',
        category: ['arithmetic'],
        precedence: 80,
        associativity: 'left',
        description: 'Multiplication',
        examples: [],
        signatures: []
      });
      
      // Decode tokens to verify encoding
      const plusDecoded = registry.decodeToken(plusToken);
      const multiplyDecoded = registry.decodeToken(multiplyToken);
      
      expect(plusDecoded.precedence).toBe(70);
      expect(multiplyDecoded.precedence).toBe(80);
      
      // IDs should be different
      expect(plusDecoded.id).not.toBe(multiplyDecoded.id);
    });
    
    it('should extract precedence efficiently', () => {
      const registry = new DynamicRegistryOptimized();
      
      // Register operators with various precedences
      const operators = [
        { symbol: '||', precedence: 10 },
        { symbol: '&&', precedence: 20 },
        { symbol: '==', precedence: 40 },
        { symbol: '<', precedence: 50 },
        { symbol: '+', precedence: 70 },
        { symbol: '*', precedence: 80 },
        { symbol: '**', precedence: 90 },
        { symbol: '.', precedence: 100 },
      ];
      
      const tokens: Record<string, number> = {};
      operators.forEach(op => {
        tokens[op.symbol] = registry.registerOperator({
          symbol: op.symbol,
          name: op.symbol,
          category: ['test'],
          precedence: op.precedence,
          associativity: 'left',
          description: 'Test operator',
          examples: [],
          signatures: []
        });
      });
      
      // Verify precedence extraction
      operators.forEach(op => {
        expect(registry.getPrecedence(tokens[op.symbol])).toBe(op.precedence);
      });
    });
    
    it('should handle precedence edge cases', () => {
      const registry = new DynamicRegistryOptimized();
      
      // Minimum precedence
      const minToken = registry.registerOperator({
        symbol: 'min',
        name: 'min',
        category: ['test'],
        precedence: 0,
        associativity: 'left',
        description: 'Min precedence',
        examples: [],
        signatures: []
      });
      
      // Maximum precedence
      const maxToken = registry.registerOperator({
        symbol: 'max',
        name: 'max',
        category: ['test'],
        precedence: 255,
        associativity: 'left',
        description: 'Max precedence',
        examples: [],
        signatures: []
      });
      
      expect(registry.getPrecedence(minToken)).toBe(0);
      expect(registry.getPrecedence(maxToken)).toBe(255);
    });
    
    it('should throw on invalid precedence', () => {
      const registry = new DynamicRegistryOptimized();
      
      expect(() => {
        registry.registerOperator({
          symbol: 'bad',
          name: 'bad',
          category: ['test'],
          precedence: 256, // Too high
          associativity: 'left',
          description: 'Invalid',
          examples: [],
          signatures: []
        });
      }).toThrow('Precedence must be between 0 and 255');
    });
  });
  
  describe('Performance', () => {
    it('should check operator status quickly', () => {
      const registry = new DynamicRegistryOptimized();
      
      // Register many operators
      for (let i = 0; i < 100; i++) {
        registry.registerOperator({
          symbol: `op${i}`,
          name: `operator${i}`,
          category: ['test'],
          precedence: i % 100 + 10,
          associativity: 'left',
          description: 'Test',
          examples: [],
          signatures: []
        });
      }
      
      // Get a token
      const token = registry.getOperatorBySymbol('op50')!.tokenType;
      
      // Measure performance of precedence lookup
      const start = performance.now();
      for (let i = 0; i < 1000000; i++) {
        registry.getPrecedence(token);
      }
      const end = performance.now();
      
      console.log(`1M precedence lookups took ${(end - start).toFixed(2)}ms`);
      expect(end - start).toBeLessThan(100); // Should be very fast
      
      // Verify correctness
      expect(registry.getPrecedence(token)).toBe(60); // 50 % 100 + 10
    });
  });
  
  describe('Compatibility', () => {
    it('should work with predefined tokens', () => {
      const registry = new DynamicRegistryOptimized();
      
      // Predefined tokens should return -1 precedence (not operators)
      expect(registry.getPrecedence(TokenType.IDENTIFIER)).toBe(-1);
      expect(registry.getPrecedence(TokenType.NUMBER)).toBe(-1);
      
      // Special tokens with precedence
      expect(registry.getPrecedence(TokenType.DOT)).toBe(100);
      expect(registry.getPrecedence(TokenType.LBRACKET)).toBe(100);
    });
    
    it('should maintain token uniqueness', () => {
      const registry = new DynamicRegistryOptimized();
      
      const tokens = new Set<number>();
      
      // Register many operators
      for (let prec = 10; prec <= 90; prec += 10) {
        for (let i = 0; i < 5; i++) {
          const token = registry.registerOperator({
            symbol: `op_${prec}_${i}`,
            name: `op_${prec}_${i}`,
            category: ['test'],
            precedence: prec,
            associativity: 'left',
            description: 'Test',
            examples: [],
            signatures: []
          });
          
          // Ensure unique token
          expect(tokens.has(token)).toBe(false);
          tokens.add(token);
          
          // Ensure correct precedence
          expect(registry.getPrecedence(token)).toBe(prec);
        }
      }
    });
  });
});