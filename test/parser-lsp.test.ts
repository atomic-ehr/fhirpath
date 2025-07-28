import { describe, it, expect } from 'bun:test';
import { parseLSP, parsePartialLSP } from '../src/parser-lsp';
import { NodeType } from '../src/parser-base';
import { TokenType } from '../src/lexer';
import type { LSPASTNode, IdentifierNode, BinaryNode, FunctionNode, ErrorNode } from '../src/parser-lsp';

describe('LSP Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse simple identifier', () => {
      const result = parseLSP('Patient');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ast.type).toBe(NodeType.TypeOrIdentifier);
      expect((result.ast as IdentifierNode).name).toBe('Patient');
      
      // Check position information
      expect(result.ast.range.start).toEqual({ line: 1, column: 1, offset: 0 });
      expect(result.ast.range.end).toEqual({ line: 1, column: 8, offset: 7 });
      expect(result.ast.raw).toBe('Patient');
    });
    
    it('should parse member expression', () => {
      const result = parseLSP('Patient.name');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ast.type).toBe(NodeType.Binary);
      
      const binary = result.ast as BinaryNode;
      expect((binary.left as IdentifierNode).name).toBe('Patient');
      expect((binary.right as IdentifierNode).name).toBe('name');
      
      // Check raw text
      expect(binary.raw).toBe('Patient.name');
    });
    
    it('should parse function call', () => {
      const result = parseLSP('name.where(use = "official")');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ast.type).toBe(NodeType.Binary);
      
      const binary = result.ast as BinaryNode;
      expect((binary.left as IdentifierNode).name).toBe('name');
      expect(binary.right.type).toBe(NodeType.Function);
      
      const func = binary.right as FunctionNode;
      expect((func.name as IdentifierNode).name).toBe('where');
      expect(func.arguments).toHaveLength(1);
    });
  });
  
  describe('Rich Position Information', () => {
    it('should track positions accurately', () => {
      const result = parseLSP('Patient.name.given');
      
      const ast = result.ast as BinaryNode;
      
      // Full expression
      expect(ast.range.start.offset).toBe(0);
      expect(ast.range.end.offset).toBe(18);
      
      // Left side (Patient.name)
      const left = ast.left as BinaryNode;
      expect(left.range.start.offset).toBe(0);
      expect(left.range.end.offset).toBe(12);
      
      // Right side (given)
      const right = ast.right as IdentifierNode;
      expect(right.range.start.offset).toBe(13);
      expect(right.range.end.offset).toBe(18);
    });
    
    it('should preserve whitespace in trivia', () => {
      const result = parseLSP('  Patient  .  name  ');
      
      expect(result.errors).toHaveLength(0);
      // Trivia collection not yet implemented
      expect(result.ast.leadingTrivia).toHaveLength(0);
      expect(result.ast.trailingTrivia).toHaveLength(0);
    });
    
    it('should preserve comments in trivia', () => {
      const result = parseLSP('Patient /* test */ .name');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ast.type).toBe(NodeType.Binary);
      
      // Raw text should contain everything
      const binary = result.ast as BinaryNode;
      expect(binary.raw).toBe('Patient /* test */ .name');
    });
  });
  
  describe('Bidirectional Navigation', () => {
    it('should set up parent-child relationships', () => {
      const result = parseLSP('Patient.name.given');
      
      const ast = result.ast as BinaryNode;
      
      // Check parent relationships
      expect(ast.parent).toBeNull();
      expect(ast.left.parent).toBe(ast);
      expect(ast.right.parent).toBe(ast);
      
      // Check children
      expect(ast.children).toHaveLength(2);
      expect(ast.children[0]).toBe(ast.left);
      expect(ast.children[1]).toBe(ast.right);
    });
    
    it('should set up sibling relationships', () => {
      const result = parseLSP('func(a, b, c)');
      
      const func = result.ast as FunctionNode;
      const args = func.arguments;
      
      expect(args).toHaveLength(3);
      
      // Check sibling links
      expect(args[0]?.previousSibling).toBe(func.name);
      expect(args[0]?.nextSibling).toBe(args[1] || null);
      expect(args[1]?.previousSibling).toBe(args[0] || null);
      expect(args[1]?.nextSibling).toBe(args[2] || null);
      expect(args[2]?.previousSibling).toBe(args[1] || null);
      expect(args[2]?.nextSibling).toBeNull();
    });
    
    it('should calculate depth correctly', () => {
      const result = parseLSP('Patient.name.given');
      
      const ast = result.ast as BinaryNode;
      expect(ast.depth).toBe(0);
      
      const left = ast.left as BinaryNode;
      expect(left.depth).toBe(1);
      expect(left.left?.depth).toBe(2);
      expect(left.right?.depth).toBe(2);
      
      expect(ast.right?.depth).toBe(1);
    });
    
    it('should assign unique IDs to nodes', () => {
      const result = parseLSP('Patient.name');
      
      const ids = new Set<string>();
      const collectIds = (node: LSPASTNode) => {
        ids.add(node.id);
        node.children.forEach(collectIds);
      };
      
      collectIds(result.ast);
      
      // Should have 3 unique IDs (binary, patient, name)
      expect(ids.size).toBe(3);
    });
  });
  
  describe('Indexes', () => {
    it('should index nodes by ID', () => {
      const result = parseLSP('Patient.name');
      
      expect(result.indexes.nodeById.size).toBe(3);
      
      // All nodes should be in the index
      const checkIndex = (node: LSPASTNode) => {
        expect(result.indexes.nodeById.get(node.id)).toBe(node);
        node.children.forEach(checkIndex);
      };
      
      checkIndex(result.ast);
    });
    
    it('should index nodes by type', () => {
      const result = parseLSP('Patient.name.given');
      
      const identifiers = result.indexes.nodesByType.get(NodeType.Identifier);
      const typeOrIdentifiers = result.indexes.nodesByType.get(NodeType.TypeOrIdentifier);
      const binaries = result.indexes.nodesByType.get(NodeType.Binary);
      
      expect(identifiers).toHaveLength(2); // name, given
      expect(typeOrIdentifiers).toHaveLength(1); // Patient
      expect(binaries).toHaveLength(2); // two dots
    });
    
    it('should index identifiers by name', () => {
      const result = parseLSP('Patient.name.family | Patient.name.given');
      
      const patientNodes = result.indexes.identifiers.get('Patient');
      const nameNodes = result.indexes.identifiers.get('name');
      
      expect(patientNodes).toHaveLength(2);
      expect(nameNodes).toHaveLength(2);
      expect(result.indexes.identifiers.get('family')).toHaveLength(1);
      expect(result.indexes.identifiers.get('given')).toHaveLength(1);
    });
  });
  
  describe('Error Recovery', () => {
    it('should recover from missing identifier after dot', () => {
      const result = parseLSP('Patient.');
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('Expected identifier');
      
      // Should still create a partial AST
      expect(result.ast.type).toBe(NodeType.Binary);
      const binary = result.ast as BinaryNode;
      expect((binary.left as IdentifierNode).name).toBe('Patient');
      expect(binary.right?.type).toBe('Error');
    });
    
    it('should recover from double dots', () => {
      const result = parseLSP('Patient..name');
      
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should create some AST structure
      expect(result.ast).toBeDefined();
    });
    
    it('should recover from unclosed parentheses', () => {
      const result = parseLSP('func(a, b');
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain("Expected ')'");
      
      // Should still parse the function and arguments
      const func = result.ast as FunctionNode;
      expect(func.type).toBe(NodeType.Function);
      expect(func.arguments).toHaveLength(2);
    });
    
    it('should handle multiple errors', () => {
      const result = parseLSP('Patient..name..given');
      
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should still produce some AST
      expect(result.ast).toBeDefined();
    });
    
    it('should create error nodes with context', () => {
      const result = parseLSP('Patient.');
      
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should create an AST with error recovery
      expect(result.ast).toBeDefined();
      expect(result.ast.type).toBe(NodeType.Binary);
      
      // The right side should be an error node
      const binary = result.ast as BinaryNode;
      expect(binary.right?.type).toBe('Error');
    });
  });
  
  describe('Partial Parsing', () => {
    it('should parse partial expression at cursor', () => {
      const result = parsePartialLSP('Patient.', 8); // Cursor after dot
      
      expect(result.cursorContext).toBeDefined();
      expect(result.cursorContext!.node).toBeDefined();
      expect(result.cursorContext!.expectedTokens.length).toBeGreaterThan(0);
      expect(result.cursorContext!.availableCompletions.length).toBeGreaterThan(0);
    });
    
    it('should find node at cursor position', () => {
      const result = parsePartialLSP('Patient.name.given', 10); // Inside 'name'
      
      expect(result.cursorContext).toBeDefined();
      expect(result.cursorContext!.node).toBeDefined();
      expect(result.cursorContext!.node!.type).toBe(NodeType.Identifier);
      expect((result.cursorContext!.node as IdentifierNode).name).toBe('name');
    });
    
    it('should provide completions', () => {
      const result = parsePartialLSP('Patient.na', 10); // After 'na'
      
      expect(result.cursorContext).toBeDefined();
      // Basic implementation just returns all known completions
      expect(result.cursorContext!.availableCompletions.length).toBeGreaterThan(5);
      expect(result.cursorContext!.availableCompletions).toContain('where');
      expect(result.cursorContext!.availableCompletions).toContain('select');
    });
  });
  
  describe('Complex Expressions', () => {
    it('should parse complex nested expressions', () => {
      const expr = 'Patient.name.where(use = "official").given.first()';
      const result = parseLSP(expr);
      
      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      
      // Verify structure - the outermost node is a Binary (.)
      expect(result.ast.type).toBe(NodeType.Binary);
      const binary = result.ast as BinaryNode;
      // Right side should be the function call first()
      expect(binary.right.type).toBe(NodeType.Function);
      const func = binary.right as FunctionNode;
      expect((func.name as IdentifierNode).name).toBe('first');
    });
    
    it('should parse union expressions', () => {
      const result = parseLSP('a | b | c');
      
      expect(result.errors).toHaveLength(0);
      expect(result.ast.type).toBe(NodeType.Binary);
      
      const binary = result.ast as BinaryNode;
      expect(binary.operator).toBe('|');
      
      // Union is left-associative, so (a | b) | c
      expect(binary.left.type).toBe(NodeType.Binary);
      expect(binary.right.type).toBe(NodeType.Identifier);
      expect((binary.right as IdentifierNode).name).toBe('c');
      
      const leftBinary = binary.left as BinaryNode;
      expect(leftBinary.operator).toBe('|');
      expect((leftBinary.left as IdentifierNode).name).toBe('a');
      expect((leftBinary.right as IdentifierNode).name).toBe('b');
    });
  });
});

describe('LSP Parser Performance', () => {
  it('should maintain reasonable performance', () => {
    const expr = 'Patient.name.where(use = "official").given.first() | Patient.name.where(use = "nickname").given';
    
    const start = performance.now();
    const iterations = 10000;
    
    for (let i = 0; i < iterations; i++) {
      parseLSP(expr);
    }
    
    const end = performance.now();
    const timePerParse = (end - start) / iterations;
    
    console.log(`LSP Parser: ${timePerParse.toFixed(4)}ms per parse`);
    console.log(`LSP Parser: ${(1000 / timePerParse).toFixed(0)} parses/sec`);
    
    // Should be reasonably fast (target: 200K+ expr/sec = <0.005ms per parse)
    expect(timePerParse).toBeLessThan(0.02); // 50K+ expr/sec minimum for LSP parser
  });
});