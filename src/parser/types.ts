import type { ASTNode } from './ast';
import type { ErrorCode } from '../api/errors';

export enum ParserMode {
  Standard = 'standard',
  Diagnostic = 'diagnostic'
}

export interface ParserOptions {
  mode?: ParserMode;
  maxErrors?: number;
  throwOnError?: boolean;  // When true, throws on first error instead of collecting diagnostics
}

export type ParseResult = StandardParseResult | DiagnosticParseResult;

export interface StandardParseResult {
  ast: ASTNode;
  diagnostics: ParseDiagnostic[];
  hasErrors: boolean;
}

export interface DiagnosticParseResult extends StandardParseResult {
  isPartial: boolean;
  ranges: Map<ASTNode, TextRange>;
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