import { describe, it, expect } from 'bun:test';
import { parse, ParserMode, isDiagnosticResult } from '../../src/api';
import { NodeType } from '../../src/parser/ast';
import type { ASTNode, ErrorNode, IncompleteNode } from '../../src/parser/ast';

function findNodeOfType(node: ASTNode, type: NodeType): ASTNode | undefined {
  if (node.type === type) {
    return node;
  }
  
  // Check common node properties that contain children
  const anyNode = node as any;
  
  if (anyNode.left) {
    const found = findNodeOfType(anyNode.left, type);
    if (found) return found;
  }
  
  if (anyNode.right) {
    const found = findNodeOfType(anyNode.right, type);
    if (found) return found;
  }
  
  if (anyNode.operand) {
    const found = findNodeOfType(anyNode.operand, type);
    if (found) return found;
  }
  
  if (anyNode.expression) {
    const found = findNodeOfType(anyNode.expression, type);
    if (found) return found;
  }
  
  if (anyNode.arguments && Array.isArray(anyNode.arguments)) {
    for (const arg of anyNode.arguments) {
      const found = findNodeOfType(arg, type);
      if (found) return found;
    }
  }
  
  if (anyNode.elements && Array.isArray(anyNode.elements)) {
    for (const elem of anyNode.elements) {
      const found = findNodeOfType(elem, type);
      if (found) return found;
    }
  }
  
  if (anyNode.operands && Array.isArray(anyNode.operands)) {
    for (const operand of anyNode.operands) {
      const found = findNodeOfType(operand, type);
      if (found) return found;
    }
  }
  
  return undefined;
}

describe('Error Nodes in AST', () => {
  it('creates ErrorNode for invalid syntax', () => {
    const result = parse('Patient.[0]', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // The AST should contain an error node
    const errorNode = findNodeOfType(result.ast, NodeType.Error);
    expect(errorNode).toBeDefined();
    
    if (errorNode) {
      const error = errorNode as ErrorNode;
      expect(error.diagnostic).toBeDefined();
      expect(error.actualToken).toBeDefined();
    }
  });
  
  it('creates IncompleteNode for partial expressions', () => {
    const result = parse('Patient.name.', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have created an incomplete node
    const incompleteNode = findNodeOfType(result.ast, NodeType.Incomplete);
    if (incompleteNode) {
      const incomplete = incompleteNode as IncompleteNode;
      expect(incomplete.missingParts).toContain('property');
    }
  });
  
  it('error nodes have proper ranges', () => {
    const result = parse('Patient..name', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Double dot should create diagnostic but continue parsing
    expect(result.isPartial).toBe(true);
    expect(result.ast).toBeDefined();
  });
  
  it('creates error nodes in function arguments', () => {
    const result = parse('Patient.where(active = , name = "test")', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have error node for missing expression after =
    expect(result.isPartial).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
  
  it('maintains AST structure with error nodes', () => {
    const result = parse('Patient.where(].name', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should still have a navigable AST structure
    expect(result.ast).toBeDefined();
    expect(result.isPartial).toBe(true);
    
    // Should have error about unexpected ]
    const unexpectedToken = result.diagnostics.find(d => d.code === 'UNEXPECTED_TOKEN');
    expect(unexpectedToken).toBeDefined();
  });
  
  it('creates incomplete nodes for missing function arguments', () => {
    const result = parse('Patient.where(', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    expect(result.isPartial).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
  
  it('preserves partial AST for analysis', () => {
    const result = parse('Patient.name.given[0].value.', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have AST up to the incomplete part
    expect(result.ast).toBeDefined();
    expect(result.isPartial).toBe(true);
    
    // The AST should have the navigation chain
    let current = result.ast;
    let depth = 0;
    while (current && (current as any).left && depth < 10) {
      current = (current as any).left;
      depth++;
    }
    expect(depth).toBeGreaterThan(0); // Should have nested structure
  });
  
  it('error nodes include diagnostic information', () => {
    const result = parse('Patient.123', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have error about expected identifier after dot
    const identError = result.diagnostics.find(d => d.code === 'EXPECTED_IDENTIFIER');
    expect(identError).toBeDefined();
  });
});