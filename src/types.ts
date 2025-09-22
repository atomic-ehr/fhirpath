import type { FHIRPathValue } from './interpreter/boxing';
import type { Token, TokenType } from './lexer';
import type { AnyCursorNode } from './parser/cursor-nodes';

// Precedence levels (higher number = higher precedence)
export enum PRECEDENCE {
  // Lowest precedence
  IMPLIES = 10,
  OR = 20,
  XOR = 30,
  AND = 40,
  IN_CONTAINS = 50,
  AS_IS = 55,         // as, is (moved to lower precedence)
  EQUALITY = 60,      // =, !=, ~, !~
  PIPE = 65,          // | (moved to lower precedence) 
  COMPARISON = 70,    // <, >, <=, >=
  ADDITIVE = 90,      // +, -
  MULTIPLICATIVE = 100, // *, /, div, mod
  UNARY = 110,        // unary +, -, not
  POSTFIX = 130,      // []
  DOT = 140,          // . (highest)
}

export type TypeName = 'Any' | 'Boolean' | 'String' | 'Integer' | 'Long' | 'Decimal' | 'Date' | 'DateTime' | 'Time' | 'Quantity';

export interface TypeInfo<TypeContext = unknown> {
  // FHIRPath type
  type: TypeName;
  singleton?: boolean;
  
  // Indicates this is definitely an empty collection
  isEmpty?: boolean;

  // Model type information FHIR.Patient; FHIR.string; 
  namespace?: string;
  name?: string;

  // opaque context for model provider
  modelContext?: TypeContext;
}

// Model Provider Interface (from ADR-004)
export interface ModelProvider<TypeContext = unknown> {
  getType(typeName: string): Promise<TypeInfo<TypeContext> | undefined>;
  
  // get element type from complex type
  getElementType(parentType: TypeInfo<TypeContext>, propertyName: string): Promise<TypeInfo<TypeContext> | undefined>;

  // get type from union type
  ofType(type: TypeInfo<TypeContext>, typeName: TypeName): TypeInfo<TypeContext> | undefined;

  // get element names from complex type
  getElementNames(parentType: TypeInfo<TypeContext>): string[];

  // Returns a union type of all possible child element types
  getChildrenType(parentType: TypeInfo<TypeContext>): Promise<TypeInfo<TypeContext> | undefined>;

  // Get detailed information about elements of a type for completion suggestions
  getElements(typeName: string): Promise<Array<{
    name: string;
    type: string;
    documentation?: string;
  }>>;

  // Get list of all resource types (now async for clean design)
  getResourceTypes(): Promise<string[]>;
  
  // Get list of all complex types
  getComplexTypes(): Promise<string[]>;
  
  // Get list of all primitive types
  getPrimitiveTypes(): Promise<string[]>;
}

export interface OperatorSignature {
  name: string;
  left: TypeInfo;
  right: TypeInfo;
  result: TypeInfo | 'inputType' | 'leftType' | 'rightType';
}

export interface OperatorDefinition {
  symbol: string;
  name: string;
  doesNotPropagateEmpty?: boolean;
  category: string[];
  precedence: PRECEDENCE;
  associativity: 'left' | 'right';
  description: string;
  examples: string[];
  signatures: OperatorSignature[];
  evaluate: OperationEvaluator;
}

export interface RegisteredOperator extends OperatorDefinition {
}

export interface FunctionSignature {
  name: string;
  input: TypeInfo;
  parameters: Array<{
    name: string;
    optional?: boolean;
    type: TypeInfo;
    expression?: boolean;
    typeReference?: boolean; // When true, this parameter expects a type name (e.g., ofType(Patient))
  }>;
  result: TypeInfo | 'inputType' | 'inputTypeSingleton' | 'parameterType';
  variadic?: boolean; // When true, the function accepts variable number of arguments
}

export interface FunctionDefinition {
  name: string;
  category: string[];
  description: string;
  examples: string[];
  signatures: FunctionSignature[];
  evaluate: FunctionEvaluator;
  inferResultType?: (
    analyzer: any,
    node: any,
    inputType?: TypeInfo
  ) => Promise<TypeInfo>;
  analyze?: (
    context: AnalysisContext,
    args: ASTNode[]
  ) => Promise<InternalAnalysisResult> | InternalAnalysisResult;
  doesNotPropagateEmpty?: boolean;  // When true, function doesn't propagate empty collections
}

// Node types enum - string-based for better debugging
export enum NodeType {
  EOF = 'EOF',
  Binary = 'Binary',
  Unary = 'Unary',
  Identifier = 'Identifier',
  Literal = 'Literal',
  TemporalLiteral = 'TemporalLiteral',
  Function = 'Function',
  Variable = 'Variable',
  Index = 'Index',
  MembershipTest = 'MembershipTest',
  TypeCast = 'TypeCast',
  Collection = 'Collection',
  TypeReference = 'TypeReference',
  Quantity = 'Quantity',
}

// LSP-compatible position (zero-based line and character)
export interface Position {
  line: number;      // zero-based line number (uinteger in LSP)
  character: number; // zero-based character offset within line (uinteger in LSP)
  offset?: number;   // absolute offset in source (optional, for compatibility)
}

