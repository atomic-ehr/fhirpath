import { describe, it, expect } from 'bun:test';
import { SourceMapper } from '../../legacy-src/parser/source-mapper';
import type { Token } from '../../legacy-src/lexer/token';
import { TokenType } from '../../legacy-src/lexer/token';
import type { ASTNode } from '../../legacy-src/parser/ast';
import { NodeType } from '../../legacy-src/parser/ast';

describe('SourceMapper', () => {
  describe('offsetToPosition', () => {
    it('converts offset to position correctly for single line', () => {
      const mapper = new SourceMapper('hello world');
      
      expect(mapper.offsetToPosition(0)).toEqual({ line: 0, character: 0, offset: 0 });
      expect(mapper.offsetToPosition(6)).toEqual({ line: 0, character: 6, offset: 6 });
      expect(mapper.offsetToPosition(11)).toEqual({ line: 0, character: 11, offset: 11 });
    });
    
    it('converts offset to position correctly for multiple lines', () => {
      const mapper = new SourceMapper('line1\nline2\nline3');
      
      expect(mapper.offsetToPosition(0)).toEqual({ line: 0, character: 0, offset: 0 });
      expect(mapper.offsetToPosition(5)).toEqual({ line: 0, character: 5, offset: 5 });
      expect(mapper.offsetToPosition(6)).toEqual({ line: 1, character: 0, offset: 6 });
      expect(mapper.offsetToPosition(12)).toEqual({ line: 2, character: 0, offset: 12 });
      expect(mapper.offsetToPosition(17)).toEqual({ line: 2, character: 5, offset: 17 });
    });
    
    it('handles Windows line endings', () => {
      const mapper = new SourceMapper('line1\r\nline2\r\nline3');
      
      expect(mapper.offsetToPosition(0)).toEqual({ line: 0, character: 0, offset: 0 });
      expect(mapper.offsetToPosition(7)).toEqual({ line: 1, character: 0, offset: 7 });
      expect(mapper.offsetToPosition(14)).toEqual({ line: 2, character: 0, offset: 14 });
    });
    
    it('handles offset beyond content length', () => {
      const mapper = new SourceMapper('test');
      
      expect(mapper.offsetToPosition(10)).toEqual({ line: 0, character: 10, offset: 10 });
    });
  });
  
  describe('positionToOffset', () => {
    it('converts position to offset correctly', () => {
      const mapper = new SourceMapper('line1\nline2\nline3');
      
      expect(mapper.positionToOffset(0, 0)).toBe(0);
      expect(mapper.positionToOffset(0, 5)).toBe(5);
      expect(mapper.positionToOffset(1, 0)).toBe(6);
      expect(mapper.positionToOffset(1, 3)).toBe(9);
      expect(mapper.positionToOffset(2, 5)).toBe(17);
    });
    
    it('returns -1 for invalid line numbers', () => {
      const mapper = new SourceMapper('line1\nline2');
      
      expect(mapper.positionToOffset(-1, 0)).toBe(-1);
      expect(mapper.positionToOffset(3, 0)).toBe(-1);
    });
  });
  
  describe('tokenToRange', () => {
    it('maps tokens to ranges', () => {
      const mapper = new SourceMapper('Patient.name');
      
      const token: Token = {
        type: TokenType.IDENTIFIER,
        value: 'Patient',
        position: { line: 0, column: 0, offset: 0 }
      };
      
      const range = mapper.tokenToRange(token);
      expect(range.start).toEqual({ line: 0, character: 0, offset: 0 });
      expect(range.end).toEqual({ line: 0, character: 7, offset: 7 });
    });
    
    it('handles tokens on different lines', () => {
      const mapper = new SourceMapper('Patient\n.name');
      
      const token: Token = {
        type: TokenType.IDENTIFIER,
        value: 'name',
        position: { line: 1, column: 1, offset: 9 }
      };
      
      const range = mapper.tokenToRange(token);
      expect(range.start).toEqual({ line: 1, character: 1, offset: 9 });
      expect(range.end).toEqual({ line: 1, character: 5, offset: 13 });
    });
    
    it('handles operator tokens', () => {
      const mapper = new SourceMapper('5 + 3');
      
      const token: Token = {
        type: TokenType.PLUS,
        value: '+',
        position: { line: 0, column: 2, offset: 2 }
      };
      
      const range = mapper.tokenToRange(token);
      expect(range.start).toEqual({ line: 0, character: 2, offset: 2 });
      expect(range.end).toEqual({ line: 0, character: 3, offset: 3 });
    });
  });
  
  describe('nodeToRange', () => {
    it('maps literal nodes to ranges', () => {
      const mapper = new SourceMapper('Patient.name');
      
      const node: ASTNode = {
        type: NodeType.Identifier,
        name: 'Patient',
        position: { line: 0, column: 0, offset: 0 }
      } as any;
      
      const range = mapper.nodeToRange(node);
      expect(range.start).toEqual({ line: 0, character: 0, offset: 0 });
      expect(range.end.character).toBeGreaterThanOrEqual(7);
    });
    
    it('estimates range for string literals', () => {
      const mapper = new SourceMapper("'hello'");
      
      const node: ASTNode = {
        type: NodeType.Literal,
        value: 'hello',
        valueType: 'string',
        position: { line: 0, column: 0, offset: 0 }
      } as any;
      
      const range = mapper.nodeToRange(node);
      expect(range.start).toEqual({ line: 0, character: 0, offset: 0 });
      expect(range.end.character).toBeGreaterThanOrEqual(5);
    });
    
    it('estimates range for boolean literals', () => {
      const mapper = new SourceMapper('true');
      
      const node: ASTNode = {
        type: NodeType.Literal,
        value: true,
        valueType: 'boolean',
        position: { line: 0, column: 0, offset: 0 }
      } as any;
      
      const range = mapper.nodeToRange(node);
      expect(range.start).toEqual({ line: 0, character: 0, offset: 0 });
      expect(range.end.character).toBe(4); // "true" length
    });
  });
  
  describe('getRangeText', () => {
    it('extracts text for a given range', () => {
      const mapper = new SourceMapper('Patient.name.given');
      
      const range = {
        start: { line: 0, character: 0, offset: 0 },
        end: { line: 0, character: 7, offset: 7 }
      };
      
      expect(mapper.getRangeText(range)).toBe('Patient');
    });
    
    it('handles multi-line ranges', () => {
      const mapper = new SourceMapper('Patient\n.name\n.given');
      
      const range = {
        start: { line: 0, character: 0, offset: 0 },
        end: { line: 1, character: 5, offset: 13 }
      };
      
      expect(mapper.getRangeText(range)).toBe('Patient\n.name');
    });
  });
  
  describe('getLineText', () => {
    it('returns text for a specific line', () => {
      const mapper = new SourceMapper('line1\nline2\nline3');
      
      expect(mapper.getLineText(0)).toBe('line1');
      expect(mapper.getLineText(1)).toBe('line2');
      expect(mapper.getLineText(2)).toBe('line3');
    });
    
    it('handles CRLF line endings', () => {
      const mapper = new SourceMapper('line1\r\nline2\r\nline3');
      
      expect(mapper.getLineText(0)).toBe('line1');
      expect(mapper.getLineText(1)).toBe('line2');
      expect(mapper.getLineText(2)).toBe('line3');
    });
    
    it('returns empty string for invalid line numbers', () => {
      const mapper = new SourceMapper('line1\nline2');
      
      expect(mapper.getLineText(-1)).toBe('');
      expect(mapper.getLineText(3)).toBe('');
    });
    
    it('handles lines without trailing newline', () => {
      const mapper = new SourceMapper('line1\nline2');
      
      expect(mapper.getLineText(1)).toBe('line2');
    });
  });
});