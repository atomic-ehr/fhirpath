import { describe, it, expect } from 'bun:test';
import { Registry, defaultRegistry } from '../src/registry';
import { TokenType } from '../src/lexer';

describe('Registry', () => {
  describe('Binary Operators', () => {
    it('should register and retrieve binary operators', () => {
      const registry = new Registry();
      
      const divOperator = {
        symbol: '/',
        name: 'divide',
        tokenType: TokenType.DIVIDE,
        category: ['arithmetic'],
        precedence: 80,
        associativity: 'left' as const,
        description: 'Division operator',
        examples: ['10 / 2'],
        signatures: [{
          name: 'numeric-divide',
          left: { type: 'Decimal' as const, singleton: true },
          right: { type: 'Decimal' as const, singleton: true },
          result: { type: 'Decimal' as const, singleton: true },
        }]
      };
      
      registry.registerBinaryOperator(divOperator);
      
      const retrieved = registry.getBinaryOperator(TokenType.DIVIDE);
      expect(retrieved).toBeDefined();
      expect(retrieved?.symbol).toBe('/');
      expect(retrieved?.precedence).toBe(80);
      expect(retrieved?.associativity).toBe('left');
    });

    it('should retrieve operators by symbol', () => {
      const registry = new Registry();
      
      const modOperator = {
        symbol: 'mod',
        name: 'modulo',
        tokenType: TokenType.MOD,
        category: ['arithmetic'],
        precedence: 80,
        associativity: 'left' as const,
        description: 'Modulo operator',
        examples: ['10 mod 3'],
        signatures: [{
          name: 'modulo',
          left: { type: 'Integer' as const, singleton: true },
          right: { type: 'Integer' as const, singleton: true },
          result: { type: 'Integer' as const, singleton: true },
        }]
      };
      
      registry.registerBinaryOperator(modOperator);
      
      const retrieved = registry.getBinaryOperatorBySymbol('mod');
      expect(retrieved).toBeDefined();
      expect(retrieved?.tokenType).toBe(TokenType.MOD);
    });

    it('should check if token is binary operator', () => {
      const registry = new Registry();
      
      const andOperator = {
        symbol: 'and',
        name: 'and',
        tokenType: TokenType.AND,
        category: ['logical'],
        precedence: 30,
        associativity: 'left' as const,
        description: 'Logical AND',
        examples: ['true and false'],
        signatures: [{
          name: 'logical-and',
          left: { type: 'Boolean' as const, singleton: true },
          right: { type: 'Boolean' as const, singleton: true },
          result: { type: 'Boolean' as const, singleton: true },
        }]
      };
      
      registry.registerBinaryOperator(andOperator);
      
      expect(registry.isBinaryOperator(TokenType.AND)).toBe(true);
      expect(registry.isBinaryOperator(TokenType.IDENTIFIER)).toBe(false);
    });
  });

  describe('Unary Operators', () => {
    it('should register and retrieve unary operators', () => {
      const registry = new Registry();
      
      const notOperator = {
        symbol: 'not',
        name: 'not',
        tokenType: TokenType.IDENTIFIER, // 'not' is parsed as identifier
        category: ['logical'],
        precedence: 90,
        description: 'Logical NOT',
        examples: ['not true'],
        signature: {
          operand: { type: 'Boolean' as const, singleton: true },
          result: { type: 'Boolean' as const, singleton: true },
        }
      };
      
      registry.registerUnaryOperator(notOperator);
      
      const retrieved = registry.getUnaryOperator(TokenType.IDENTIFIER);
      expect(retrieved).toBeDefined();
      expect(retrieved?.symbol).toBe('not');
    });
  });

  describe('Functions', () => {
    it('should register and retrieve functions', () => {
      const registry = new Registry();
      
      const whereFunction = {
        name: 'where',
        category: ['filtering'],
        description: 'Filters a collection',
        examples: ['Patient.name.where(use = "official")'],
        signature: {
          input: { type: 'Any' as const, singleton: false },
          parameters: [{
            name: 'criteria',
            type: { type: 'Boolean' as const, singleton: true }
          }],
          result: { type: 'Any' as const, singleton: false },
        }
      };
      
      registry.registerFunction(whereFunction);
      
      const retrieved = registry.getFunction('where');
      expect(retrieved).toBeDefined();
      expect(retrieved?.category).toContain('filtering');
    });
  });

  describe('Precedence and Associativity', () => {
    it('should return correct precedence', () => {
      expect(defaultRegistry.getPrecedence(TokenType.PLUS)).toBe(70);
      expect(defaultRegistry.getPrecedence(TokenType.EQ)).toBe(40);
      expect(defaultRegistry.getPrecedence(TokenType.IDENTIFIER)).toBe(-1);
    });

    it('should return correct associativity', () => {
      expect(defaultRegistry.getAssociativity(TokenType.PLUS)).toBe('left');
      expect(defaultRegistry.getAssociativity(TokenType.EQ)).toBe('left');
      expect(defaultRegistry.getAssociativity(TokenType.IDENTIFIER)).toBeNull();
    });
  });

  describe('Type System', () => {
    it('should match exact types', () => {
      const registry = new Registry();
      
      const signature = registry.selectBinaryOperatorSignature(
        TokenType.PLUS,
        { type: 'Decimal', singleton: true },
        { type: 'Decimal', singleton: true }
      );
      
      expect(signature).toBeNull(); // Not registered in test registry
      
      // Test with default registry
      const defaultSig = defaultRegistry.selectBinaryOperatorSignature(
        TokenType.PLUS,
        { type: 'Decimal', singleton: true },
        { type: 'Decimal', singleton: true }
      );
      
      expect(defaultSig).toBeDefined();
      expect(defaultSig?.name).toBe('numeric-plus');
    });

    it('should match compatible numeric types', () => {
      const registry = new Registry();
      
      const operator = {
        symbol: '*',
        name: 'multiply',
        tokenType: TokenType.MULTIPLY,
        category: ['arithmetic'],
        precedence: 80,
        associativity: 'left' as const,
        description: 'Multiplication',
        examples: ['2 * 3'],
        signatures: [{
          name: 'multiply',
          left: { type: 'Decimal' as const, singleton: true },
          right: { type: 'Decimal' as const, singleton: true },
          result: { type: 'Decimal' as const, singleton: true },
        }]
      };
      
      registry.registerBinaryOperator(operator);
      
      // Integer should be compatible with Decimal
      const signature = registry.selectBinaryOperatorSignature(
        TokenType.MULTIPLY,
        { type: 'Integer', singleton: true },
        { type: 'Integer', singleton: true }
      );
      
      expect(signature).toBeDefined();
      expect(signature?.name).toBe('multiply');
    });

    it('should match Any type', () => {
      const signature = defaultRegistry.selectBinaryOperatorSignature(
        TokenType.EQ,
        { type: 'String', singleton: true },
        { type: 'Integer', singleton: true }
      );
      
      expect(signature).toBeDefined();
      expect(signature?.name).toBe('equal');
    });

    it('should respect singleton constraints', () => {
      const registry = new Registry();
      
      const operator = {
        symbol: 'contains',
        name: 'contains',
        tokenType: TokenType.CONTAINS,
        category: ['collection'],
        precedence: 35,
        associativity: 'left' as const,
        description: 'Contains operator',
        examples: ['collection contains item'],
        signatures: [{
          name: 'contains',
          left: { type: 'Any' as const, singleton: false }, // collection
          right: { type: 'Any' as const, singleton: true }, // single item
          result: { type: 'Boolean' as const, singleton: true },
        }]
      };
      
      registry.registerBinaryOperator(operator);
      
      // Should not match - left side requires collection
      const signature1 = registry.selectBinaryOperatorSignature(
        TokenType.CONTAINS,
        { type: 'String', singleton: true }, // single value, not collection
        { type: 'String', singleton: true }
      );
      
      expect(signature1).toBeNull();
      
      // Should match
      const signature2 = registry.selectBinaryOperatorSignature(
        TokenType.CONTAINS,
        { type: 'String', singleton: false }, // collection
        { type: 'String', singleton: true }
      );
      
      expect(signature2).toBeDefined();
    });
  });

  describe('Default Registry', () => {
    it('should have basic operators registered', () => {
      expect(defaultRegistry.getBinaryOperator(TokenType.PLUS)).toBeDefined();
      expect(defaultRegistry.getBinaryOperator(TokenType.EQ)).toBeDefined();
      expect(defaultRegistry.getUnaryOperator(TokenType.MINUS)).toBeDefined();
    });

    it('should have basic functions registered', () => {
      expect(defaultRegistry.getFunction('substring')).toBeDefined();
    });
  });
});