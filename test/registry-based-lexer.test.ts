import { describe, it, expect } from 'bun:test';
import { RegistryBasedLexer } from '../src/registry-based-lexer';
import { Registry, defaultRegistry } from '../src/registry';
import { TokenType } from '../src/lexer';
import type { BinaryOperator } from '../src/registry';

describe('Registry-Based Lexer', () => {
  describe('Operator Tokenization', () => {
    it('should tokenize operators based on registry', () => {
      const lexer = new RegistryBasedLexer('2 + 3 - 4 * 5 / 6');
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.NUMBER); // 2
      expect(tokens[1].type).toBe(TokenType.PLUS);   // +
      expect(tokens[2].type).toBe(TokenType.NUMBER); // 3
      expect(tokens[3].type).toBe(TokenType.MINUS);  // -
      expect(tokens[4].type).toBe(TokenType.NUMBER); // 4
      expect(tokens[5].type).toBe(TokenType.MULTIPLY); // *
      expect(tokens[6].type).toBe(TokenType.NUMBER); // 5
      expect(tokens[7].type).toBe(TokenType.DIVIDE); // /
      expect(tokens[8].type).toBe(TokenType.NUMBER); // 6
      expect(tokens[9].type).toBe(TokenType.EOF);
    });
    
    it('should tokenize keyword operators from registry', () => {
      const lexer = new RegistryBasedLexer('true and false or x');
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.TRUE);
      expect(tokens[1].type).toBe(TokenType.AND); // From registry
      expect(tokens[2].type).toBe(TokenType.FALSE);
      expect(tokens[3].type).toBe(TokenType.OR);  // From registry
      expect(tokens[4].type).toBe(TokenType.IDENTIFIER); // x
    });
  });
  
  describe('Custom Registry', () => {
    it('should work with custom operators', () => {
      const customRegistry = new Registry();
      
      // Add a custom operator
      const customOp: BinaryOperator = {
        symbol: '**',
        name: 'power',
        tokenType: TokenType.MULTIPLY, // Reuse multiply token for demo
        category: ['arithmetic'],
        precedence: 90,
        associativity: 'right',
        description: 'Power operator',
        examples: ['2 ** 3'],
        signatures: [{
          name: 'power',
          left: { type: 'Decimal', singleton: true },
          right: { type: 'Decimal', singleton: true },
          result: { type: 'Decimal', singleton: true },
        }]
      };
      
      customRegistry.registerBinaryOperator(customOp);
      
      // Also add standard operators we need
      customRegistry.registerBinaryOperator(defaultRegistry.getBinaryOperator(TokenType.PLUS)!);
      
      const lexer = new RegistryBasedLexer('2 ** 3 + 1', {}, customRegistry);
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.NUMBER); // 2
      expect(tokens[1].type).toBe(TokenType.MULTIPLY); // ** (mapped to MULTIPLY)
      expect(tokens[2].type).toBe(TokenType.NUMBER); // 3
      expect(tokens[3].type).toBe(TokenType.PLUS);   // +
      expect(tokens[4].type).toBe(TokenType.NUMBER); // 1
      
      // Verify the symbol is '**'
      expect(lexer.getTokenValue(tokens[1])).toBe('**');
    });
  });
  
  describe('Registry Integration Benefits', () => {
    it('should handle operators not in registry as unknown', () => {
      const emptyRegistry = new Registry();
      const lexer = new RegistryBasedLexer('2 + 3', {}, emptyRegistry);
      
      // This should throw because + is not in the empty registry
      expect(() => lexer.tokenize()).toThrow('Unexpected character');
    });
    
    it('should provide consistent tokenization with registry', () => {
      // Two lexers with same registry should produce same tokens
      const lexer1 = new RegistryBasedLexer('a and b');
      const lexer2 = new RegistryBasedLexer('a and b');
      
      const tokens1 = lexer1.tokenize();
      const tokens2 = lexer2.tokenize();
      
      expect(tokens1.length).toBe(tokens2.length);
      for (let i = 0; i < tokens1.length; i++) {
        expect(tokens1[i].type).toBe(tokens2[i].type);
      }
    });
  });
  
  describe('Token Values', () => {
    it('should preserve original text', () => {
      const lexer = new RegistryBasedLexer('foo + "bar" and 123.45');
      const tokens = lexer.tokenize();
      
      expect(lexer.getTokenValue(tokens[0])).toBe('foo');
      expect(lexer.getTokenValue(tokens[1])).toBe('+');
      expect(lexer.getTokenValue(tokens[2])).toBe('"bar"');
      expect(lexer.getTokenValue(tokens[3])).toBe('and');
      expect(lexer.getTokenValue(tokens[4])).toBe('123.45');
    });
  });
});