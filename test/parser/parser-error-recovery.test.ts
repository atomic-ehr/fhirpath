import { describe, it, expect } from 'bun:test';
import { Parser, type ParserOptions } from '../../src/parser';
import { TokenType } from '../../src/lexer';

class TestableParser extends Parser {
  // Expose protected consume for testing error-recovery behavior
  public testConsume(type: TokenType, message: string) {
    return this.consume(type, message);
  }
}

function make(options: Partial<ParserOptions> = {}) {
  return new TestableParser('1 + 2', { mode: 'lsp', errorRecovery: true, ...options });
}

describe('Parser error recovery – consume() returns synthetic Token', () => {
  it('returns a zero-width synthetic Token of expected type in LSP recovery', () => {
    const p = make();
    const r: any = p.testConsume(TokenType.RPAREN, "Expected ')'");
    expect(typeof r).toBe('object');
    expect(r).toBeTruthy();
    expect(r.type).toBe(TokenType.RPAREN);
    expect(typeof r.start).toBe('number');
    expect(typeof r.end).toBe('number');
    expect(r.end - r.start).toBe(0);
  });

  it('produces a token-like shape with range info', () => {
    const p = make();
    const r: any = p.testConsume(TokenType.RBRACE, "Expected '}'");
    expect(r).toHaveProperty('start');
    expect(r).toHaveProperty('end');
    expect(r).toHaveProperty('range');
    expect(r.type).toBe(TokenType.RBRACE);
  });

  it('throws in simple mode (no recovery)', () => {
    const p = new TestableParser('1 + 2'); // default mode is simple
    expect(() => {
      p.testConsume(TokenType.RPAREN, "Expected ')'");
    }).toThrowError();
  });
});
