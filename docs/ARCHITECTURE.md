# FHIRPath TypeScript Implementation - Architecture Documentation

## Overview

This document provides a comprehensive overview of the FHIRPath TypeScript implementation architecture. FHIRPath is a path-based navigation and extraction language designed for FHIR (Fast Healthcare Interoperability Resources) that enables querying and manipulation of hierarchical healthcare data.

## Core Architecture

The implementation follows a classic interpreter pattern with these main components:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Lexer     │────▶│   Parser    │────▶│   Analyzer   │────▶│ Interpreter  │
└─────────────┘     └─────────────┘     └──────────────┘     └──────────────┘
      │                    │                    │                     │
      ▼                    ▼                    ▼                     ▼
   Tokens               AST                Type Info             Result
```

### 1. Lexer (`lexer.ts`)

The lexer tokenizes FHIRPath expressions into a stream of tokens. Key features:

- **Simplified Token Recognition**: Only recognizes basic token types (operators, literals, identifiers, structural tokens)
- **Channel Support**: Supports hidden channels for preserving trivia (comments, whitespace) in LSP mode
- **Position Tracking**: Maintains both legacy (1-based) and LSP (0-based) position information
- **Environment Variables**: Recognizes special identifiers like `$this`, `$index` and user variables `%varname`

Token types include:
- Literals: `NUMBER`, `STRING`, `DATETIME`, `TIME`
- Operators: All symbol operators consolidated as `OPERATOR`
- Structural: `DOT`, `COMMA`, `LPAREN`, `RPAREN`, `LBRACKET`, `RBRACKET`, `LBRACE`, `RBRACE`
- Special: `SPECIAL_IDENTIFIER` ($...), `ENVIRONMENT_VARIABLE` (%...)

### 2. Parser (`parser.ts`, `parser-base.ts`)

The parser converts tokens into an Abstract Syntax Tree (AST) using precedence climbing algorithm.

**Key Design Decisions:**
- **Base Parser Pattern**: Abstract `BaseParser` class provides shared parsing logic
- **Precedence Climbing**: Handles operator precedence efficiently (defined in `PRECEDENCE` enum)
- **Dual Mode Operation**:
  - `simple` mode: Fast parsing for evaluation
  - `lsp` mode: Rich parsing with error recovery, trivia preservation, and indexing
- **Error Recovery**: In LSP mode, continues parsing after errors to provide better IDE support
- **Node Indexing**: Maintains indexes for fast AST queries in IDE scenarios

**AST Node Types:**
- `LiteralNode`: String, number, boolean, date/time values
- `IdentifierNode`: Property names and type references
- `BinaryNode`: Binary operations (arithmetic, logical, comparison)
- `UnaryNode`: Unary operations (not, unary minus/plus)
- `FunctionNode`: Function calls with arguments
- `VariableNode`: Variable references ($this, %user)
- `IndexNode`: Array/collection indexing
- `CollectionNode`: Explicit collections `{1, 2, 3}`
- `TypeCastNode`: Type casting with `as`
- `MembershipTestNode`: Type checking with `is`

### 3. Type System (`types.ts`, `type-analyzer.ts`)

The type system supports both FHIRPath computational types and model-specific types.

**FHIRPath Types:**
- Primitives: `Boolean`, `String`, `Integer`, `Decimal`, `Date`, `DateTime`, `Time`, `Quantity`
- Special: `Any` (unknown type)
- Collections: All types can be singleton or collection

**Type Information Structure:**
```typescript
interface TypeInfo {
  type: TypeName;           // FHIRPath type
  union?: boolean;          // Is this a union type?
  singleton?: boolean;      // Single value vs collection
  namespace?: string;       // Model namespace (e.g., "FHIR")
  name?: string;           // Model type name
  choices?: TypeInfo[];    // For union types
  elements?: Record<string, TypeInfo>; // Property types
  modelContext?: unknown;  // Opaque model-specific data
}
```

**Type Analysis Features:**
- Type inference for expressions
- Union type support for polymorphic properties
- Model-aware type checking when ModelProvider is available
- Type compatibility checking for operators

### 4. Registry (`registry.ts`)

The registry manages all available operations (operators and functions) with their metadata.

**Registry Responsibilities:**
- Operator categorization (symbol vs keyword, unary vs binary)
- Precedence and associativity rules
- Operation signatures with type information
- Function parameter definitions
- Dynamic operation registration

**Operation Categories:**
- Symbol operators: `+`, `-`, `*`, `/`, `=`, `!=`, etc.
- Keyword operators: `and`, `or`, `xor`, `implies`, `in`, `contains`
- Functions: `where()`, `select()`, `first()`, `count()`, etc.

### 5. Interpreter (`interpreter.ts`)

The interpreter evaluates AST nodes using the visitor pattern.

**Key Components:**

**RuntimeContextManager**: Efficient context management using prototype inheritance
- O(1) context copying through prototype chains
- Variable scoping ($this, $index, %user-defined)
- Iterator context management for collections

**Evaluation Strategy:**
- Visitor pattern for AST traversal
- Lazy evaluation for performance
- Special handling for navigation (dot operator)
- Collection-aware operations

**Context Variables:**
- `$this`: Current item in iteration
- `$index`: Current index in iteration
- `$total`: Total items in collection
- `%context`, `%resource`, `%rootResource`: Root context variables
- `%user-defined`: User-provided variables

### 6. Analyzer (`analyzer.ts`)

Performs static analysis and validation of FHIRPath expressions.

**Analysis Features:**
- Syntax validation
- Variable usage checking
- Operator/function validation
- Type inference and checking
- Model-aware validation (with ModelProvider)

**Diagnostic Reporting:**
- Error severity levels
- Source location tracking
- Detailed error messages
- Suggested fixes (future enhancement)

### 7. Operations (`operations/`)

Individual operation implementations following a consistent pattern.

**Operation Structure:**
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
```

