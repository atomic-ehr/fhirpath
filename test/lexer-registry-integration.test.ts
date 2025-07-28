import { describe, it, expect } from 'bun:test';
import { Lexer, TokenType } from '../src/lexer';
import { defaultRegistry } from '../src/registry';
import { extractPrecedenceFromToken } from '../src/lexer-registry-bridge';

describe('Lexer-Registry Integration', () => {
  describe('Token Precedence', () => {
    it('should match registry precedence with encoded precedence', () => {
      // Test that registry precedence matches what's encoded in tokens
      const testCases = [
        { token: TokenType.PLUS, expectedPrecedence: 70 },
        { token: TokenType.MULTIPLY, expectedPrecedence: 80 },
        { token: TokenType.EQ, expectedPrecedence: 40 },
        { token: TokenType.AND, expectedPrecedence: 30 },
        { token: TokenType.OR, expectedPrecedence: 20 },
      ];
      
      for (const { token, expectedPrecedence } of testCases) {
        const encodedPrecedence = extractPrecedenceFromToken(token);
        const registryPrecedence = defaultRegistry.getPrecedence(token);
        
        expect(encodedPrecedence).toBe(expectedPrecedence);
        expect(registryPrecedence).toBe(expectedPrecedence);
      }
    });
  });
  
  describe('Operator Recognition', () => {
    it('should tokenize operators that exist in registry', () => {
      const lexer = new Lexer('+ - * / = and or');
      const tokens = lexer.tokenize();
      
      // Remove EOF token
      const operatorTokens = tokens.slice(0, -1);
      
      // All tokens should be recognized as operators in the registry
      for (const token of operatorTokens) {
        const isBinary = defaultRegistry.isBinaryOperator(token.type);
        const isUnary = defaultRegistry.isUnaryOperator(token.type);
        
        expect(isBinary || isUnary).toBe(true);
      }
    });
  });
  
  describe('Function Recognition', () => {
    it('should tokenize function names as identifiers', () => {
      const lexer = new Lexer('substring where Patient.name');
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].type).toBe(TokenType.DOT);
      expect(tokens[4].type).toBe(TokenType.IDENTIFIER);
      
      // The parser would check if these identifiers are functions
      const substring = lexer.getTokenValue(tokens[0]);
      const where = lexer.getTokenValue(tokens[1]);
      
      expect(defaultRegistry.getFunction(substring)).toBeDefined();
      expect(defaultRegistry.getFunction(where)).toBeDefined();
    });
  });
  
  describe('Keyword vs Operator Distinction', () => {
    it('should handle operators that are also keywords', () => {
      const lexer = new Lexer('x and y');
      const tokens = lexer.tokenize();
      
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER); // x
      expect(tokens[1].type).toBe(TokenType.AND); // and
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER); // y
      
      // Registry should recognize 'and' as an operator
      expect(defaultRegistry.isBinaryOperator(TokenType.AND)).toBe(true);
    });
  });
});