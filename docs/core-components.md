# FHIRPath Core Components Guide

This document provides detailed technical documentation for each core component of the FHIRPath TypeScript implementation.

## Table of Contents

1. [Lexer](#lexer)
2. [Parser](#parser)
3. [Interpreter](#interpreter)
4. [Analyzer](#analyzer)
5. [Registry](#registry)
6. [Type System](#type-system)

## Lexer

### Overview

The lexer (`src/lexer.ts`) is responsible for converting FHIRPath expression strings into a stream of tokens. It provides fast, position-aware tokenization with support for all FHIRPath syntax elements.

### Key Features

#### Token Types

```typescript
export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  DATETIME = 'DATETIME',
  TIME = 'TIME',
  
  // Identifiers
  IDENTIFIER = 'IDENTIFIER',
  DELIMITED_IDENTIFIER = 'DELIMITED_IDENTIFIER',
  SPECIAL_IDENTIFIER = 'SPECIAL_IDENTIFIER',      // $this, $index
  ENVIRONMENT_VARIABLE = 'ENVIRONMENT_VARIABLE',  // %variable
  
  // Operators
  OPERATOR = 'OPERATOR',  // All symbolic operators
  
  // Structural
  DOT = 'DOT',
  COMMA = 'COMMA',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  
  // Special
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT'
}
```

#### Position Tracking

The lexer maintains accurate position information for error reporting:

```typescript
interface Token {
  type: TokenType;
  value: string;
  start: number;  // Absolute offset
  end: number;    // Absolute offset
  line?: number;  // 1-based line number
  column?: number; // 1-based column number
  range?: Range;  // LSP-compatible range
}
```

#### Special Handling

1. **String Literals**: Supports both single and double quotes with escape sequences
2. **Date/Time Literals**: Recognizes `@` prefixed date/time values
3. **Delimited Identifiers**: Backtick-enclosed identifiers for reserved words
4. **Environment Variables**: `%` prefixed variables with special `%"string"` syntax

### Implementation Details

#### Tokenization Algorithm

```typescript
// Simplified tokenization flow
while (!isAtEnd()) {
  skipWhitespace();
  
  const char = peek();
  switch (char) {
    case '+': case '-': case '*': case '/':
      // Operator handling
      break;
    case "'": case '"':
      // String literal handling
      break;
    case '@':
      // Date/time literal handling
      break;
    default:
      if (isDigit(char)) {
        // Number handling
      } else if (isAlpha(char)) {
        // Identifier/keyword handling
      }
  }
}
```

#### Performance Optimizations

1. **Character Classification**: Fast character type checking using lookup tables
2. **Minimal Allocations**: Reuses token objects where possible
3. **Lazy Position Calculation**: Line/column calculated only when needed

### Usage Example

```typescript
const lexer = new Lexer('Patient.name.given');
const tokens = lexer.tokenize();
// Results in: [IDENTIFIER, DOT, IDENTIFIER, DOT, IDENTIFIER, EOF]
```

## Parser

### Overview

The parser (`src/parser.ts`, `src/parser-base.ts`) converts token streams into Abstract Syntax Trees (AST) using a precedence climbing algorithm.

### Architecture

#### Base Parser Pattern

```typescript
abstract class BaseParser<TNode> {
  // Token management
  protected advance(): Token
  protected peek(): Token
  protected previous(): Token
  
  // Parsing methods
  protected expression(): TNode
  protected binaryExpression(minPrecedence: number): TNode
  
  // Abstract methods for node creation
  protected abstract createBinaryNode(token: Token, left: TNode, right: TNode): TNode
  protected abstract createUnaryNode(token: Token, operand: TNode): TNode
  // ...
}
```

#### Precedence Climbing

The parser uses precedence values to handle operator priority:

```typescript
export enum PRECEDENCE {
  IMPLIES = 10,       // lowest
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
```

### Dual Mode Operation

#### Simple Mode

- Optimized for runtime evaluation
- Throws on first error
- Minimal memory overhead
- No position tracking beyond basics

#### LSP Mode

- Rich parsing for IDE support
- Error recovery and synchronization
- Maintains node indexes
- Preserves trivia (comments, whitespace)
- Tracks parent-child relationships

```typescript
interface ParseResult {
  ast: ASTNode;
  errors: ParseError[];
  indexes?: {
    nodeById: Map<string, ASTNode>;
    nodesByType: Map<NodeType, ASTNode[]>;
    identifiers: Map<string, ASTNode[]>;
  };
  cursorContext?: {
    node: ASTNode | null;
    expectedTokens: TokenType[];
    availableCompletions: string[];
  };
}
```

### AST Structure

#### Node Types

```typescript
export enum NodeType {
  // Literals
  Literal = 'Literal',
  
  // Identifiers
  Identifier = 'Identifier',
  TypeOrIdentifier = 'TypeOrIdentifier',
  
  // Operations
  Binary = 'Binary',
  Unary = 'Unary',
  
  // Navigation
  Function = 'Function',
  Index = 'Index',
  
  // Type operations
  TypeCast = 'TypeCast',
  MembershipTest = 'MembershipTest',
  
  // Collections
  Collection = 'Collection',
  
  // Variables
  Variable = 'Variable',
  
  // Error recovery
  Error = 'Error'
}
```

#### Base Node Structure

```typescript
interface BaseASTNode {
  type: NodeType | 'Error';
  range: Range;  // Source position
  
  // Optional LSP features
  parent?: ASTNode;
  children?: ASTNode[];
  leadingTrivia?: TriviaInfo[];
  trailingTrivia?: TriviaInfo[];
  raw?: string;  // Original source text
  id?: string;   // Unique identifier
  
  // Type information (added by analyzer)
  typeInfo?: TypeInfo;
}
```

### Error Recovery

In LSP mode, the parser implements sophisticated error recovery:

```typescript
private synchronize(): void {
  // Skip tokens until we find a synchronization point
  while (!this.isAtEnd()) {
    if (this.synchronizationTokens.has(this.peek().type)) {
      return;
    }
    this.advance();
  }
}

private readonly synchronizationTokens = new Set([
  TokenType.COMMA,
  TokenType.RPAREN,
  TokenType.RBRACE,
  TokenType.RBRACKET,
  TokenType.EOF
]);
```

## Interpreter

### Overview

The interpreter (`src/interpreter.ts`) evaluates AST nodes to produce results. It implements the FHIRPath semantics including collection handling, type coercion, and function evaluation.

### Key Components

#### RuntimeContext Management

```typescript
export interface RuntimeContext {
  input: any[];      // Original input collection
  focus: any[];      // Current focus (changes during navigation)
  variables: Record<string, any>;  // All variables
}

export class RuntimeContextManager {
  // O(1) context creation using prototypes
  static extend(parent: RuntimeContext): RuntimeContext {
    return Object.create(parent);
  }
  
  static setVariable(context: RuntimeContext, name: string, value: any): RuntimeContext {
    const newContext = this.extend(context);
    newContext.variables = Object.create(context.variables);
    newContext.variables[name] = value;
    return newContext;
  }
}
```

#### Visitor Pattern Implementation

```typescript
export class Interpreter {
  private readonly visitors: Record<string, NodeEvaluator> = {
    [NodeType.Literal]: this.visitLiteral.bind(this),
    [NodeType.Identifier]: this.visitIdentifier.bind(this),
    [NodeType.Binary]: this.visitBinary.bind(this),
    [NodeType.Unary]: this.visitUnary.bind(this),
    [NodeType.Function]: this.visitFunction.bind(this),
    [NodeType.Variable]: this.visitVariable.bind(this),
    [NodeType.Index]: this.visitIndex.bind(this),
    [NodeType.Collection]: this.visitCollection.bind(this),
    [NodeType.TypeCast]: this.visitTypeCast.bind(this),
    [NodeType.MembershipTest]: this.visitMembershipTest.bind(this)
  };
  
  evaluate(node: ASTNode, input: any[], context?: RuntimeContext): EvaluationResult {
    const visitor = this.visitors[node.type];
    if (!visitor) {
      throw new Error(`No visitor for node type: ${node.type}`);
    }
    return visitor(node, input, context || this.createInitialContext(input));
  }
}
```

### Special Handling

#### Navigation (Dot Operator)

The dot operator has special semantics in FHIRPath:

```typescript
private visitBinary(node: BinaryNode, input: any[], context: RuntimeContext): EvaluationResult {
  if (node.operator === '.') {
    // Special handling for navigation
    const leftResult = this.evaluate(node.left, input, context);
    
    // For each item in left result, evaluate right
    const results: any[] = [];
    for (const item of leftResult.value) {
      const itemContext = RuntimeContextManager.setFocus(leftResult.context, [item]);
      const rightResult = this.evaluate(node.right, [item], itemContext);
      results.push(...rightResult.value);
    }
    
    return { value: results, context };
  }
  // ... regular binary operator handling
}
```

#### Function Evaluation

Functions can have special evaluation semantics:

```typescript
private visitFunction(node: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
  const functionDef = registry.getFunction(functionName);
  
  if (functionDef.signature.parameters.some(p => p.expression)) {
    // Expression parameters are passed unevaluated
    return functionDef.evaluate(input, context, node.arguments, this.evaluate.bind(this));
  } else {
    // Regular parameters are evaluated first
    const evaluatedArgs = node.arguments.map(arg => 
      this.evaluate(arg, input, context).value
    );
    return functionDef.evaluate(input, context, ...evaluatedArgs);
  }
}
```

### Collection Semantics

FHIRPath treats everything as collections:

```typescript
// Empty collection represents "no value"
[] // empty

// Single values are collections with one item
[42] // collection with one number

// Operations propagate through collections
[1, 2, 3] + [4, 5] // results in [5, 6, 7, 8]
```

## Analyzer

### Overview

The analyzer (`src/analyzer.ts`) performs static analysis on FHIRPath expressions, providing diagnostics and type information without execution.

### Analysis Phases

1. **Syntax Validation**: Ensures expression is parseable
2. **Variable Analysis**: Checks all variables are defined
3. **Operation Validation**: Verifies operators/functions exist
4. **Type Analysis**: Infers and checks types (with TypeAnalyzer)

### Diagnostic Generation

```typescript
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

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}
```

### Variable Validation

```typescript
private checkVariables(node: ASTNode, variables?: Record<string, unknown>): void {
  this.traverse(node, (n) => {
    if (n.type === NodeType.Variable) {
      const varNode = n as VariableNode;
      const varName = varNode.name;
      
      if (this.isSpecialVariable(varName)) {
        // $this, $index, $total are always valid
        return;
      }
      
      if (varName.startsWith('%') && !this.isKnownContextVariable(varName)) {
        if (!variables || !(varName.substring(1) in variables)) {
          this.addDiagnostic({
            range: n.range,
            severity: DiagnosticSeverity.Error,
            code: 'UNKNOWN_VARIABLE',
            message: `Unknown variable: ${varName}`,
            source: 'fhirpath-analyzer'
          });
        }
      }
    }
  });
}
```

### Type Analysis Integration

When a TypeAnalyzer is available:

```typescript
private analyzeTypes(ast: ASTNode): void {
  if (this.typeAnalyzer) {
    const typeInfo = this.typeAnalyzer.analyze(ast);
    
    // Add type information to nodes
    this.traverse(ast, (node) => {
      if (typeInfo.has(node)) {
        node.typeInfo = typeInfo.get(node);
      }
    });
    
    // Check for type errors
    this.checkTypeCompatibility(ast);
  }
}
```

## Registry

### Overview

The registry (`src/registry.ts`) is the central repository for all FHIRPath operations, managing operators and functions with their metadata and implementations.

### Architecture

```typescript
export class Registry {
  private operators: Map<string, OperatorDefinition> = new Map();
  private functions: Map<string, FunctionDefinition> = new Map();
  private symbolOperators: Set<string> = new Set();
  private keywordOperators: Set<string> = new Set();
  private unaryOperators: Map<string, UnaryOperatorDefinition> = new Map();
}
```

### Operation Registration

#### Operator Definition

```typescript
interface OperatorDefinition {
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

// Example: Addition operator
registry.defineOperator({
  symbol: '+',
  name: 'add',
  category: ['arithmetic', 'string'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Addition/concatenation operator',
  examples: ['5 + 3', "'Hello' + ' World'"],
  signatures: [
    {
      name: 'Integer + Integer',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true }
    },
    {
      name: 'String + String',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'String', singleton: true }
    }
  ],
  evaluate: (left, context, right) => {
    // Implementation
  }
});
```

#### Function Definition

```typescript
interface FunctionDefinition {
  name: string;
  category: string[];
  description: string;
  examples: string[];
  signature: {
    input: TypeInfo;
    parameters: Array<{
      name: string;
      optional?: boolean;
      type: TypeInfo;
      expression?: boolean;  // Unevaluated parameter
    }>;
    result: TypeInfo;
  };
  evaluate: FunctionEvaluator;
}

// Example: where() function
registry.defineFunction({
  name: 'where',
  category: ['filtering'],
  description: 'Filters collection based on criteria',
  examples: ["Patient.name.where(use = 'official')"],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [{
      name: 'criteria',
      type: { type: 'Boolean', singleton: true },
      expression: true  // Evaluated per item
    }],
    result: { type: 'Any', singleton: false }
  },
  evaluate: (input, context, args, evaluator) => {
    // Implementation using evaluator for expression parameter
  }
});
```

### Operation Categories

The registry organizes operations into categories:

1. **Arithmetic**: `+`, `-`, `*`, `/`, `div`, `mod`
2. **Comparison**: `=`, `!=`, `<`, `>`, `<=`, `>=`, `~`, `!~`
3. **Logical**: `and`, `or`, `xor`, `implies`, `not`
4. **Navigation**: `.` (dot operator)
5. **Membership**: `in`, `contains`
6. **Type**: `is`, `as`, `ofType()`
7. **Collection**: `|` (union), `where()`, `select()`, `first()`, `last()`
8. **Aggregation**: `count()`, `sum()`, `avg()`, `min()`, `max()`
9. **String**: `startsWith()`, `endsWith()`, `contains()`, `substring()`
10. **Utility**: `iif()`, `trace()`, `today()`, `now()`

### Dynamic Extension

The registry supports runtime extension:

```typescript
// Add custom function
registry.defineFunction({
  name: 'customTransform',
  category: ['custom'],
  description: 'Custom transformation function',
  // ... rest of definition
});

// Check if operation exists
if (registry.hasOperator('+')) {
  const op = registry.getOperator('+');
}

// Get all operations in category
const arithmeticOps = registry.getOperationsByCategory('arithmetic');
```

## Type System

### Overview

The type system (`src/types.ts`, `src/type-analyzer.ts`) provides type definitions and analysis capabilities for FHIRPath expressions.

### Type Hierarchy

```typescript
export type TypeName = 
  | 'Any'      // Base type for all values
  | 'Boolean'
  | 'String'
  | 'Integer'
  | 'Long'     // 64-bit integer
  | 'Decimal'
  | 'Date'
  | 'DateTime'
  | 'Time'
  | 'Quantity';
```

### Type Information Structure

```typescript
export interface TypeInfo {
  // FHIRPath computational type
  type: TypeName;
  
  // Collection vs singleton
  singleton?: boolean;
  
  // Union type indicator
  union?: boolean;
  
  // Model-specific type information
  namespace?: string;  // e.g., "FHIR"
  name?: string;       // e.g., "Patient"
  
  // For union types (choice types)
  choices?: TypeInfo[];
  
  // For complex types - property definitions
  elements?: {
    [propertyName: string]: TypeInfo;
  };
  
  // Opaque model-specific context
  modelContext?: unknown;
}
```

### Type Analysis

The TypeAnalyzer performs type inference:

```typescript
export class TypeAnalyzer {
  constructor(
    private registry: Registry,
    private modelProvider?: ModelTypeProvider
  ) {}
  
  analyze(ast: ASTNode): Map<ASTNode, TypeInfo> {
    const typeMap = new Map<ASTNode, TypeInfo>();
    this.inferTypes(ast, typeMap);
    return typeMap;
  }
  
  private inferTypes(node: ASTNode, typeMap: Map<ASTNode, TypeInfo>): TypeInfo {
    switch (node.type) {
      case NodeType.Literal:
        return this.inferLiteralType(node as LiteralNode);
      
      case NodeType.Binary:
        return this.inferBinaryType(node as BinaryNode, typeMap);
      
      case NodeType.Function:
        return this.inferFunctionType(node as FunctionNode, typeMap);
      
      // ... other node types
    }
  }
}
```

### Model Provider Interface

For integrating with data models:

```typescript
export interface ModelTypeProvider<TypeContext = unknown> {
  // Get type by name
  getTypeByName(typeName: string): TypeInfo | undefined;
  
  // Navigate properties
  navigateProperty(parentType: TypeInfo, propertyName: string): TypeInfo | undefined;
  
  // Check property existence
  hasProperty(parentType: TypeInfo, propertyName: string): boolean;
  
  // Get available properties
  getPropertyNames(parentType: TypeInfo): string[];
  
  // Type compatibility
  isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean;
  
  // Map to FHIRPath type
  mapToFHIRPathType(typeName: string): TypeName;
}
```

### Type Conversion Rules

FHIRPath defines implicit and explicit conversions:

```typescript
// Implicit conversions (automatic)
Integer → Long
Integer → Decimal  
Long → Decimal
Integer → Quantity
Decimal → Quantity
Date → DateTime

// Explicit conversions (via functions)
String → All types (via toInteger(), toDecimal(), etc.)
All types → String (via toString())
Boolean ↔ Integer/Decimal (0/1)
```

## Summary

The FHIRPath implementation's core components work together to provide a complete expression evaluation system:

1. **Lexer** tokenizes expressions with position tracking
2. **Parser** builds AST with error recovery and dual modes
3. **Interpreter** evaluates expressions with proper semantics
4. **Analyzer** provides static analysis and diagnostics
5. **Registry** manages all operations with metadata
6. **Type System** enables type checking and model integration

Each component is designed for extensibility, performance, and correctness, following established patterns while leveraging TypeScript's capabilities.