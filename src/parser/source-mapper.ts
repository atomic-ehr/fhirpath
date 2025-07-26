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
    // If the node already has a range (from diagnostic mode), use it
    if (node.range) {
      return node.range;
    }
    
    const start = this.offsetToPosition(node.position.offset);
    const end = this.calculateNodeEnd(node);
    
    return {
      start,
      end
    };
  }
  
  private calculateNodeEnd(node: ASTNode): Position {
    let endOffset = node.position.offset;
    
    switch (node.type) {
      case NodeType.Literal: {
        const literalNode = node as any;
        if (literalNode.raw) {
          endOffset += literalNode.raw.length;
        } else if (typeof literalNode.value === 'string') {
          endOffset += literalNode.value.length + 2; // +2 for quotes
        } else if (typeof literalNode.value === 'number') {
          endOffset += literalNode.value.toString().length;
        } else if (typeof literalNode.value === 'boolean') {
          endOffset += literalNode.value ? 4 : 5; // true/false
        } else if (literalNode.value === null) {
          endOffset += 4; // null
        }
        break;
      }
        
      case NodeType.Identifier:
      case NodeType.TypeOrIdentifier: {
        const identifierNode = node as any;
        endOffset += identifierNode.name.length;
        break;
      }
        
      case NodeType.Variable: {
        const variableNode = node as any;
        endOffset += variableNode.name.length + 1; // +1 for $ or %
        break;
      }
      
      case NodeType.Binary: {
        const binaryNode = node as any;
        if (binaryNode.right && binaryNode.right.range) {
          return binaryNode.right.range.end;
        } else if (binaryNode.right) {
          return this.calculateNodeEnd(binaryNode.right);
        }
        break;
      }
      
      case NodeType.Unary: {
        const unaryNode = node as any;
        if (unaryNode.operand && unaryNode.operand.range) {
          return unaryNode.operand.range.end;
        } else if (unaryNode.operand) {
          return this.calculateNodeEnd(unaryNode.operand);
        }
        break;
      }
      
      case NodeType.Function: {
        const functionNode = node as any;
        // Estimate end as after the closing parenthesis
        // This is approximate - proper implementation would track tokens
        if (functionNode.arguments && functionNode.arguments.length > 0) {
          const lastArg = functionNode.arguments[functionNode.arguments.length - 1];
          if (lastArg.range) {
            endOffset = lastArg.range.end.offset + 1; // +1 for )
          } else {
            endOffset = this.calculateNodeEnd(lastArg).offset + 1;
          }
        } else {
          // Empty function call - estimate
          endOffset += 2; // ()
        }
        break;
      }
      
      case NodeType.Index: {
        const indexNode = node as any;
        if (indexNode.index && indexNode.index.range) {
          return this.offsetToPosition(indexNode.index.range.end.offset + 1); // +1 for ]
        } else if (indexNode.index) {
          const indexEnd = this.calculateNodeEnd(indexNode.index);
          return this.offsetToPosition(indexEnd.offset + 1); // +1 for ]
        }
        break;
      }
      
      case NodeType.Collection: {
        const collectionNode = node as any;
        if (collectionNode.elements && collectionNode.elements.length > 0) {
          const lastElement = collectionNode.elements[collectionNode.elements.length - 1];
          if (lastElement.range) {
            endOffset = lastElement.range.end.offset + 1; // +1 for }
          } else {
            endOffset = this.calculateNodeEnd(lastElement).offset + 1;
          }
        } else {
          endOffset += 2; // {}
        }
        break;
      }
      
      case NodeType.Union: {
        const unionNode = node as any;
        if (unionNode.operands && unionNode.operands.length > 0) {
          const lastOperand = unionNode.operands[unionNode.operands.length - 1];
          if (lastOperand.range) {
            return lastOperand.range.end;
          } else {
            return this.calculateNodeEnd(lastOperand);
          }
        }
        break;
      }
      
      case NodeType.TypeCast:
      case NodeType.MembershipTest: {
        const typedNode = node as any;
        if (typedNode.targetType) {
          endOffset += typedNode.targetType.length;
        }
        break;
      }
      
      case NodeType.TypeReference: {
        const typeRefNode = node as any;
        endOffset += typeRefNode.typeName.length;
        break;
      }
      
      case NodeType.Error:
      case NodeType.Incomplete: {
        // Error nodes should have their range set during creation
        const errorNode = node as any;
        if (errorNode.actualToken) {
          endOffset += errorNode.actualToken.value.length;
        } else {
          endOffset += 1; // Minimal range
        }
        break;
      }
        
      default:
        // For unknown nodes, minimal range
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