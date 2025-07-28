import type { Token } from '../lexer/token';
import type { Position } from './ast';
import { ParseError } from './parser';
import { ErrorCode } from '../api/errors';
import type { DiagnosticCollector } from './diagnostics';
import type { SourceMapper } from './source-mapper';

/**
 * Factory for creating parser errors with consistent formatting
 */
export class ParserErrorFactory {
  constructor(
    private throwOnError: boolean,
    private diagnostics?: DiagnosticCollector,
    private sourceMapper?: SourceMapper
  ) {}

  /**
   * Create a parse error with proper formatting
   */
  createError(message: string, token: Token, code: ErrorCode = ErrorCode.PARSE_ERROR): ParseError {
    if (this.diagnostics && this.sourceMapper && !this.throwOnError) {
      // In diagnostic mode, add to diagnostics and return error
      const range = this.sourceMapper.tokenToRange(token);
      this.diagnostics.addError(range, message, code);
    }
    
    const pos = token.position;
    const fullMessage = `${message} at line ${pos.line}, column ${pos.column}`;
    return new ParseError(fullMessage, pos, token);
  }

  /**
   * Create error for unexpected token
   */
  unexpectedToken(token: Token, expected?: string): ParseError {
    const message = expected 
      ? `Expected ${expected}, found '${token.value}'`
      : `Unexpected token '${token.value}'`;
    return this.createError(message, token, ErrorCode.UNEXPECTED_TOKEN);
  }

  /**
   * Create error for missing token
   */
  missingToken(expected: string, token: Token, code: ErrorCode = ErrorCode.UNEXPECTED_TOKEN): ParseError {
    return this.createError(`Expected ${expected}`, token, code);
  }

  /**
   * Create error for unclosed delimiter
   */
  unclosedDelimiter(openToken: Token, expected: string): ParseError {
    const code = expected === ')' ? ErrorCode.UNCLOSED_PARENTHESIS :
                 expected === ']' ? ErrorCode.UNCLOSED_BRACKET :
                 expected === '}' ? ErrorCode.UNCLOSED_BRACE :
                 ErrorCode.SYNTAX_ERROR;
    
    return this.createError(
      `Unclosed ${this.getDelimiterName(expected)} - missing '${expected}'`,
      openToken,
      code
    );
  }

  /**
   * Create error for invalid operator
   */
  invalidOperator(token: Token): ParseError {
    return this.createError(`Unknown operator: ${token.value}`, token, ErrorCode.INVALID_OPERATOR);
  }

  /**
   * Create error for missing arguments
   */
  missingArguments(functionName: string, token: Token): ParseError {
    return this.createError(
      `Function '${functionName}' requires arguments`,
      token,
      ErrorCode.MISSING_ARGUMENTS
    );
  }

  /**
   * Create error for expected identifier
   */
  expectedIdentifier(token: Token, context?: string): ParseError {
    const message = context 
      ? `Expected identifier ${context}`
      : `Expected identifier`;
    return this.createError(message, token, ErrorCode.EXPECTED_IDENTIFIER);
  }

  /**
   * Create error for expected expression
   */
  expectedExpression(token: Token, context?: string): ParseError {
    const message = context 
      ? `Expected expression ${context}`
      : `Expected expression`;
    return this.createError(message, token, ErrorCode.EXPECTED_EXPRESSION);
  }

  /**
   * Create error for double dot operator
   */
  doubleDotOperator(firstDot: Token, secondDot: Token): ParseError {
    const message = `Invalid '..' operator - use a single '.' for navigation`;
    if (this.diagnostics && this.sourceMapper) {
      const range = this.sourceMapper.mergeRanges(
        this.sourceMapper.tokenToRange(firstDot),
        this.sourceMapper.tokenToRange(secondDot)
      );
      this.diagnostics.addError(range, message, ErrorCode.INVALID_OPERATOR);
    }
    return this.createError(message, firstDot, ErrorCode.INVALID_OPERATOR);
  }

  /**
   * Create error for invalid escape sequence
   */
  invalidEscape(token: Token, sequence: string): ParseError {
    return this.createError(
      `Invalid escape sequence: ${sequence}`,
      token,
      ErrorCode.INVALID_ESCAPE
    );
  }

  /**
   * Get human-readable name for delimiter
   */
  private getDelimiterName(delimiter: string): string {
    switch (delimiter) {
      case ')': return 'parenthesis';
      case ']': return 'bracket';
      case '}': return 'brace';
      default: return 'delimiter';
    }
  }
}