import type { ASTNode } from './ast';
import type { ErrorCode } from '../api/errors';

export interface ParserOptions {
  maxErrors?: number;
  throwOnError?: boolean;      // When true, throws on first error instead of collecting diagnostics
  trackRanges?: boolean;        // Enable source range tracking for each AST node (useful for IDEs)
  errorRecovery?: boolean;      // Enable error recovery to continue parsing after errors (useful for IDEs)
}

export interface ParseResult {
  ast: ASTNode;
  diagnostics: ParseDiagnostic[];
  hasErrors: boolean;
  isPartial?: boolean;                    // Present when errorRecovery is enabled
  ranges?: Map<ASTNode, TextRange>;       // Present when trackRanges is enabled
}

export interface ParseDiagnostic {
  range: TextRange;
  severity: DiagnosticSeverity;
  code: ErrorCode;
  message: string;
  source: 'fhirpath-parser';
  relatedInformation?: RelatedInformation[];
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

export interface TextRange {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
  offset: number;
}

export interface RelatedInformation {
  location: TextRange;
  message: string;
}

export enum ParseContext {
  Expression,
  FunctionCall,
  IndexExpression,
  BinaryExpression,
  UnaryExpression,
  CollectionLiteral,
  TypeCast,
  MembershipTest
}