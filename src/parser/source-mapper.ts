import type { Token } from '../lexer/token';
import type { ASTNode } from './ast';
import { NodeType } from './ast';
import type { TextRange, Position } from './types';

export class SourceMapper {
  private source: string;
  private lineOffsets: number[] = [];
  
  constructor(source: string) {
    this.source = source;
    this.calculateLineOffsets();
  }
  
  private calculateLineOffsets(): void {
    this.lineOffsets = [0];
    for (let i = 0; i < this.source.length; i++) {
      if (this.source[i] === '\n') {
        this.lineOffsets.push(i + 1);
      }
    }
  }
  
  tokenToRange(token: Token): TextRange {
    const start = this.offsetToPosition(token.position.offset);
    const end = this.offsetToPosition(token.position.offset + token.value.length);
    
    return {
      start,
      end
    };
  }
  
  offsetToPosition(offset: number): Position {
    let line = 0;
    
    for (let i = 0; i < this.lineOffsets.length - 1; i++) {
      if (offset >= this.lineOffsets[i]! && offset < this.lineOffsets[i + 1]!) {
        line = i;
        break;
      }
    }
    
    if (offset >= this.lineOffsets[this.lineOffsets.length - 1]!) {
      line = this.lineOffsets.length - 1;
    }
    
    const character = offset - this.lineOffsets[line]!;
    
    return {
      line,
      character,
      offset
    };
  }
  
  positionToOffset(line: number, character: number): number {
    if (line < 0 || line >= this.lineOffsets.length) {
      return -1;
    }
    
    return this.lineOffsets[line]! + character;
  }
  
  nodeToRange(node: ASTNode): TextRange {
    const start = this.offsetToPosition(node.position.offset);
    const end = this.calculateNodeEnd(node);
    
    return {
      start,
      end
    };
  }
  
  private calculateNodeEnd(node: ASTNode): Position {
    // This is a simplified version - in a full implementation,
    // we would traverse the AST to find the actual end position
    // For now, we'll estimate based on the node type and content
    
    let endOffset = node.position.offset;
    
    switch (node.type) {
      case NodeType.Literal:
        // For literals, we can estimate based on the value
        const literalNode = node as any;
        if (literalNode.raw) {
          endOffset += literalNode.raw.length;
        } else if (typeof literalNode.value === 'string') {
          endOffset += literalNode.value.length + 2; // +2 for quotes
        } else if (typeof literalNode.value === 'number') {
          endOffset += literalNode.value.toString().length;
        } else if (typeof literalNode.value === 'boolean') {
          endOffset += literalNode.value ? 4 : 5; // true/false
        }
        break;
        
      case NodeType.Identifier:
      case NodeType.TypeOrIdentifier:
        const identifierNode = node as any;
        endOffset += identifierNode.name.length;
        break;
        
      case NodeType.Variable:
        const variableNode = node as any;
        endOffset += variableNode.name.length;
        break;
        
      default:
        // For complex nodes, we'd need to traverse children
        // This is a placeholder - in real implementation we'd calculate properly
        endOffset += 1;
    }
    
    return this.offsetToPosition(endOffset);
  }
  
  getRangeText(range: TextRange): string {
    return this.source.substring(range.start.offset, range.end.offset);
  }
  
  getLineText(line: number): string {
    if (line < 0 || line >= this.lineOffsets.length) {
      return '';
    }
    
    const start = this.lineOffsets[line]!;
    const end = line < this.lineOffsets.length - 1 
      ? this.lineOffsets[line + 1]! - 1 
      : this.source.length;
    
    return this.source.substring(start, end).replace(/[\r\n]+$/, '');
  }
}