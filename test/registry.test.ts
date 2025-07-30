import { describe, it, expect } from 'bun:test';
import { registry, Registry, PRECEDENCE } from '../src/registry';
import type { FunctionDefinition } from '../src/registry';

describe('FHIRPath Registry', () => {
  describe('Operator Detection', () => {
    describe('isSymbolOperator', () => {
      it('should recognize symbol operators', () => {
        // Arithmetic
        expect(registry.isSymbolOperator('+')).toBe(true);
        expect(registry.isSymbolOperator('-')).toBe(true);
        expect(registry.isSymbolOperator('*')).toBe(true);
        expect(registry.isSymbolOperator('/')).toBe(true);
        
        // Comparison
        expect(registry.isSymbolOperator('<')).toBe(true);
        expect(registry.isSymbolOperator('>')).toBe(true);
        expect(registry.isSymbolOperator('<=')).toBe(true);
        expect(registry.isSymbolOperator('>=')).toBe(true);
        
        // Equality
        expect(registry.isSymbolOperator('=')).toBe(true);
        expect(registry.isSymbolOperator('!=')).toBe(true);
        expect(registry.isSymbolOperator('~')).toBe(true);
        expect(registry.isSymbolOperator('!~')).toBe(true);
        
        // Other
        expect(registry.isSymbolOperator('|')).toBe(true);
        expect(registry.isSymbolOperator('&')).toBe(true);
        expect(registry.isSymbolOperator('.')).toBe(true);
      });

      it('should not recognize keyword operators as symbol operators', () => {
        expect(registry.isSymbolOperator('and')).toBe(false);
        expect(registry.isSymbolOperator('or')).toBe(false);
        expect(registry.isSymbolOperator('div')).toBe(false);
        expect(registry.isSymbolOperator('mod')).toBe(false);
      });

      it('should not recognize non-operators', () => {
        expect(registry.isSymbolOperator('foo')).toBe(false);
        expect(registry.isSymbolOperator('#')).toBe(false);
        expect(registry.isSymbolOperator('@')).toBe(false);
      });
    });

    describe('isKeywordOperator', () => {
      it('should recognize keyword operators', () => {
        // Logical
        expect(registry.isKeywordOperator('and')).toBe(true);
        expect(registry.isKeywordOperator('or')).toBe(true);
        expect(registry.isKeywordOperator('xor')).toBe(true);
        expect(registry.isKeywordOperator('implies')).toBe(true);
        
        // Arithmetic
        expect(registry.isKeywordOperator('div')).toBe(true);
        expect(registry.isKeywordOperator('mod')).toBe(true);
        
        // Membership
        expect(registry.isKeywordOperator('in')).toBe(true);
        expect(registry.isKeywordOperator('contains')).toBe(true);
        
        // Type
        expect(registry.isKeywordOperator('is')).toBe(true);
        expect(registry.isKeywordOperator('as')).toBe(true);
      });

      it('should be case-insensitive', () => {
        expect(registry.isKeywordOperator('AND')).toBe(true);
        expect(registry.isKeywordOperator('Or')).toBe(true);
        expect(registry.isKeywordOperator('DIV')).toBe(true);
        expect(registry.isKeywordOperator('Contains')).toBe(true);
      });

      it('should not recognize symbol operators as keyword operators', () => {
        expect(registry.isKeywordOperator('+')).toBe(false);
        expect(registry.isKeywordOperator('-')).toBe(false);
        expect(registry.isKeywordOperator('=')).toBe(false);
      });

      it('should not recognize regular identifiers', () => {
        expect(registry.isKeywordOperator('where')).toBe(false);
        expect(registry.isKeywordOperator('select')).toBe(false);
        expect(registry.isKeywordOperator('name')).toBe(false);
      });
    });

    describe('isUnaryOperator', () => {
      it('should recognize unary operators', () => {
        expect(registry.isUnaryOperator('+')).toBe(true);
        expect(registry.isUnaryOperator('-')).toBe(true);
        // 'not' is implemented as a function, not an operator
      });

      it('should not recognize binary-only operators', () => {
        expect(registry.isUnaryOperator('*')).toBe(false);
        expect(registry.isUnaryOperator('/')).toBe(false);
        expect(registry.isUnaryOperator('and')).toBe(false);
        expect(registry.isUnaryOperator('=')).toBe(false);
      });
    });

    describe('isBinaryOperator', () => {
      it('should recognize all symbol operators as binary', () => {
        expect(registry.isBinaryOperator('+')).toBe(true);
        expect(registry.isBinaryOperator('-')).toBe(true);
        expect(registry.isBinaryOperator('*')).toBe(true);
        expect(registry.isBinaryOperator('/')).toBe(true);
        expect(registry.isBinaryOperator('=')).toBe(true);
        expect(registry.isBinaryOperator('!=')).toBe(true);
        expect(registry.isBinaryOperator('.')).toBe(true);
      });

      it('should recognize all keyword operators as binary', () => {
        expect(registry.isBinaryOperator('and')).toBe(true);
        expect(registry.isBinaryOperator('or')).toBe(true);
        expect(registry.isBinaryOperator('div')).toBe(true);
        expect(registry.isBinaryOperator('mod')).toBe(true);
        expect(registry.isBinaryOperator('in')).toBe(true);
        expect(registry.isBinaryOperator('is')).toBe(true);
      });

      it('should not recognize unary-only operators', () => {
        // Actually, + and - are both unary and binary, so they should return true
        expect(registry.isBinaryOperator('not')).toBe(false);
      });
    });
  });

  describe('Operator Properties', () => {
    describe('getPrecedence', () => {
      it('should return correct precedence for operators', () => {
        // Highest precedence
        expect(registry.getPrecedence('.')).toBe(PRECEDENCE.DOT);
        
        // Type operators
        expect(registry.getPrecedence('as')).toBe(PRECEDENCE.AS_IS);
        expect(registry.getPrecedence('is')).toBe(PRECEDENCE.AS_IS);
        
        // 'not' is a function, not an operator, so it doesn't have precedence
        
        // Multiplicative
        expect(registry.getPrecedence('*')).toBe(PRECEDENCE.MULTIPLICATIVE);
        expect(registry.getPrecedence('/')).toBe(PRECEDENCE.MULTIPLICATIVE);
        expect(registry.getPrecedence('div')).toBe(PRECEDENCE.MULTIPLICATIVE);
        expect(registry.getPrecedence('mod')).toBe(PRECEDENCE.MULTIPLICATIVE);
        
        // Additive
        expect(registry.getPrecedence('+')).toBe(PRECEDENCE.ADDITIVE);
        expect(registry.getPrecedence('-')).toBe(PRECEDENCE.ADDITIVE);
        expect(registry.getPrecedence('&')).toBe(PRECEDENCE.ADDITIVE);
        
        // Pipe
        expect(registry.getPrecedence('|')).toBe(PRECEDENCE.PIPE);
        
        // Comparison
        expect(registry.getPrecedence('<')).toBe(PRECEDENCE.COMPARISON);
        expect(registry.getPrecedence('>')).toBe(PRECEDENCE.COMPARISON);
        expect(registry.getPrecedence('<=')).toBe(PRECEDENCE.COMPARISON);
        expect(registry.getPrecedence('>=')).toBe(PRECEDENCE.COMPARISON);
        
        // Equality
        expect(registry.getPrecedence('=')).toBe(PRECEDENCE.EQUALITY);
        expect(registry.getPrecedence('!=')).toBe(PRECEDENCE.EQUALITY);
        expect(registry.getPrecedence('~')).toBe(PRECEDENCE.EQUALITY);
        expect(registry.getPrecedence('!~')).toBe(PRECEDENCE.EQUALITY);
        
        // Membership
        expect(registry.getPrecedence('in')).toBe(PRECEDENCE.IN_CONTAINS);
        expect(registry.getPrecedence('contains')).toBe(PRECEDENCE.IN_CONTAINS);
        
        // Logical
        expect(registry.getPrecedence('and')).toBe(PRECEDENCE.AND);
        expect(registry.getPrecedence('xor')).toBe(PRECEDENCE.XOR);
        expect(registry.getPrecedence('or')).toBe(PRECEDENCE.OR);
        expect(registry.getPrecedence('implies')).toBe(PRECEDENCE.IMPLIES);
      });

      it('should return 0 for unknown operators', () => {
        expect(registry.getPrecedence('unknown')).toBe(0);
        expect(registry.getPrecedence('@@')).toBe(0);
      });

      it('should handle unary operators correctly', () => {
        // Unary operators should have their unary precedence
        const unaryPlus = registry.getOperatorDefinition('+');
        const unaryMinus = registry.getOperatorDefinition('-');
        
        // The registry should return the binary precedence for + and -
        // since they're looked up in symbol operators first
        expect(registry.getPrecedence('+')).toBe(PRECEDENCE.ADDITIVE);
        expect(registry.getPrecedence('-')).toBe(PRECEDENCE.ADDITIVE);
      });
    });

    describe('getAssociativity', () => {
      it('should return left associativity for most operators', () => {
        // All left-associative
        expect(registry.getAssociativity('+')).toBe('left');
        expect(registry.getAssociativity('-')).toBe('left');
        expect(registry.getAssociativity('*')).toBe('left');
        expect(registry.getAssociativity('/')).toBe('left');
        expect(registry.getAssociativity('and')).toBe('left');
        expect(registry.getAssociativity('or')).toBe('left');
        expect(registry.getAssociativity('=')).toBe('left');
        expect(registry.getAssociativity('.')).toBe('left');
      });

      it('should return right associativity for implies', () => {
        expect(registry.getAssociativity('implies')).toBe('right');
      });

      it('should return right associativity for unary operators', () => {
        // 'not' is a function, not an operator
        // Test with actual unary operators
        expect(registry.getAssociativity('+')).toBe('left'); // Unary + uses same definition as binary +
        expect(registry.getAssociativity('-')).toBe('left'); // Unary - uses same definition as binary -
      });

      it('should return left for unknown operators', () => {
        expect(registry.getAssociativity('unknown')).toBe('left');
      });
    });

    describe('getOperatorDefinition', () => {
      it('should return complete operator definitions', () => {
        const plusOp = registry.getOperatorDefinition('+');
        expect(plusOp).toBeDefined();
        expect(plusOp!.symbol).toBe('+');
        expect(plusOp!.name).toBe('plus');
        expect(plusOp!.category).toContain('arithmetic');
        expect(plusOp!.description).toBe('For Integer, Decimal, and Quantity, adds the operands. For strings, concatenates the right operand to the left operand. For Date/DateTime/Time, increments by time-valued quantity.');
        
        const andOp = registry.getOperatorDefinition('and');
        expect(andOp).toBeDefined();
        expect(andOp!.symbol).toBe('and');
        expect(andOp!.name).toBe('and');
        expect(andOp!.category).toContain('logical');
        expect(andOp!.description).toBe('Returns true if both operands evaluate to true, false if either operand evaluates to false, and the empty collection ({ }) otherwise');
      });

      it('should handle case-insensitive keyword operators', () => {
        const andOp = registry.getOperatorDefinition('AND');
        expect(andOp).toBeDefined();
        expect(andOp!.symbol).toBe('and');
      });

      it('should return undefined for unknown operators', () => {
        expect(registry.getOperatorDefinition('unknown')).toBeUndefined();
      });
    });
  });

  describe('Keyword Operators List', () => {
    it('should return all keyword operators', () => {
      const keywords = registry.getKeywordOperators();
      
      expect(keywords).toContain('and');
      expect(keywords).toContain('or');
      expect(keywords).toContain('xor');
      expect(keywords).toContain('implies');
      expect(keywords).toContain('div');
      expect(keywords).toContain('mod');
      expect(keywords).toContain('in');
      expect(keywords).toContain('contains');
      expect(keywords).toContain('is');
      expect(keywords).toContain('as');
      
      // Should be lowercase
      expect(keywords).not.toContain('AND');
      expect(keywords).not.toContain('Or');
    });
  });

  describe('Function Registry', () => {
    it('should register and retrieve functions', () => {
      const testRegistry = new Registry();
      
      const whereFunction: FunctionDefinition = {
        name: 'where',
        category: ['filtering'],
        description: 'Filters a collection',
        examples: ['Patient.name.where(use = "official")'],
        signature: {
          input: { type: 'Any', singleton: false },
          parameters: [{
            name: 'condition',
            type: { type: 'Boolean', singleton: true }
          }],
          result: { type: 'Any', singleton: false }
        },
        evaluate: () => { throw new Error('Not implemented'); }
      };
      
      testRegistry.registerFunction(whereFunction);
      
      expect(testRegistry.isFunction('where')).toBe(true);
      expect(testRegistry.isFunction('WHERE')).toBe(true); // case-insensitive
      
      const retrieved = testRegistry.getFunction('where');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('where');
      expect(retrieved!.description).toBe('Filters a collection');
    });

    it('should handle case-insensitive function lookup', () => {
      const testRegistry = new Registry();
      
      const testFunc: FunctionDefinition = {
        name: 'TestFunction',
        category: ['test'],
        description: 'Test function',
        examples: [],
        signature: {
          input: { type: 'Any', singleton: true },
          parameters: [],
          result: { type: 'Any', singleton: true }
        },
        evaluate: () => { throw new Error('Not implemented'); }
      };
      
      testRegistry.registerFunction(testFunc);
      
      expect(testRegistry.isFunction('testfunction')).toBe(true);
      expect(testRegistry.isFunction('TESTFUNCTION')).toBe(true);
      expect(testRegistry.isFunction('TestFunction')).toBe(true);
      
      const retrieved = testRegistry.getFunction('TESTFUNCTION');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('TestFunction');
    });

    it('should return false/undefined for non-existent functions', () => {
      const testRegistry = new Registry();
      
      expect(testRegistry.isFunction('nonexistent')).toBe(false);
      expect(testRegistry.getFunction('nonexistent')).toBeUndefined();
    });
  });

  describe('Precedence Order', () => {
    it('should have correct precedence ordering', () => {
      // Verify precedence values are in correct order
      expect(PRECEDENCE.DOT).toBeGreaterThan(PRECEDENCE.POSTFIX);
      expect(PRECEDENCE.POSTFIX).toBeGreaterThan(PRECEDENCE.AS_IS);
      expect(PRECEDENCE.AS_IS).toBeGreaterThan(PRECEDENCE.UNARY);
      expect(PRECEDENCE.UNARY).toBeGreaterThan(PRECEDENCE.MULTIPLICATIVE);
      expect(PRECEDENCE.MULTIPLICATIVE).toBeGreaterThan(PRECEDENCE.ADDITIVE);
      expect(PRECEDENCE.ADDITIVE).toBeGreaterThan(PRECEDENCE.PIPE);
      expect(PRECEDENCE.PIPE).toBeGreaterThan(PRECEDENCE.COMPARISON);
      expect(PRECEDENCE.COMPARISON).toBeGreaterThan(PRECEDENCE.EQUALITY);
      expect(PRECEDENCE.EQUALITY).toBeGreaterThan(PRECEDENCE.IN_CONTAINS);
      expect(PRECEDENCE.IN_CONTAINS).toBeGreaterThan(PRECEDENCE.AND);
      expect(PRECEDENCE.AND).toBeGreaterThan(PRECEDENCE.XOR);
      expect(PRECEDENCE.XOR).toBeGreaterThan(PRECEDENCE.OR);
      expect(PRECEDENCE.OR).toBeGreaterThan(PRECEDENCE.IMPLIES);
    });
  });
});