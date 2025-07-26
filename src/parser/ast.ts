import type { TokenType, Token } from '../lexer/token';
import type { TextRange } from './types';
import type { ParseDiagnostic } from './types';

// Core AST Node Interface
export interface ASTNode {
  type: NodeType;
  position: Position;
  range?: TextRange;     // Full text range (populated in diagnostic modes)
  // Type analysis fields (optional - added by analyzer)
  resultType?: unknown;  // Opaque type reference
  isSingleton?: boolean; // Whether this expression returns a single value
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

// Node types
export enum NodeType {
  // Navigation
  Identifier,
  TypeOrIdentifier, // Uppercase identifiers that could be types (Patient, Observation)
  
  // Operators
  Binary,     // All binary operators including dot
  Unary,      // unary +, -, not
  Union,      // | operator (special handling for multiple operands)
  
  // Functions
  Function,   // Function calls
  
  // Literals
  Literal,    // numbers, strings, booleans, dates, null
  Variable,   // $this, $index, $total, %var
  Collection, // {} empty collection or {expr1, expr2, ...}
  
  // Type operations
  MembershipTest, // 'is' operator
  TypeCast,       // 'as' operator
  TypeReference,  // Type name in ofType()
  
  // Special
  Index,      // [] indexing
  
  // Error recovery
  Error = 'Error',           // Error recovery node
  Incomplete = 'Incomplete'  // Incomplete expression node
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
  raw?: string;        // Raw string representation
  operation?: any;     // Operation from registry (using any to avoid circular dependency)
}

export interface BinaryNode extends ASTNode {
  type: NodeType.Binary;
  operator: TokenType;
  operation?: any;     // Operation from registry (using any to avoid circular dependency)
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryNode extends ASTNode {
  type: NodeType.Unary;
  operator: TokenType;
  operation?: any;     // Operation from registry (using any to avoid circular dependency)
  operand: ASTNode;
}

export interface FunctionNode extends ASTNode {
  type: NodeType.Function;
  name: ASTNode;  // Usually an identifier
  arguments: ASTNode[];
  operation?: any;     // Operation from registry (using any to avoid circular dependency)
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

export interface UnionNode extends ASTNode {
  type: NodeType.Union;
  operands: ASTNode[];
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

// Error recovery nodes
export interface ErrorNode extends ASTNode {
  type: NodeType.Error;
  expectedTokens?: TokenType[];
  actualToken?: Token;
  diagnostic: ParseDiagnostic;
}

export interface IncompleteNode extends ASTNode {
  type: NodeType.Incomplete;
  partialNode?: ASTNode;
  missingParts: string[];
}