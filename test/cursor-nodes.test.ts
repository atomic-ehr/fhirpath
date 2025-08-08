import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { CursorContext, isCursorNode } from '../src/cursor-nodes';
import { NodeType } from '../src/types';

describe('Cursor Nodes', () => {
  describe('cursor after dot', () => {
    it('should create CursorIdentifierNode after dot', () => {
      const expression = 'Patient.';
      const cursorPosition = 8; // After the dot
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      const binary = result.ast as any;
      expect(binary.right).toBeDefined();
      expect(isCursorNode(binary.right)).toBe(true);
      expect(binary.right.context).toBe(CursorContext.Identifier);
    });

    it('should create CursorIdentifierNode in member chain', () => {
      const expression = 'Patient.name.';
      const cursorPosition = 13; // After second dot
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      const binary = result.ast as any;
      expect(binary.right).toBeDefined();
      expect(isCursorNode(binary.right)).toBe(true);
      expect(binary.right.context).toBe(CursorContext.Identifier);
    });
  });

  describe('cursor after type operators', () => {
    it('should create CursorTypeNode after is', () => {
      const expression = 'value is ';
      const cursorPosition = 9; // After 'is '
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      expect(isCursorNode(result.ast)).toBe(true);
      expect((result.ast as any).context).toBe(CursorContext.Type);
      expect((result.ast as any).typeOperator).toBe('is');
    });

    it('should create CursorTypeNode after as', () => {
      const expression = 'value as ';
      const cursorPosition = 9; // After 'as '
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      expect(isCursorNode(result.ast)).toBe(true);
      expect((result.ast as any).context).toBe(CursorContext.Type);
      expect((result.ast as any).typeOperator).toBe('as');
    });
  });

  describe('cursor in function arguments', () => {
    it('should create CursorArgumentNode in function call', () => {
      const expression = 'where(';
      const cursorPosition = 6; // After opening paren
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      const func = result.ast as any;
      expect(func.arguments).toBeDefined();
      expect(func.arguments.length).toBeGreaterThan(0);
      expect(isCursorNode(func.arguments[0])).toBe(true);
      expect(func.arguments[0].context).toBe(CursorContext.Argument);
      expect(func.arguments[0].argumentIndex).toBe(0);
    });

    it('should create CursorArgumentNode after comma', () => {
      const expression = 'substring(0, ';
      const cursorPosition = 13; // After comma and space
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      const func = result.ast as any;
      expect(func.arguments).toBeDefined();
      expect(func.arguments.length).toBe(2);
      expect(isCursorNode(func.arguments[1])).toBe(true);
      expect(func.arguments[1].context).toBe(CursorContext.Argument);
      expect(func.arguments[1].argumentIndex).toBe(1);
    });

    it('should handle cursor in ofType function', () => {
      const expression = 'collection.ofType(';
      const cursorPosition = 18; // After opening paren
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      const binary = result.ast as any;
      const func = binary.right as any;
      expect(func.arguments).toBeDefined();
      expect(func.arguments.length).toBeGreaterThan(0);
      expect(isCursorNode(func.arguments[0])).toBe(true);
      expect(func.arguments[0].context).toBe(CursorContext.Argument);
    });
  });

  describe('cursor in indexer', () => {
    it('should create CursorIndexNode in brackets', () => {
      const expression = 'Patient[';
      const cursorPosition = 8; // After opening bracket
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      expect(isCursorNode(result.ast)).toBe(true);
      expect((result.ast as any).context).toBe(CursorContext.Index);
    });

    it('should create CursorIndexNode in nested indexer', () => {
      const expression = 'Patient.name[';
      const cursorPosition = 13; // After opening bracket
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      expect(isCursorNode(result.ast)).toBe(true);
      expect((result.ast as any).context).toBe(CursorContext.Index);
    });
  });

  describe('cursor between expressions', () => {
    it('should create CursorOperatorNode after literal', () => {
      const expression = '5 ';
      const cursorPosition = 2; // After number and space
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      // Cursor is in Binary node to preserve left context
      expect(result.ast?.type).toBe(NodeType.Binary);
      const binaryAst = result.ast as any;
      expect(isCursorNode(binaryAst.right)).toBe(true);
      expect(binaryAst.right.context).toBe(CursorContext.Operator);
      // Left side should be the literal
      expect(binaryAst.left.type).toBe('Literal');
      expect(binaryAst.left.value).toBe(5);
    });

    it('should create CursorOperatorNode after identifier', () => {
      const expression = 'Patient.name ';
      const cursorPosition = 13; // After identifier and space
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      // Cursor is in Binary node to preserve left context
      expect(result.ast?.type).toBe(NodeType.Binary);
      const binaryAst = result.ast as any;
      expect(isCursorNode(binaryAst.right)).toBe(true);
      expect(binaryAst.right.context).toBe(CursorContext.Operator);
      // Left side should be the navigation expression
      expect(binaryAst.left.type).toBe('Binary');
      expect(binaryAst.left.operator).toBe('.');
    });

    it('should create CursorOperatorNode at expression start', () => {
      const expression = '';
      const cursorPosition = 0; // At start
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      expect(isCursorNode(result.ast)).toBe(true);
      expect((result.ast as any).context).toBe(CursorContext.Operator);
    });
  });

  describe('mid-token cursor', () => {
    it('should ignore cursor in middle of identifier', () => {
      const expression = 'Patient.name';
      const cursorPosition = 10; // In middle of 'name' (na|me)
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      // Should parse normally without cursor node
      const binary = result.ast as any;
      expect(binary.left).toBeDefined();
      expect(binary.right).toBeDefined();
      expect(isCursorNode(binary.right)).toBe(false);
    });

    it('should ignore cursor in middle of number', () => {
      const expression = '123';
      const cursorPosition = 1; // In middle of number (1|23)
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      // Should parse as normal number
      expect(isCursorNode(result.ast)).toBe(false);
      expect((result.ast as any).value).toBe(123);
    });

    it('should ignore cursor in middle of string', () => {
      const expression = "'hello'";
      const cursorPosition = 4; // In middle of string ('hel|lo')
      const result = parse(expression, { cursorPosition });
      
      expect(result.ast).toBeDefined();
      // Should parse as normal string
      expect(isCursorNode(result.ast)).toBe(false);
      expect((result.ast as any).value).toBe('hello');
    });
  });
});