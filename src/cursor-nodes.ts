import type { BaseASTNode } from './types';

export enum CursorContext {
  Operator = 'operator',
  Identifier = 'identifier',
  Argument = 'argument',
  Index = 'index',
  Type = 'type',
}

export interface CursorNode extends BaseASTNode {
  type: 'CursorNode';
  context: CursorContext;
  position: number;
}

export interface CursorOperatorNode extends CursorNode {
  context: CursorContext.Operator;
}

export interface CursorIdentifierNode extends CursorNode {
  context: CursorContext.Identifier;
  partialText?: string;
}

export interface CursorArgumentNode extends CursorNode {
  context: CursorContext.Argument;
  functionName: string;
  argumentIndex: number;
}

export interface CursorIndexNode extends CursorNode {
  context: CursorContext.Index;
}

export interface CursorTypeNode extends CursorNode {
  context: CursorContext.Type;
  typeOperator: 'is' | 'as' | 'ofType';
}

export type AnyCursorNode = 
  | CursorOperatorNode
  | CursorIdentifierNode
  | CursorArgumentNode
  | CursorIndexNode
  | CursorTypeNode;

export function isCursorNode(node: any): node is CursorNode {
  return node && node.type === 'CursorNode';
}

export function createCursorOperatorNode(position: number): CursorOperatorNode {
  const point = { line: 0, character: position, offset: position };
  return {
    type: 'CursorNode',
    context: CursorContext.Operator,
    position,
    range: { start: point, end: point },
  };
}

export function createCursorIdentifierNode(position: number, partialText?: string): CursorIdentifierNode {
  const point = { line: 0, character: position, offset: position };
  return {
    type: 'CursorNode',
    context: CursorContext.Identifier,
    position,
    partialText,
    range: { start: point, end: point },
  };
}

export function createCursorArgumentNode(
  position: number,
  functionName: string,
  argumentIndex: number
): CursorArgumentNode {
  const point = { line: 0, character: position, offset: position };
  return {
    type: 'CursorNode',
    context: CursorContext.Argument,
    position,
    functionName,
    argumentIndex,
    range: { start: point, end: point },
  };
}

export function createCursorIndexNode(position: number): CursorIndexNode {
  const point = { line: 0, character: position, offset: position };
  return {
    type: 'CursorNode',
    context: CursorContext.Index,
    position,
    range: { start: point, end: point },
  };
}

export function createCursorTypeNode(
  position: number,
  typeOperator: 'is' | 'as' | 'ofType'
): CursorTypeNode {
  const point = { line: 0, character: position, offset: position };
  return {
    type: 'CursorNode',
    context: CursorContext.Type,
    position,
    typeOperator,
    range: { start: point, end: point },
  };
}