import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';
import type { Position } from './ast';
import {
  type ASTNode,
  type BinaryNode,
  type UnaryNode,
  type LiteralNode,
  type IdentifierNode,
  type TypeOrIdentifierNode,
  type FunctionNode,
  type VariableNode,
  type IndexNode,
  type UnionNode,
  type MembershipTestNode,
  type TypeCastNode,
  type CollectionNode,
  type TypeReferenceNode,
  type ErrorNode,
  type IncompleteNode,
  NodeType
} from './ast';
import type { ParseDiagnostic as Diagnostic } from './types';
import type { Operation } from '../registry/types';

/**
 * Factory for creating AST nodes with consistent structure
 */
export class ASTFactory {
  static createLiteral(
    value: any, 
    valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null',
    position: Position,
    raw?: string,
    operation?: Operation
  ): LiteralNode {
    return {
      type: NodeType.Literal,
      value,
      valueType,
      raw,
      operation,
      position
    };
  }

  static createIdentifier(name: string, position: Position): IdentifierNode {
    return {
      type: NodeType.Identifier,
      name,
      position
    };
  }

  static createTypeOrIdentifier(name: string, position: Position): TypeOrIdentifierNode {
    return {
      type: NodeType.TypeOrIdentifier,
      name,
      position
    };
  }

  static createVariable(name: string, isSpecial: boolean, position: Position): VariableNode {
    return {
      type: NodeType.Variable,
      name,
      position
    };
  }

  static createBinary(
    operator: TokenType,
    left: ASTNode,
    right: ASTNode,
    position: Position,
    operation?: Operation
  ): BinaryNode {
    return {
      type: NodeType.Binary,
      operator,
      operation,
      left,
      right,
      position
    };
  }

  static createUnary(
    operator: TokenType,
    operand: ASTNode,
    position: Position,
    operation?: Operation
  ): UnaryNode {
    return {
      type: NodeType.Unary,
      operator,
      operation,
      operand,
      position
    };
  }

  static createFunction(
    name: ASTNode,
    args: ASTNode[],
    position: Position,
    operation?: Operation
  ): FunctionNode {
    return {
      type: NodeType.Function,
      name,
      arguments: args,
      operation,
      position
    };
  }

  static createUnion(operands: ASTNode[], position: Position): UnionNode {
    return {
      type: NodeType.Union,
      operands,
      position
    };
  }

  static createIndex(expression: ASTNode, index: ASTNode, position: Position): IndexNode {
    return {
      type: NodeType.Index,
      expression,
      index,
      position
    };
  }

  static createCollection(elements: ASTNode[], position: Position): CollectionNode {
    return {
      type: NodeType.Collection,
      elements,
      position
    };
  }

  static createMembershipTest(
    expression: ASTNode,
    targetType: string,
    position: Position
  ): MembershipTestNode {
    return {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      position
    };
  }

  static createTypeCast(
    expression: ASTNode,
    targetType: string,
    position: Position
  ): TypeCastNode {
    return {
      type: NodeType.TypeCast,
      expression,
      targetType,
      position
    };
  }

  static createTypeReference(name: string, position: Position): TypeReferenceNode {
    return {
      type: NodeType.TypeReference,
      typeName: name,
      position
    };
  }

  static createError(
    position: Position,
    expectedTokens: TokenType[],
    diagnostic: Diagnostic
  ): ErrorNode {
    return {
      type: NodeType.Error,
      position,
      expectedTokens,
      diagnostic
    };
  }

  static createIncomplete(
    partialNode: ASTNode | undefined,
    missingParts: string[],
    position: Position
  ): IncompleteNode {
    return {
      type: NodeType.Incomplete,
      partialNode,
      missingParts,
      position
    };
  }

  /**
   * Infer literal type from value
   */
  static inferLiteralType(value: any): 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null' {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (value instanceof Date) {
      // Check if it has time component
      const hasTime = value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
      return hasTime ? 'datetime' : 'date';
    }
    // Check for time-only values (stored as strings like "14:30:00")
    if (typeof value === 'object' && value.type === 'time') return 'time';
    return 'string'; // default
  }
}