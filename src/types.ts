// Precedence levels (higher number = higher precedence)
export enum PRECEDENCE {
  // Lowest precedence
  IMPLIES = 10,
  OR = 20,
  XOR = 30,
  AND = 40,
  IN_CONTAINS = 50,
  EQUALITY = 60,      // =, !=, ~, !~
  COMPARISON = 70,    // <, >, <=, >=
  PIPE = 80,          // |
  ADDITIVE = 90,      // +, -
  MULTIPLICATIVE = 100, // *, /, div, mod
  UNARY = 110,        // unary +, -, not
  AS_IS = 120,        // as, is
  POSTFIX = 130,      // []
  DOT = 140,          // . (highest)
}

export type FHIRPathType = 'String' | 'Boolean' | 'Date' | 'DateTime' | 'Long' | 'Decimal' | 'Integer' | 'Time' | 'Quantity' | 'Any';

export interface TypeSignature {
  type: FHIRPathType;
  singleton: boolean;
}

export interface OperatorSignature {
  name: string;
  left: TypeSignature;
  right: TypeSignature;
  result: TypeSignature;
}

export interface OperatorDefinition {
  symbol: string;
  name: string;
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

export interface FunctionDefinition {
  name: string;
  category: string[];
  description: string;
  examples: string[];
  signature: {
    input: TypeSignature;
    parameters: Array<{
      name: string;
      optional?: boolean;
      type: TypeSignature;
    }>;
    result: TypeSignature;
  };
  evaluate: FunctionEvaluator;
}

// Node types enum - string-based for better debugging
export enum NodeType {
  EOF = 'EOF',
  Binary = 'Binary',
  Unary = 'Unary',
  TypeOrIdentifier = 'TypeOrIdentifier',
  Identifier = 'Identifier',
  Literal = 'Literal',
  Function = 'Function',
  Variable = 'Variable',
  Index = 'Index',
  MembershipTest = 'MembershipTest',
  TypeCast = 'TypeCast',
  Collection = 'Collection',
  TypeReference = 'TypeReference',
}

// Position tracking
export interface Position {
  line: number;
  column: number;
  offset: number;
}

// Base node interfaces
export interface BaseASTNode {
  type: NodeType;
  position?: Position; // Make position optional for flexibility
}

export interface ASTNode {
  type: NodeType;
  offset?: number;  // Just the start offset for basic error reporting
  position?: Position; // Make position optional to satisfy BaseASTNode constraint
}

// Specific node types
export interface IdentifierNode extends ASTNode {
  type: NodeType.Identifier;
  name: string;
}

export interface TypeOrIdentifierNode extends ASTNode {
  type: NodeType.TypeOrIdentifier;
  name: string;
}

export interface LiteralNode extends ASTNode {
  type: NodeType.Literal;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null';
}

export interface BinaryNode extends ASTNode {
  type: NodeType.Binary;
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryNode extends ASTNode {
  type: NodeType.Unary;
  operator: string;
  operand: ASTNode;
}

export interface FunctionNode extends ASTNode {
  type: NodeType.Function;
  name: ASTNode;
  arguments: ASTNode[];
}

export interface VariableNode extends ASTNode {
  type: NodeType.Variable;
  name: string;
}

export interface IndexNode extends ASTNode {
  type: NodeType.Index;
  expression: ASTNode;
  index: ASTNode;
}

export interface MembershipTestNode extends ASTNode {
  type: NodeType.MembershipTest;
  expression: ASTNode;
  targetType: string;
}

export interface TypeCastNode extends ASTNode {
  type: NodeType.TypeCast;
  expression: ASTNode;
  targetType: string;
}

export interface CollectionNode extends ASTNode {
  type: NodeType.Collection;
  elements: ASTNode[];
}

export interface TypeReferenceNode extends ASTNode {
  type: NodeType.TypeReference;
  typeName: string;
}

export interface RuntimeContext {
  input: any[];
  focus: any[];
  variables: Record<string, any>;
}// Evaluation result - everything is a collection

export interface EvaluationResult {
  value: any[];
  context: RuntimeContext;
}

export type NodeEvaluator = (node: ASTNode, input: any[], context: RuntimeContext) => EvaluationResult;

export type OperationEvaluator = (input: any[], context: RuntimeContext, ...args: any[]) => EvaluationResult;

export type FunctionEvaluator = (
  input: any[],
  context: RuntimeContext,
  args: ASTNode[],
  evaluator: (node: ASTNode, input: any[], context: RuntimeContext) => EvaluationResult
) => EvaluationResult;