**Implementation Pattern:**
- Each operation in a separate file
- Consistent naming: `{name}-{type}.ts`
- Self-contained with metadata and implementation
- Type-safe evaluation functions

## Design Patterns

### 1. Visitor Pattern
Used in the interpreter for AST traversal, allowing easy extension of node processing.

### 2. Registry Pattern
Centralized operation management enables dynamic extension and introspection.

### 3. Prototype Inheritance
RuntimeContext uses JavaScript prototypes for efficient context management without copying.

### 4. Abstract Factory
BaseParser provides template for creating different parser implementations.

### 5. Builder Pattern
FHIRPath configuration uses builder pattern for custom functions and settings.

## API Surface

### Core Functions

1. **evaluate()**: Direct expression evaluation
   ```typescript
   evaluate(expression: string, options?: EvaluateOptions): any[]
   ```

2. **parse()**: Parse expression to AST
   ```typescript
   parse(expression: string): ParseResult
   ```

3. **analyze()**: Static analysis
   ```typescript
   analyze(expression: string, options?: AnalyzeOptions): AnalysisResult
   ```

### Key Interfaces

1. **EvaluateOptions**: Evaluation configuration
   - `input`: Input data
   - `variables`: User-defined variables

2. **ParseResult**: Parser output
   - `ast`: Abstract syntax tree
   - `errors`: Parse errors
   - `diagnostics`: All diagnostics

3. **AnalysisResult**: Analysis output
   - `diagnostics`: Type and validation issues
   - `ast`: Type-annotated AST

## Performance Considerations

1. **Prototype-based Context**: O(1) context copying using prototype chains
2. **Lazy Evaluation**: Collections processed on-demand
3. **Token Caching**: Lexer tokenizes once and caches results
4. **Indexed AST**: LSP mode maintains indexes for fast queries
5. **Precedence Climbing**: Efficient operator parsing

## Extensibility Points

1. **Custom Functions**: Add domain-specific functions via registry
2. **Model Providers**: Integrate with different data models (FHIR, CDA, etc.)
3. **Custom Operators**: Register new operators with precedence rules
4. **Type Extensions**: Add new FHIRPath types
5. **Analysis Rules**: Extend analyzer with custom validation

## Error Handling

1. **Parse Errors**: Syntax errors with location information
2. **Runtime Errors**: Evaluation failures with context
3. **Type Errors**: Type mismatches detected during analysis
4. **Recovery**: LSP mode continues parsing after errors

## Future Enhancements

1. **Compiler**: Generate optimized JavaScript from AST
2. **Streaming**: Process large datasets without loading all data
3. **Parallel Evaluation**: Multi-threaded collection processing
4. **Query Optimization**: Rewrite expressions for performance
5. **Debug Protocol**: Step-through debugging support

## Summary

The FHIRPath implementation provides a robust, extensible foundation for healthcare data querying. Its modular architecture, efficient runtime, and comprehensive type system make it suitable for both simple evaluations and complex IDE integrations. The design prioritizes performance, correctness, and developer experience while maintaining flexibility for future enhancements.