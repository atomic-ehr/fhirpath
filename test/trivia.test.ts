import { describe, it, expect } from 'bun:test';
import { Lexer, TokenType, Channel } from '../src/lexer';
import type { Token } from '../src/lexer';

describe('Lexer Trivia Support', () => {
  function getToken(tokens: Token[], index: number): Token {
    const token = tokens[index];
    if (!token) {
      throw new Error(`Token at index ${index} is undefined`);
    }
    return token;
  }
  describe('without preserveTrivia', () => {
    it('should skip whitespace and comments', () => {
      const lexer = new Lexer('5 + 3 // comment', { preserveTrivia: false });
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(4); // 5, +, 3, EOF
      expect(getToken(tokens, 0).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 0).value).toBe('5');
      expect(getToken(tokens, 1).type).toBe(TokenType.OPERATOR);
      expect(getToken(tokens, 1).value).toBe('+');
      expect(getToken(tokens, 2).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 2).value).toBe('3');
      expect(getToken(tokens, 3).type).toBe(TokenType.EOF);
    });
  });

  describe('with preserveTrivia', () => {
    it('should preserve whitespace tokens', () => {
      const lexer = new Lexer('5 + 3', { preserveTrivia: true });
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(6); // 5, space, +, space, 3, EOF
      expect(getToken(tokens, 0).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 0).value).toBe('5');
      expect(getToken(tokens, 1).type).toBe(TokenType.WHITESPACE);
      expect(getToken(tokens, 1).value).toBe(' ');
      expect(getToken(tokens, 1).channel).toBe(Channel.HIDDEN);
      expect(getToken(tokens, 2).type).toBe(TokenType.OPERATOR);
      expect(getToken(tokens, 2).value).toBe('+');
      expect(getToken(tokens, 3).type).toBe(TokenType.WHITESPACE);
      expect(getToken(tokens, 3).value).toBe(' ');
      expect(getToken(tokens, 3).channel).toBe(Channel.HIDDEN);
      expect(getToken(tokens, 4).type).toBe(TokenType.NUMBER);
      expect(getToken(tokens, 4).value).toBe('3');
      expect(getToken(tokens, 5).type).toBe(TokenType.EOF);
    });

    it('should preserve line comments', () => {
      const lexer = new Lexer('5 + 3 // comment\n', { preserveTrivia: true });
      const tokens = lexer.tokenize();
      
      expect(tokens).toHaveLength(9); // 5, space, +, space, 3, space, comment, newline, EOF
      const commentToken = tokens.find(t => t.type === TokenType.LINE_COMMENT);
      expect(commentToken).toBeDefined();
      expect(commentToken!.value).toBe('// comment');
      expect(commentToken!.channel).toBe(Channel.HIDDEN);
    });

    it('should preserve block comments', () => {
      const lexer = new Lexer('5 /* multiply by */ * 3', { preserveTrivia: true });
      const tokens = lexer.tokenize();
      
      const commentToken = tokens.find(t => t.type === TokenType.BLOCK_COMMENT);
      expect(commentToken).toBeDefined();
      expect(commentToken!.value).toBe('/* multiply by */');
      expect(commentToken!.channel).toBe(Channel.HIDDEN);
    });

    it('should preserve multiple whitespace characters', () => {
      const lexer = new Lexer('Patient  .  name', { preserveTrivia: true });
      const tokens = lexer.tokenize();
      
      const whitespaceTokens = tokens.filter(t => t.type === TokenType.WHITESPACE);
      expect(whitespaceTokens).toHaveLength(2);
      expect(getToken(whitespaceTokens, 0).value).toBe('  '); // 2 spaces
      expect(getToken(whitespaceTokens, 1).value).toBe('  '); // 2 spaces
    });

    it('should preserve newlines in whitespace', () => {
      const lexer = new Lexer('5 +\n  3', { preserveTrivia: true });
      const tokens = lexer.tokenize();
      
      const whitespaceTokens = tokens.filter(t => t.type === TokenType.WHITESPACE);
      expect(whitespaceTokens).toHaveLength(2);
      expect(getToken(whitespaceTokens, 0).value).toBe(' ');
      expect(getToken(whitespaceTokens, 1).value).toBe('\n  ');
    });

    it('should handle mixed trivia correctly', () => {
      const input = `Patient
        // Get the name
        .name /* property access */
        .given`;
      
      const lexer = new Lexer(input, { preserveTrivia: true });
      const tokens = lexer.tokenize();
      
      // Check we have all token types
      const types = tokens.map(t => t.type);
      expect(types).toContain(TokenType.IDENTIFIER);
      expect(types).toContain(TokenType.WHITESPACE);
      expect(types).toContain(TokenType.LINE_COMMENT);
      expect(types).toContain(TokenType.BLOCK_COMMENT);
      expect(types).toContain(TokenType.DOT);
      
      // All trivia should be on hidden channel
      tokens.forEach(token => {
        if (token.type === TokenType.WHITESPACE || 
            token.type === TokenType.LINE_COMMENT || 
            token.type === TokenType.BLOCK_COMMENT) {
          expect(token.channel).toBe(Channel.HIDDEN);
        }
      });
    });
  });
  
  describe('Parser with trivia', () => {
    it('should parse correctly with trivia tokens', () => {
      // The parser should skip trivia tokens automatically
      const { Parser } = require('../src/parser');
      const parser = new Parser('5 + 3 // comment', { preserveTrivia: true });
      const ast = parser.parse();
      
      expect(ast.type).toBe('Binary'); // Binary
      expect(ast.operator).toBe('+');
      expect(ast.left.value).toBe(5);
      expect(ast.right.value).toBe(3);
    });
  });
});