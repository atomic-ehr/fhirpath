import type { ASTNode } from './ast';
import type { ErrorCode } from '../api/errors';

export enum ParserMode {
  Fast = 'fast',
  Standard = 'standard',
  Diagnostic = 'diagnostic',
  Validate = 'validate'
}

export interface ParserOptions {
  mode?: ParserMode;
  maxErrors?: number;
}

export type ParseResult = FastParseResult | StandardParseResult | DiagnosticParseResult | ValidationResult;

export interface FastParseResult {
  ast: ASTNode;
}

export interface StandardParseResult {
  ast: ASTNode;
  diagnostics: ParseDiagnostic[];
  hasErrors: boolean;
}

export interface DiagnosticParseResult extends StandardParseResult {
  isPartial: boolean;
  ranges: Map<ASTNode, TextRange>;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: ParseDiagnostic[];
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