// LSP-compatible Range
export interface Range {
  start: Position;
  end: Position;
}

// LSP SymbolKind enum (subset of LSP spec)
export enum SymbolKind {
  Function = 12,
  Variable = 13,
  Property = 7,
  Field = 8,
  Method = 6,
}

// Trivia information for preserving formatting
export interface TriviaInfo {
  type: 'whitespace' | 'comment' | 'lineComment';
  value: string;
  range: Range;
}

// Parser options to control what gets populated
export interface ParserOptions {
  mode?: 'production' | 'development';
  preserveTrivia?: boolean;      // Populate trivia arrays
  buildNavigation?: boolean;     // Populate parent/children
  preserveSource?: boolean;      // Populate raw text
  generateIds?: boolean;         // Generate unique IDs
  addSymbolInfo?: boolean;       // Add symbolKind for LSP
}

// Base structure for all AST nodes
export interface BaseASTNode {
  // Core properties - always present
  type: NodeType | 'Error' | 'CursorNode';
  
  // LSP-compatible range - always present for LSP features
  range: Range;
  
  // Optional rich information - populated based on parser options
  parent?: ASTNode;          // Parent reference
  children?: ASTNode[];      // Child nodes for navigation
  
  // Source preservation (useful for refactoring)
  leadingTrivia?: TriviaInfo[];  // Comments/whitespace before
  trailingTrivia?: TriviaInfo[]; // Comments/whitespace after
  raw?: string;                  // Original source text
  
  // Metadata for tools
  id?: string;               // Unique identifier for the node
  symbolKind?: SymbolKind;   // LSP SymbolKind for outline
  
  // Type information (populated by analyzer)
  typeInfo?: TypeInfo;       // Inferred type information
}

// Error node for LSP compatibility
export interface ErrorNode extends BaseASTNode {
  type: 'Error';
  message: string;
  expected?: string[];
  // LSP diagnostic info
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string; // e.g., 'fhirpath'
}

// Specific node types
export interface IdentifierNode extends BaseASTNode {
  type: NodeType.Identifier;
  name: string;
  // Optional LSP symbol info
  symbolKind?: SymbolKind.Variable | SymbolKind.Function | SymbolKind.Property;
}

export interface LiteralNode extends BaseASTNode {
  type: NodeType.Literal;
  value: any;
  valueType: 'string' | 'number' | 'decimal' | 'boolean' | 'date' | 'time' | 'datetime' | 'null';
}

export interface TemporalLiteralNode extends BaseASTNode {
  type: NodeType.TemporalLiteral;
  value: any; // The parsed temporal object
  valueType: 'date' | 'time' | 'datetime';
  rawValue: string; // The original string value (without @)
}

export interface BinaryNode extends BaseASTNode {
  type: NodeType.Binary;
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryNode extends BaseASTNode {
  type: NodeType.Unary;
  operator: string;
  operand: ASTNode;
}

export interface FunctionNode extends BaseASTNode {
  type: NodeType.Function;
  name: ASTNode;
  arguments: ASTNode[];
  // LSP-specific
  symbolKind?: SymbolKind.Function;
  detail?: string; // Function signature for hover/outline
}

export interface VariableNode extends BaseASTNode {
  type: NodeType.Variable;
  name: string;
}

export interface IndexNode extends BaseASTNode {
  type: NodeType.Index;
  expression: ASTNode;
  index: ASTNode;
}

export interface MembershipTestNode extends BaseASTNode {
  type: NodeType.MembershipTest;
  expression: ASTNode;
  targetType: string;
}

export interface TypeCastNode extends BaseASTNode {
  type: NodeType.TypeCast;
  expression: ASTNode;
  targetType: string;
}

export interface CollectionNode extends BaseASTNode {
  type: NodeType.Collection;
  elements: ASTNode[];
}

export interface TypeReferenceNode extends BaseASTNode {
  type: NodeType.TypeReference;
  typeName: string;
}

export interface QuantityNode extends BaseASTNode {
  type: NodeType.Quantity;
  value: number;
  unit: string;
}

// Unified ASTNode type - discriminated union
export type ASTNode = 
  | IdentifierNode
  | LiteralNode
  | TemporalLiteralNode
  | BinaryNode
  | UnaryNode
  | FunctionNode
  | VariableNode
  | IndexNode
  | MembershipTestNode
  | TypeCastNode
  | CollectionNode
  | TypeReferenceNode
  | QuantityNode
  | ErrorNode
  | AnyCursorNode;

export interface RuntimeContext {
  input: any[];
  focus: any[];
  variables: Record<string, any>;
  currentNode?: ASTNode;
  modelProvider?: ModelProvider;
}

// Evaluation result - everything is a collection of boxed values
export interface EvaluationResult {
  value: FHIRPathValue[];
  context: RuntimeContext;
}


export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string;
  source?: string;
  message: string;
  tags?: number[];
  relatedInformation?: any[];
  data?: any;
}

