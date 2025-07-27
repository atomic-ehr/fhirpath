import type { Token } from '../lexer/token';
import type { Position } from './ast';

/**
 * Error thrown during parsing
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public position: Position,
    public token: Token
  ) {
    super(message);
    this.name = 'ParseError';
  }
}