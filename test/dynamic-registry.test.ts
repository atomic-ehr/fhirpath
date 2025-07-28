import { describe, it, expect } from 'bun:test';
import { DynamicRegistry } from '../src/dynamic-registry';
import { DynamicLexer } from '../src/dynamic-lexer';
import { TokenType } from '../src/registry-tokens';

describe('Dynamic Registry and Lexer', () => {
  describe('Dynamic Token Allocation', () => {
    it('should allocate token types for new operators', () => {
      const registry = new DynamicRegistry();
      
      // Register standard operators
      const plusToken = registry.registerOperator({
        symbol: '+',
        name: 'plus',
        category: ['arithmetic'],
        precedence: 70,
        associativity: 'left',
        description: 'Addition',
        examples: ['2 + 3'],
        signatures: [{
          name: 'numeric-plus',
          left: { type: 'Decimal', singleton: true },
          right: { type: 'Decimal', singleton: true },
          result: { type: 'Decimal', singleton: true },
        }]
      });
      
      // Register a custom operator
      const powerToken = registry.registerOperator({
        symbol: '**',
        name: 'power',
        category: ['arithmetic'],
        precedence: 90,
        associativity: 'right',
        description: 'Exponentiation',
        examples: ['2 ** 3'],
        signatures: [{
          name: 'power',
          left: { type: 'Decimal', singleton: true },
          right: { type: 'Decimal', singleton: true },
          result: { type: 'Decimal', singleton: true },
        }]
      });
      
      // Token types should be different
      expect(plusToken).not.toBe(powerToken);
      
      // Should be able to look up by token
      const plusOp = registry.getOperator(plusToken);
      expect(plusOp?.symbol).toBe('+');
      expect(plusOp?.precedence).toBe(70);
      
      const powerOp = registry.getOperator(powerToken);
      expect(powerOp?.symbol).toBe('**');
      expect(powerOp?.precedence).toBe(90);
    });
    
    it('should reuse token types for same operator', () => {
      const registry = new DynamicRegistry();
      
      const token1 = registry.registerOperator({
        symbol: '+',
        name: 'plus',
        category: ['arithmetic'],
        precedence: 70,
        associativity: 'left',
        description: 'Addition',
        examples: [],
        signatures: []
      });
      
      const token2 = registry.registerOperator({
        symbol: '+',
        name: 'plus',
        category: ['arithmetic'],
        precedence: 70,
        associativity: 'left',
        description: 'Addition',
        examples: [],
        signatures: []
      });
      
      expect(token1).toBe(token2);
    });
  });
  
  describe('Lexer Integration', () => {
    it('should tokenize using dynamic tokens', () => {
      const registry = new DynamicRegistry();
      
      // Register operators
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
        symbol: '**',
        name: 'power',
        category: ['arithmetic'],
        precedence: 90,
        associativity: 'right',
        description: 'Power',
        examples: [],
        signatures: []
      });
      
      const lexer = new DynamicLexer('2 + 3 ** 4', registry);
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(lexer.getTokenValue(tokens[0])).toBe('2');
      
      // Plus operator gets dynamic token
      const plusToken = tokens[1];
      expect(lexer.getTokenValue(plusToken)).toBe('+');
      expect(registry.getPrecedence(plusToken.type)).toBe(70);
      
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(lexer.getTokenValue(tokens[2])).toBe('3');
      
      // Power operator gets dynamic token
      const powerToken = tokens[3];
      expect(lexer.getTokenValue(powerToken)).toBe('**');
      expect(registry.getPrecedence(powerToken.type)).toBe(90);
      
      expect(tokens[4].type).toBe(TokenType.NUMBER);
      expect(lexer.getTokenValue(tokens[4])).toBe('4');
    });
    
    it('should handle keyword operators', () => {
      const registry = new DynamicRegistry();
      
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
      
      const lexer = new DynamicLexer('true and false', registry);
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.TRUE);
      expect(tokens[2].type).toBe(TokenType.FALSE);
      
      // 'and' gets dynamic token
      const andToken = tokens[1];
      expect(lexer.getTokenValue(andToken)).toBe('and');
      expect(registry.getPrecedence(andToken.type)).toBe(30);
    });
  });
  
  describe('Token Name Generation', () => {
    it('should generate meaningful token names', () => {
      const registry = new DynamicRegistry();
      
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
      
      const powerToken = registry.registerOperator({
        symbol: '**',
        name: 'power',
        category: ['arithmetic'],
        precedence: 90,
        associativity: 'right',
        description: 'Power',
        examples: [],
        signatures: []
      });
      
      expect(registry.getTokenName(plusToken)).toBe('OP_PLUS');
      expect(registry.getTokenName(powerToken)).toBe('OP_POWER');
      expect(registry.getTokenName(TokenType.IDENTIFIER)).toBe('IDENTIFIER');
    });
  });
  
  describe('Export Token Definitions', () => {
    it('should export all token definitions', () => {
      const registry = new DynamicRegistry();
      
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
      
      const tokens = registry.exportTokenDefinitions();
      
      // Should include predefined tokens
      expect(tokens.IDENTIFIER).toBeDefined();
      expect(tokens.NUMBER).toBeDefined();
      expect(tokens.STRING).toBeDefined();
      
      // Should include dynamic tokens
      expect(tokens.OP_PLUS).toBeDefined();
    });
  });
});