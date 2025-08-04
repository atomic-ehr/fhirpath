# FHIRPath Implementation Architecture

## Overview

This TypeScript implementation of FHIRPath provides a complete path-based navigation and extraction language for FHIR resources. The architecture follows a traditional compiler pipeline design with clear separation of concerns.

## Core Components

### 1. Lexical Analysis Layer

#### Lexer ([src/lexer.ts](../src/lexer.ts):73-430)
The lexer tokenizes FHIRPath expressions into a stream of tokens. Key features:
- **Token Types**: Identifiers, literals (numbers, strings, datetime), operators, structural tokens
- **Special Tokens**: Context variables (`$this`, `$index`), environment variables (`%var`)
- **Trivia Handling**: Preserves whitespace and comments for IDE features
- **Position Tracking**: Maintains both legacy (1-based) and LSP (0-based) positions
- **Error Recovery**: Continues tokenization after errors in LSP mode

Key methods:
- `nextToken()` ([lexer.ts:181](../src/lexer.ts#L181)): Main tokenization loop
- `readNumber()` ([lexer.ts:324](../src/lexer.ts#L324)): Handles integers, decimals, quantities
- `readString()` ([lexer.ts:372](../src/lexer.ts#L372)): Handles string literals with escape sequences
- `readDateTime()` ([lexer.ts:401](../src/lexer.ts#L401)): Parses datetime/time literals

### 2. Parsing Layer

#### Parser Base ([src/parser-base.ts](../src/parser-base.ts):1-286)
Abstract base class implementing precedence climbing algorithm:
- **Precedence Climbing**: Handles operator precedence and associativity
- **Error Recovery**: Synchronizes on structural tokens for robust parsing
- **Token Management**: Buffering and lookahead capabilities

#### Parser ([src/parser.ts](../src/parser.ts):63-800)
Concrete parser implementation that builds the Abstract Syntax Tree (AST):
- **Expression Parsing**: 
  - `parseExpression()` ([parser.ts:215](../src/parser.ts#L215)): Entry point for expression parsing
  - `parsePrimary()` ([parser.ts:353](../src/parser.ts#L353)): Handles primary expressions (literals, identifiers, parentheses)
  - `parseInfixExpression()` ([parser.ts:450](../src/parser.ts#L450)): Handles binary operators and function calls
- **AST Building**: Creates typed nodes with source location tracking
- **LSP Features**: Node indexing, identifier tracking, trivia preservation
- **Error Nodes**: Creates error nodes for invalid syntax in recovery mode

Key AST node types ([src/types.ts](../src/types.ts):150-350):
- `LiteralNode`: Numbers, strings, booleans
- `IdentifierNode`: Property access and type references
- `BinaryNode`: Binary operations (arithmetic, comparison, logical)
- `UnaryNode`: Unary operations (not, -, +)
- `FunctionNode`: Function invocations with arguments
- `VariableNode`: Variable references ($this, %custom)
- `IndexNode`: Collection indexing operations
- `CollectionNode`: Collection literals

### 3. Semantic Analysis Layer

#### Analyzer ([src/analyzer.ts](../src/analyzer.ts):1-1200)
Performs static type analysis and validation:
- **Type Inference**: Determines expression result types
- **Type Checking**: Validates operation compatibility
- **FHIR Integration**: Uses ModelProvider for FHIR type information
- **Diagnostic Reporting**: Generates errors and warnings

Key features:
- `analyze()` ([analyzer.ts:45](../src/analyzer.ts#L45)): Main analysis entry point
- `inferType()` ([analyzer.ts:250](../src/analyzer.ts#L250)): Type inference visitor
- `checkTypes()` ([analyzer.ts:450](../src/analyzer.ts#L450)): Type compatibility checking
- `resolveProperty()` ([analyzer.ts:650](../src/analyzer.ts#L650)): FHIR property resolution

#### Model Provider ([src/model-provider.ts](../src/model-provider.ts):1-500)
Provides FHIR type information for analysis:
- **Type Resolution**: Maps type names to definitions
- **Property Access**: Validates property navigation
- **Polymorphism**: Handles choice types and inheritance
- **Extension Support**: Enables extension navigation

### 4. Execution Layer

#### Interpreter ([src/interpreter.ts](../src/interpreter.ts):1-800)
Evaluates FHIRPath expressions against data:
- **Visitor Pattern**: Traverses AST nodes for evaluation
- **Context Management**: Maintains evaluation context with variables
- **Collection Processing**: Handles FHIRPath collection semantics
- **Function Evaluation**: Invokes built-in and custom functions

Key components:
- `evaluate()` ([interpreter.ts:150](../src/interpreter.ts#L150)): Main evaluation method
- `RuntimeContextManager` ([interpreter.ts:26](../src/interpreter.ts#L26)): Efficient prototype-based context
- `visitNode()` ([interpreter.ts:200](../src/interpreter.ts#L200)): Node evaluation dispatcher

Context management features:
- **Prototype Inheritance**: O(1) context copying via prototypes
- **Variable Scoping**: Manages $, %, and user-defined variables
- **Iterator Context**: Handles $this and $index in iterations

### 5. Operation Registry

#### Registry ([src/registry.ts](../src/registry.ts):25-200)
Central registry for operators and functions:
- **Operator Registration**: Symbol and keyword operators
- **Function Registration**: Built-in and custom functions
- **Precedence Management**: Operator precedence and associativity
- **Metadata Access**: Operation signatures and documentation

Key methods:
- `registerOperator()` ([registry.ts:52](../src/registry.ts#L52)): Register new operators
- `registerFunction()` ([registry.ts:125](../src/registry.ts#L125)): Register functions
- `getOperatorDefinition()` ([registry.ts:98](../src/registry.ts#L98)): Retrieve operator metadata

#### Operations ([src/operations/](../src/operations/))
Individual operation implementations (~90 files):

**Arithmetic Operations**:
- [plus-operator.ts](../src/operations/plus-operator.ts): Addition with type coercion
- [minus-operator.ts](../src/operations/minus-operator.ts): Subtraction
- [multiply-operator.ts](../src/operations/multiply-operator.ts): Multiplication
- [divide-operator.ts](../src/operations/divide-operator.ts): Division with null handling

**Comparison Operations**:
- [equal-operator.ts](../src/operations/equal-operator.ts): Equality with FHIRPath semantics
- [less-operator.ts](../src/operations/less-operator.ts): Less than comparison
- [equivalent-operator.ts](../src/operations/equivalent-operator.ts): Equivalence testing

**Logical Operations**:
- [and-operator.ts](../src/operations/and-operator.ts): Logical AND with three-valued logic
- [or-operator.ts](../src/operations/or-operator.ts): Logical OR
- [not-function.ts](../src/operations/not-function.ts): Logical negation

**Collection Functions**:
- [where-function.ts](../src/operations/where-function.ts): Filtering with criteria
- [select-function.ts](../src/operations/select-function.ts): Projection/mapping
- [first-function.ts](../src/operations/first-function.ts): First element access
- [distinct-function.ts](../src/operations/distinct-function.ts): Remove duplicates

**String Functions**:
- [substring-function.ts](../src/operations/substring-function.ts): String slicing
- [contains-function.ts](../src/operations/contains-function.ts): Substring testing
- [replace-function.ts](../src/operations/replace-function.ts): String replacement

**Utility Functions**:
- [trace-function.ts](../src/operations/trace-function.ts): Debugging output
- [defineVariable-function.ts](../src/operations/defineVariable-function.ts): Variable definition
- [iif-function.ts](../src/operations/iif-function.ts): Conditional evaluation

### 6. Utility Components

#### Inspect ([src/inspect.ts](../src/inspect.ts):1-300)
Debugging and profiling utilities:
- **Trace Collection**: Captures trace() function output
- **Performance Timing**: Measures execution time
- **AST Visualization**: Provides AST structure
- **Step Recording**: Optional step-by-step execution

#### Quantity Value ([src/quantity-value.ts](../src/quantity-value.ts):1-200)
UCUM quantity handling:
- **Unit Parsing**: Parses UCUM unit codes
- **Unit Conversion**: Converts between compatible units
- **Arithmetic**: Quantity-aware arithmetic operations

## Data Flow

```
Input Expression
       ↓
   [Lexer] → Tokens
       ↓
   [Parser] → AST
       ↓
  [Analyzer] → Type-annotated AST + Diagnostics
       ↓
 [Interpreter] → Result
```

## Key Design Patterns

### 1. Visitor Pattern
Used extensively for AST traversal in analyzer and interpreter:
```typescript
visitNode(node: ASTNode): Result {
  switch(node.type) {
    case NodeType.Literal: return this.visitLiteral(node);
    case NodeType.Binary: return this.visitBinary(node);
    // ...
  }
}
```

### 2. Registry Pattern
Centralized registration and lookup of operations:
```typescript
registry.registerFunction({
  name: 'where',
  signature: '(expression: Any) -> Collection',
  evaluator: whereFunction
});
```

### 3. Prototype-based Context
Efficient context management using JavaScript prototypes:
```typescript
const childContext = Object.create(parentContext);
// Child inherits parent's variables, O(1) operation
```

### 4. Error Recovery
Parser continues after errors for IDE scenarios:
```typescript
if (error && this.options.errorRecovery) {
  this.synchronize(); // Skip to next stable point
  return this.createErrorNode(error);
}
```

## Performance Optimizations

1. **Token Buffering**: Parser maintains token buffer to minimize lexer calls
2. **Prototype Contexts**: O(1) context copying via prototype chain
3. **Early Termination**: Short-circuit evaluation for logical operators
4. **Type Caching**: Analyzer caches type information for nodes
5. **Lazy Evaluation**: Functions like `iif()` evaluate conditionally

## Error Handling

### Parse Errors
- **Syntax Errors**: Invalid token sequences
- **Recovery Points**: Synchronization on structural tokens
- **Error Nodes**: Partial AST with error markers

### Runtime Errors
- **Type Errors**: Invalid operation combinations
- **Null Handling**: FHIRPath null propagation semantics
- **Collection Errors**: Invalid collection operations

### Diagnostic Reporting
- **Severity Levels**: Error, Warning, Information, Hint
- **Source Location**: Line/column with ranges
- **Error Codes**: Categorized error identifiers
- **Quick Fixes**: Suggested corrections (future)

## Testing Infrastructure

### Test Organization
- **Unit Tests**: Individual operation testing ([test/](../test/))
- **Integration Tests**: End-to-end expression evaluation
- **Test Cases**: JSON-based test suite ([test-cases/](../test-cases/))
- **Tools**: Interactive testing utilities ([tools/](../tools/))

### Test Case Format ([ADR-008](../adr/008-test-case-organization.md))
```json
{
  "name": "Test suite name",
  "tests": [{
    "name": "Test name",
    "expression": "FHIRPath expression",
    "input": { "test": "data" },
    "expected": ["expected", "result"]
  }]
}
```

## Extension Points

### Custom Functions
Register domain-specific functions:
```typescript
registry.registerFunction({
  name: 'customFunc',
  evaluator: (context, input, args) => {
    // Custom implementation
  }
});
```

### Model Providers
Implement custom type systems:
```typescript
class CustomModelProvider implements ModelProvider {
  resolveType(name: string): TypeInfo { /* ... */ }
  getProperties(type: string): PropertyInfo[] { /* ... */ }
}
```

### Custom Operators
Add new operators with precedence:
```typescript
registry.registerOperator({
  symbol: '**',
  precedence: 120,
  associativity: 'right',
  evaluator: powerOperator
});
```

## Future Enhancements

1. **Compilation**: Generate JavaScript for better performance
2. **Incremental Parsing**: Update AST for changed regions only
3. **Query Optimization**: Optimize expression evaluation paths
4. **Parallel Evaluation**: Process independent sub-expressions concurrently
5. **Caching Layer**: Cache frequently evaluated expressions