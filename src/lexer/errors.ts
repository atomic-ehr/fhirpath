import type { Position } from './token';

export class LexerError extends Error {
  constructor(
    message: string,
    public position: Position,
    public char?: string
  ) {
    super(message);
    this.name = 'LexerError';
  }

  override toString(): string {
    const location = `${this.position.line}:${this.position.column}`;
    const charInfo = this.char ? ` (found '${this.char}')` : '';
    return `${this.name}: ${this.message} at ${location}${charInfo}`;
  }
}

export function formatError(error: LexerError, input: string): string {
  const lines = input.split('\n');
  const line = lines[error.position.line - 1] || '';
  const pointer = ' '.repeat(error.position.column - 1) + '^';
  
  return [
    error.toString(),
    '',
    line,
    pointer
  ].join('\n');
}