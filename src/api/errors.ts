import type { Location } from './types';

export enum ErrorCode {
  // Parse errors
  PARSE_ERROR = 'PARSE_ERROR',
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  UNEXPECTED_TOKEN = 'UNEXPECTED_TOKEN',
  UNTERMINATED_STRING = 'UNTERMINATED_STRING',
  INVALID_ESCAPE = 'INVALID_ESCAPE',
  
  // Parser-specific error codes
  UNCLOSED_PARENTHESIS = 'UNCLOSED_PARENTHESIS',
  UNCLOSED_BRACKET = 'UNCLOSED_BRACKET',
  UNCLOSED_BRACE = 'UNCLOSED_BRACE',
  MISSING_ARGUMENTS = 'MISSING_ARGUMENTS',
  INVALID_OPERATOR = 'INVALID_OPERATOR',
  EXPECTED_EXPRESSION = 'EXPECTED_EXPRESSION',
  EXPECTED_IDENTIFIER = 'EXPECTED_IDENTIFIER',
  MULTIPLE_ERRORS = 'MULTIPLE_ERRORS',
  INVALID_CHARACTER = 'INVALID_CHARACTER',
  
  // Type errors
  TYPE_ERROR = 'TYPE_ERROR',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  UNKNOWN_TYPE = 'UNKNOWN_TYPE',
  CARDINALITY_ERROR = 'CARDINALITY_ERROR',
  
  // Runtime errors
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  UNDEFINED_VARIABLE = 'UNDEFINED_VARIABLE',
  UNDEFINED_FUNCTION = 'UNDEFINED_FUNCTION',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  
  // Analysis errors
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',
  UNREACHABLE_CODE = 'UNREACHABLE_CODE',
  AMBIGUOUS_TYPE = 'AMBIGUOUS_TYPE',
}

export class FHIRPathError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public location?: Location,
    public expression?: string
  ) {
    super(message);
    this.name = 'FHIRPathError';
    
    // Ensure proper prototype chain
    Object.setPrototypeOf(this, FHIRPathError.prototype);
  }
  
  override toString(): string {
    let result = `${this.name}: ${this.message}`;
    
    if (this.expression && this.location) {
      result += `\n\n${this.expression}`;
      if (this.location.offset >= 0 && this.location.length > 0) {
        const indent = ' '.repeat(this.location.offset);
        const marker = '^'.repeat(this.location.length);
        result += `\n${indent}${marker}`;
      }
    }
    
    if (this.location) {
      result += `\n\nAt line ${this.location.line}, column ${this.location.column}`;
    }
    
    return result;
  }
}

// Error factory functions
export function parseError(
  message: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(message, ErrorCode.PARSE_ERROR, location, expression);
}

export function syntaxError(
  message: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(message, ErrorCode.SYNTAX_ERROR, location, expression);
}

export function typeError(
  message: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(message, ErrorCode.TYPE_ERROR, location, expression);
}

export function runtimeError(
  message: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(message, ErrorCode.RUNTIME_ERROR, location, expression);
}

export function undefinedVariable(
  name: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(
    `Undefined variable: ${name}`,
    ErrorCode.UNDEFINED_VARIABLE,
    location,
    expression
  );
}

export function undefinedFunction(
  name: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(
    `Undefined function: ${name}`,
    ErrorCode.UNDEFINED_FUNCTION,
    location,
    expression
  );
}

export function invalidArgument(
  message: string,
  location?: Location,
  expression?: string
): FHIRPathError {
  return new FHIRPathError(
    `Invalid argument: ${message}`,
    ErrorCode.INVALID_ARGUMENT,
    location,
    expression
  );
}