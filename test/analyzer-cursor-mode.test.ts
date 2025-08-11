import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { Analyzer } from '../src/analyzer';
import type { TypeInfo } from '../src/types';
import { CursorContext } from '../src/cursor-nodes';

describe('Analyzer Cursor Mode', () => {
  const analyzer = new Analyzer();

  describe('stops at cursor', () => {
    it('should stop analysis at cursor after dot', async () => {
      const expression = 'Patient.name.';
      const ast = parse(expression, { cursorPosition: 13 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.stoppedAtCursor).toBe(true);
      expect(result.cursorContext).toBeDefined();
      expect(result.cursorContext?.cursorNode?.context).toBe(CursorContext.Identifier);
    });

    it('should stop at cursor in function arguments', async () => {
      const expression = 'Patient.where(';
      const ast = parse(expression, { cursorPosition: 14 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.stoppedAtCursor).toBe(true);
      expect(result.cursorContext).toBeDefined();
      expect(result.cursorContext?.cursorNode?.context).toBe(CursorContext.Argument);
    });

    it('should stop at cursor after type operator', async () => {
      const expression = 'value is ';
      const ast = parse(expression, { cursorPosition: 9 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.stoppedAtCursor).toBe(true);
      expect(result.cursorContext).toBeDefined();
      expect(result.cursorContext?.cursorNode?.context).toBe(CursorContext.Type);
    });
  });

  describe('preserves type information before cursor', () => {
    it('should annotate types up to cursor position', async () => {
      const expression = '5 + ';
      const ast = parse(expression, { cursorPosition: 4 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      // Check that the left side has type information
      const binaryNode = ast as any;
      expect(binaryNode.left).toBeDefined();
      expect(binaryNode.left.typeInfo).toBeDefined();
      expect(binaryNode.left.typeInfo.type).toBe('Integer');
    });

    it('should provide type context at cursor position', async () => {
      const expression = '"hello".';
      const ast = parse(expression, { cursorPosition: 8 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.cursorContext?.typeBeforeCursor).toBeDefined();
      expect(result.cursorContext?.typeBeforeCursor?.type).toBe('String');
    });

    it('should infer expected type for cursor context', async () => {
      const expression = 'Patient[';
      const ast = parse(expression, { cursorPosition: 8 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.cursorContext?.expectedType).toBeDefined();
      expect(result.cursorContext?.expectedType?.type).toBe('Integer');
      expect(result.cursorContext?.expectedType?.singleton).toBe(true);
    });
  });

  describe('no analysis after cursor', () => {
    it('should not analyze nodes after cursor', async () => {
      const expression = 'Patient.name.given';
      const ast = parse('Patient.', { cursorPosition: 8 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      // Should stop at cursor, not analyze 'given'
      expect(result.stoppedAtCursor).toBe(true);
      
      // No diagnostics should be generated for incomplete expression
      expect(result.diagnostics.length).toBe(0);
    });

    it('should not validate incomplete expressions after cursor', async () => {
      const expression = 'Patient.where(';
      const ast = parse(expression, { cursorPosition: 14 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      // Should not complain about missing closing paren or arguments
      expect(result.diagnostics.length).toBe(0);
      expect(result.stoppedAtCursor).toBe(true);
    });
  });

  describe('cursor mode disabled', () => {
    it('should analyze normally when cursor mode is disabled', async () => {
      const expression = 'Patient.';
      const ast = parse(expression, { cursorPosition: 8 }).ast!;
      
      // Analyze without cursor mode
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: false });
      
      expect(result.stoppedAtCursor).toBeUndefined();
      expect(result.cursorContext).toBeUndefined();
    });

    it('should analyze normally when no options provided', async () => {
      const expression = 'Patient.name';
      const ast = parse(expression).ast!;
      
      const result = await analyzer.analyze(ast);
      
      expect(result.stoppedAtCursor).toBeUndefined();
      expect(result.cursorContext).toBeUndefined();
    });
  });

  describe('complex expressions with cursor', () => {
    it('should handle cursor in nested member access', async () => {
      const expression = 'Patient.name.where(use = "official").';
      const ast = parse(expression, { cursorPosition: 38 }).ast!;
      
      const inputType: TypeInfo = { 
        type: 'Patient' as any, 
        singleton: true 
      };
      
      const result = await analyzer.analyze(ast, undefined, inputType, { cursorMode: true });
      
      expect(result.stoppedAtCursor).toBe(true);
      expect(result.cursorContext?.cursorNode?.context).toBe(CursorContext.Identifier);
      
      // Type before cursor should be the result of where() on name
      expect(result.cursorContext?.typeBeforeCursor).toBeDefined();
    });

    it('should handle cursor in collection', async () => {
      const expression = '{1, 2, ';
      const ast = parse(expression, { cursorPosition: 7 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.stoppedAtCursor).toBe(true);
      // Should have analyzed the first two elements
      const collNode = ast as any;
      if (collNode.elements) {
        expect(collNode.elements[0].typeInfo).toBeDefined();
        expect(collNode.elements[1].typeInfo).toBeDefined();
      }
    });

    it('should handle cursor between expressions', async () => {
      const expression = '5 + ';
      const ast = parse(expression, { cursorPosition: 4 }).ast!;
      
      const result = await analyzer.analyze(ast, undefined, undefined, { cursorMode: true });
      
      expect(result.stoppedAtCursor).toBe(true);
      expect(result.cursorContext?.cursorNode?.context).toBe(CursorContext.Operator);
      
      // Should have type info for the literal 5
      const binaryNode = ast as any;
      if (binaryNode.left) {
        expect(binaryNode.left.typeInfo).toBeDefined();
        expect(binaryNode.left.typeInfo.type).toBe('Integer');
      }
    });
  });
});