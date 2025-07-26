import { describe, it, expect } from 'bun:test';
import { parseForEvaluation } from '../src/api';
import { NodeType } from '../src/parser/ast';

/**
 * Parser test suite for FHIRPath keywords, literals, and reserved words
 * 
 * This test file documents the current behavior of the parser regarding:
 * 1. Boolean literals (true/false) vs identifiers
 * 2. Reserved keywords that should not be allowed as identifiers (but currently are)
 * 3. Context-sensitive keywords (as, contains, in, is) that can be identifiers or operators
 * 4. Special variables ($this, $index, $total) and environment variables (%)
 * 5. Delimited identifiers using backticks to escape reserved words
 * 
 * Based on the FHIRPath grammar in spec/fhirpath.g4
 */
describe('FHIRPath Parser - Keywords and Literals', () => {
  
  describe('Boolean literals vs identifiers', () => {
    it('parses true/false as boolean literals', () => {
      const ast1 = parseForEvaluation('true');
      expect(ast1.type).toBe(NodeType.Literal);
      expect((ast1 as any).value).toBe(true);
      expect((ast1 as any).valueType).toBe('boolean');
      
      const ast2 = parseForEvaluation('false');
      expect(ast2.type).toBe(NodeType.Literal);
      expect((ast2 as any).value).toBe(false);
      expect((ast2 as any).valueType).toBe('boolean');
    });
    
    it('parses true.not() as function call on boolean literal', () => {
      const ast = parseForEvaluation('true.not()');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).left.type).toBe(NodeType.Literal);
      expect((ast as any).left.value).toBe(true);
      expect((ast as any).right.type).toBe(NodeType.Function);
      expect((ast as any).right.name.name).toBe('not');
    });
    
    it('parses false.not() as function call on boolean literal', () => {
      const ast = parseForEvaluation('false.not()');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).left.type).toBe(NodeType.Literal);
      expect((ast as any).left.value).toBe(false);
      expect((ast as any).right.type).toBe(NodeType.Function);
      expect((ast as any).right.name.name).toBe('not');
    });
    
    // TODO: The parser currently allows this, but according to the FHIRPath grammar,
    // true/false should be reserved keywords and not allowed as identifiers after a dot
    it('currently parses Patient.true (should fail as reserved keyword)', () => {
      const ast = parseForEvaluation('Patient.true');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).left.name).toBe('Patient');
      expect((ast as any).right.name).toBe('true');
      // This test documents current behavior - should be fixed to throw error
    });
    
    it('currently parses Patient.false (should fail as reserved keyword)', () => {
      const ast = parseForEvaluation('Patient.false');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).left.name).toBe('Patient');
      expect((ast as any).right.name).toBe('false');
      // This test documents current behavior - should be fixed to throw error
    });
    
    it('parses Patient.`true` as property access with delimited identifier', () => {
      const ast = parseForEvaluation('Patient.`true`');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).left.type).toBe(NodeType.TypeOrIdentifier);
      expect((ast as any).left.name).toBe('Patient');
      expect((ast as any).right.type).toBe(NodeType.Identifier);
      expect((ast as any).right.name).toBe('true');
    });
    
    it('parses Patient.`false` as property access with delimited identifier', () => {
      const ast = parseForEvaluation('Patient.`false`');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).right.type).toBe(NodeType.Identifier);
      expect((ast as any).right.name).toBe('false');
    });
  });
  
  describe('Operator keywords as identifiers', () => {
    // Testing keywords that appear in the grammar as operators
    const operatorKeywords = ['and', 'or', 'xor', 'implies'];
    
    operatorKeywords.forEach(keyword => {
      // TODO: These should fail but the parser currently allows them
      it(`currently parses Patient.${keyword} (should fail for operator keywords)`, () => {
        const ast = parseForEvaluation(`Patient.${keyword}`);
        expect(ast.type).toBe(NodeType.Binary);
        expect((ast as any).operator).toBe('DOT');
        expect((ast as any).right.name).toBe(keyword);
      });
      
      it(`parses Patient.\`${keyword}\` with delimited identifier`, () => {
        const ast = parseForEvaluation(`Patient.\`${keyword}\``);
        expect(ast.type).toBe(NodeType.Binary);
        expect((ast as any).operator).toBe('DOT');
        expect((ast as any).right.type).toBe(NodeType.Identifier);
        expect((ast as any).right.name).toBe(keyword);
      });
    });
  });
  
  describe('Complex expressions with keywords', () => {
    it('parses boolean operators correctly', () => {
      const ast = parseForEvaluation('true and false');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('AND');
      expect((ast as any).left.value).toBe(true);
      expect((ast as any).right.value).toBe(false);
    });
    
    it('parses true or false', () => {
      const ast = parseForEvaluation('true or false');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('OR');
    });
    
    it('parses {}.not() as function on empty collection', () => {
      const ast = parseForEvaluation('{}.not()');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).left.type).toBe(NodeType.Collection);
      expect((ast as any).right.type).toBe(NodeType.Function);
      expect((ast as any).right.name.name).toBe('not');
    });
  });
  
  describe('Special variables', () => {
    it('parses $this as a special variable', () => {
      const ast = parseForEvaluation('$this');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('$this');
    });
    
    it('parses $index as a special variable', () => {
      const ast = parseForEvaluation('$index');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('$index');
    });
    
    it('parses $total as a special variable', () => {
      const ast = parseForEvaluation('$total');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('$total');
    });
    
    it('parses environment variables with %', () => {
      const ast = parseForEvaluation('%context');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('context');
    });
    
    // TODO: The parser currently allows these, but they should probably fail
    it('currently allows Patient.$this (questionable)', () => {
      const ast = parseForEvaluation('Patient.$this');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).right.type).toBe(NodeType.Variable);
      expect((ast as any).right.name).toBe('$this');
    });
  });
  
  describe('Context-sensitive keywords (as, contains, in, is)', () => {
    // According to the grammar, these can be identifiers in certain contexts
    it('parses "as" as identifier at start of path', () => {
      const ast = parseForEvaluation('as');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('as');
    });
    
    it('parses "contains" as identifier at start of path', () => {
      const ast = parseForEvaluation('contains');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('contains');
    });
    
    it('parses "in" as identifier at start of path', () => {
      const ast = parseForEvaluation('in');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('in');
    });
    
    it('parses "is" as identifier at start of path', () => {
      const ast = parseForEvaluation('is');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('is');
    });
    
    it('parses Patient.as as property access', () => {
      const ast = parseForEvaluation('Patient.as');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).right.name).toBe('as');
    });
    
    it('parses Patient.contains as property access', () => {
      const ast = parseForEvaluation('Patient.contains');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('DOT');
      expect((ast as any).right.name).toBe('contains');
    });
    
    it('still parses "as" as operator in type expressions', () => {
      const ast = parseForEvaluation('value as Patient');
      expect(ast.type).toBe(NodeType.TypeCast);
    });
    
    it('still parses "is" as operator in type expressions', () => {
      const ast = parseForEvaluation('value is Patient');
      expect(ast.type).toBe(NodeType.MembershipTest);
    });
    
    it('still parses "contains" as operator in expressions', () => {
      const ast = parseForEvaluation("'hello' contains 'ell'");
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('CONTAINS');
    });
    
    it('still parses "in" as operator in expressions', () => {
      const ast = parseForEvaluation("5 in (1 | 2 | 3 | 4 | 5)");
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe('IN');
    });
  });
  
  describe('Key takeaways', () => {
    it('demonstrates that true/false are literals when standalone', () => {
      // true and false are boolean literals
      const trueAst = parseForEvaluation('true');
      expect(trueAst.type).toBe(NodeType.Literal);
      expect((trueAst as any).valueType).toBe('boolean');
    });
    
    it('demonstrates that true.not() treats true as a literal', () => {
      // In true.not(), 'true' is parsed as a boolean literal, not a property
      const ast = parseForEvaluation('true.not()');
      expect((ast as any).left.type).toBe(NodeType.Literal);
      expect((ast as any).left.value).toBe(true);
    });
    
    it('demonstrates delimited identifiers can use reserved words', () => {
      // Backticks allow using reserved words as property names
      const ast = parseForEvaluation('Patient.`true`');
      expect((ast as any).right.name).toBe('true');
    });
    
    it('shows that certain keywords are context-sensitive', () => {
      // 'as', 'contains', 'in', 'is' can be identifiers in some contexts
      const ast1 = parseForEvaluation('as'); // identifier
      expect(ast1.type).toBe(NodeType.Identifier);
      
      const ast2 = parseForEvaluation('value as Patient'); // operator
      expect(ast2.type).toBe(NodeType.TypeCast);
    });
  });
});