export interface AnalysisResult {
  diagnostics: Diagnostic[];
  ast: ASTNode;
  type?: TypeInfo;
  userVariables?: Map<string, TypeInfo>;
}

// Parse error type
export interface ParseError {
  message: string;
  position: Position;
  range?: Range;
  token?: Token;
}

// Parse result for parser
export interface ParseResult {
  ast: ASTNode;
  errors: ParseError[];
  indexes?: {
    nodeById: Map<string, ASTNode>;
    nodesByType: Map<NodeType | 'Error' | 'CursorNode', ASTNode[]>;
    identifiers: Map<string, ASTNode[]>;
  };
  cursorContext?: {
    node: ASTNode | null;
    expectedTokens: TokenType[];
    availableCompletions: string[];
  };
}

export type NodeEvaluator = (node: ASTNode, input: import('./interpreter/boxing').FHIRPathValue[], context: RuntimeContext) => Promise<EvaluationResult>;

export type OperationEvaluator = (input: import('./interpreter/boxing').FHIRPathValue[], context: RuntimeContext, ...args: any[]) => Promise<EvaluationResult>;

export type FunctionEvaluator = (
  input: import('./interpreter/boxing').FHIRPathValue[],
  context: RuntimeContext,
  args: ASTNode[],
  evaluator: (node: ASTNode, input: import('./interpreter/boxing').FHIRPathValue[], context: RuntimeContext) => Promise<EvaluationResult>
) => Promise<EvaluationResult>;

// Type guards for optional properties
export function hasParentNavigation(node: ASTNode): node is ASTNode & { parent: ASTNode; children: ASTNode[] } {
  return node.parent !== undefined && node.children !== undefined;
}

export function hasTrivia(node: ASTNode): node is ASTNode & { leadingTrivia: TriviaInfo[]; trailingTrivia: TriviaInfo[] } {
  return node.leadingTrivia !== undefined && node.trailingTrivia !== undefined;
}

export function hasSourceInfo(node: ASTNode): node is ASTNode & { raw: string } {
  return node.raw !== undefined;
}

export function hasSymbolKind(node: ASTNode): node is ASTNode & { symbolKind: SymbolKind } {
  return node.symbolKind !== undefined;
}

export function isErrorNode(node: ASTNode): node is ErrorNode {
  return node.type === 'Error';
}

export function isIdentifierNode(node: ASTNode): node is IdentifierNode {
  return node.type === NodeType.Identifier;
}

export function isFunctionNode(node: ASTNode): node is FunctionNode {
  return node.type === NodeType.Function;
}

/**
 * Result of analyzing a single AST node in the context-flow architecture.
 */
export interface InternalAnalysisResult {
  type: TypeInfo;
  diagnostics: Diagnostic[];
  context?: AnalysisContext;
}

/**
 * Immutable context that flows through the analysis tree.
 * Carries variable scopes and input types through the AST.
 */
export class AnalysisContext {
  constructor(
    public readonly inputType: TypeInfo,
    public readonly systemVariables: ReadonlyMap<string, TypeInfo>,
    public readonly userVariables: ReadonlyMap<string, TypeInfo>,
    private readonly analyzeNodeCallback: (node: ASTNode, ctx: AnalysisContext) => Promise<InternalAnalysisResult>,
    public readonly modelProvider?: ModelProvider,
    public readonly hasDynamicVariables: boolean = false,
    public readonly _chainHead: boolean = true
  ) {}

  withUserVariable(name: string, type: TypeInfo): AnalysisContext {
    const newUserVars = new Map(this.userVariables);
    newUserVars.set(name, type);
    return new AnalysisContext(
      this.inputType,
      this.systemVariables,
      newUserVars,
      this.analyzeNodeCallback,
      this.modelProvider,
      this.hasDynamicVariables,
      this._chainHead
    );
  }

  withSystemVariable(name: string, type: TypeInfo): AnalysisContext {
    const newSystemVars = new Map(this.systemVariables);
    newSystemVars.set(name, type);
    return new AnalysisContext(
      this.inputType,
      newSystemVars,
      this.userVariables,
      this.analyzeNodeCallback,
      this.modelProvider,
      this.hasDynamicVariables,
      this._chainHead
    );
  }

  withInputType(type: TypeInfo): AnalysisContext {
    return new AnalysisContext(
      type,
      this.systemVariables,
      this.userVariables,
      this.analyzeNodeCallback,
      this.modelProvider,
      this.hasDynamicVariables,
      false
    );
  }

  withDynamicVariables(): AnalysisContext {
    return new AnalysisContext(
      this.inputType,
      this.systemVariables,
      this.userVariables,
      this.analyzeNodeCallback,
      this.modelProvider,
      true,
      this._chainHead
    );
  }

  fork(): AnalysisContext {
    return new AnalysisContext(
      this.inputType,
      new Map(this.systemVariables),
      new Map(this.userVariables),
      this.analyzeNodeCallback,
      this.modelProvider,
      this.hasDynamicVariables,
      this._chainHead
    );
  }

  analyzeNode(node: ASTNode): Promise<InternalAnalysisResult> {
    return this.analyzeNodeCallback(node, this);
  }
}
