# Parser Component

## Overview

The parser transforms a stream of tokens from the lexer into an Abstract Syntax Tree (AST). It implements a recursive descent parser with operator precedence handling, supporting the full FHIRPath grammar including paths, operators, functions, and literals.

The parser features a unified architecture with configurable options for different use cases:
- **Performance mode**: Throws on first error for fastest parsing
- **Diagnostic mode**: Collects all syntax errors without throwing
- **Development mode**: Includes source range tracking and error recovery for IDE features

## Architecture

### Core Parser Class
**Location**: [`/src/parser/parser.ts`](../../src/parser/parser.ts)

The `FHIRPathParser` class provides the main parsing functionality:

```typescript
export class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  private throwOnError: boolean;
  private trackRanges: boolean;
  private errorRecovery: boolean;
  private diagnostics?: DiagnosticCollector;
  private sourceMapper?: SourceMapper;
  private errorReporter?: ContextualErrorReporter;
  private input: string;
  private isPartial: boolean = false;
  
  constructor(input: string | Token[], options: ParserOptions = {}) {
    this.throwOnError = options.throwOnError ?? false;
    this.trackRanges = options.trackRanges ?? false;
    this.errorRecovery = options.errorRecovery ?? false;
    
    if (typeof input === 'string') {
      this.input = input;
      try {
        this.tokens = lex(input);
      } catch (error: any) {
        if (this.throwOnError) {
          throw error;
        }
        this.tokens = [];
        (this as any).lexerError = error;
      }
    } else {
      this.tokens = input;
      this.input = input.map(t => t.value).join(' ');
    }
    
    this.current = 0;
    this.initializeForMode(this.input, options);
  }
  
  parse(): ParseResult {
    if (this.errorRecovery) {
      return this.parseWithRecovery();
    } else {
      return this.parseStandard();
    }
  }
}
```

### Parser Options
**Location**: [`/src/parser/types.ts`](../../src/parser/types.ts)

```typescript
export interface ParserOptions {
  maxErrors?: number;           // Maximum errors to collect
  throwOnError?: boolean;       // Throw on first error (performance mode)
  trackRanges?: boolean;        // Track source ranges for each AST node
  errorRecovery?: boolean;      // Enable error recovery for partial ASTs
}

export interface ParseResult {
  ast: ASTNode;                 // The parsed AST
  diagnostics: ParseDiagnostic[]; // Array of syntax issues
  hasErrors: boolean;           // Quick error check
  isPartial?: boolean;          // Present when errorRecovery enabled
  ranges?: Map<ASTNode, TextRange>; // Present when trackRanges enabled
}
```

### AST Node Types
**Location**: [`/src/parser/ast.ts`](../../src/parser/ast.ts)

The parser produces these AST node types:

```typescript
export enum NodeType {
  // Navigation
  Identifier,
  TypeOrIdentifier, // Uppercase identifiers that could be types
  
  // Operators
  Binary,     // All binary operators including dot
  Unary,      // unary +, -, not
  Union,      // | operator (special handling)
  
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
}

// Core node structures:
export interface BinaryNode extends ASTNode {
  type: NodeType.Binary;
  operator: TokenType;
  operation?: any;     // Operation from registry
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionNode extends ASTNode {
  type: NodeType.Function;
  name: ASTNode;  // Usually an identifier
  arguments: ASTNode[];
  operation?: any;     // Operation from registry
}

export interface IdentifierNode extends ASTNode {
  type: NodeType.Identifier;
  name: string;
}

// Error recovery nodes (only when errorRecovery enabled):
export interface ErrorNode extends ASTNode {
  type: NodeType.Error;
  expectedTokens: TokenType[];
  diagnostic: ParseDiagnostic;
}

export interface IncompleteNode extends ASTNode {
  type: NodeType.Incomplete;
  partialNode: ASTNode;
  missingParts: string[];
}
```

## Parsing Algorithm

### 1. Operator Precedence
**Location**: [`parser.ts`](../../src/parser/parser.ts)

The parser implements operator precedence with a Pratt parser approach:

```typescript
// Precedence levels from FHIRPath spec (comments show parser's internal mapping)
// INVOCATION: 1,      // . (dot), function calls
// POSTFIX: 2,         // [] indexing
// UNARY: 3,           // unary +, -, not
// MULTIPLICATIVE: 4,  // *, /, div, mod
// ADDITIVE: 5,        // +, -, &
// TYPE: 6,            // is, as
// UNION: 7,           // |
// RELATIONAL: 8,      // <, >, <=, >=
// EQUALITY: 9,        // =, ~, !=, !~
// MEMBERSHIP: 10,     // in, contains
// AND: 11,            // and
// OR: 12,             // or, xor
// IMPLIES: 13,        // implies

// The parser maps registry precedence to internal precedence
const precedenceMap: Record<number, number> = {
  1: 13,  // implies - lowest
  2: 12,  // or, xor
  3: 11,  // and
  5: 5,   // additive (+, -, &)
  6: 4,   // multiplicative (*, /, div, mod) and type (is, as)
  8: 8,   // relational (<, >, <=, >=)
  9: 9,   // equality (=, !=, ~, !~)
  10: 10, // membership (in, contains)
  13: 7   // union (|)
};
```

### 2. Expression Parsing
**Location**: [`parser.ts:expression()`](../../src/parser/parser.ts)

The main expression parser using Pratt parsing with precedence:

```typescript
private expression(minPrecedence: number = 14): ASTNode {
  let left = this.primary();
  
  while (!this.isAtEnd()) {
    // Handle postfix operators first
    if (this.check(TokenType.LBRACKET) && minPrecedence >= 2) { // POSTFIX precedence
      left = this.parseIndex(left);
      continue;
    }
    
    // Handle function calls and dot operators
    if (this.check(TokenType.DOT) && minPrecedence >= 1) { // INVOCATION precedence
      const dotToken = this.peek();
      const precedence = this.getPrecedence(dotToken);
      if (precedence > minPrecedence) break;
      
      left = this.parseBinary(left, dotToken, precedence);
      continue;
    }
    
    const token = this.peek();
    const precedence = this.getPrecedence(token);
    
    if (precedence === 0 || precedence > minPrecedence) break;
    
    left = this.parseBinary(left, token, precedence);
  }
  
  return left;
}
```

### 3. Path Expression Parsing (via Binary Dot Operator)
**Location**: [`parser.ts:parseBinary()`](../../src/parser/parser.ts)

Path expressions are handled through the binary dot operator:

```typescript
// Special handling for dot operator (left-associative, pipelines data)
if (op.type === TokenType.DOT) {
  // After a dot, we need to handle keywords that can be method names
  let right: ASTNode;
  
  // Check if next token is a keyword that can be used as a method name
  const next = this.peek();
  if (this.isOperatorKeyword(next.type)) {
    // Treat keyword as identifier
    this.advance();
    right = {
      type: NodeType.Identifier,
      name: next.value,
      position: next.position
    } as IdentifierNode;
  } else {
    right = this.primary();
  }
  
  // Check for function call after dot
  if (this.peek().type === TokenType.LPAREN) {
    const dotNode: BinaryNode = {
      type: NodeType.Binary,
      operator: TokenType.DOT,
      operation: operation,
      left: left,
      right: right,
      position: op.position
    };
    return this.functionCall(dotNode);
  }
  
  return {
    type: NodeType.Binary,
    operator: TokenType.DOT,
    operation: operation,
    left: left,
    right: right,
    position: op.position
  } as BinaryNode;
}
```

The dot operator creates a binary node that represents member access or method calls.

### 4. Function Parsing
**Location**: [`parser.ts:functionCall()`](../../src/parser/parser.ts)

Parses function calls with arguments:

```typescript
private functionCall(func: ASTNode): ASTNode {
  this.consume(TokenType.LPAREN, "Expected '(' after function");
  
  const args: ASTNode[] = [];
  
  if (!this.check(TokenType.RPAREN)) {
    do {
      args.push(this.expression());
    } while (this.match(TokenType.COMMA));
  }
  
  this.consume(TokenType.RPAREN, "Expected ')' after arguments");
  
  let result: ASTNode = {
    type: NodeType.Function,
    name: func,
    arguments: args,
    position: func.position
  } as FunctionNode;
  
  // Check for method calls after the function (e.g., exists().not())
  while (this.check(TokenType.DOT)) {
    const dotToken = this.advance();
    
    // After a dot, handle keywords that can be method names
    let right: ASTNode;
    const next = this.peek();
    if (this.isOperatorKeyword(next.type)) {
      // Treat keyword as identifier
      this.advance();
      right = {
        type: NodeType.Identifier,
        name: next.value,
        position: next.position
      } as IdentifierNode;
    } else {
      right = this.primary();
    }
    
    // Continue chaining...
  }
  
  return result;
}
```

The function takes an AST node (usually an identifier) as the function name, allowing for complex function expressions.

### 5. Literal Parsing
**Location**: [`parser.ts:primary()`](../../src/parser/parser.ts)

Handles various literal types in the primary expression parser:

```typescript
// Numbers
if (this.match(TokenType.NUMBER)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: parseFloat(token.value),
    valueType: 'number',
    position: token.position
  } as LiteralNode;
}

// Strings
if (this.match(TokenType.STRING)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: token.value,
    valueType: 'string',
    position: token.position
  } as LiteralNode;
}

// Booleans
if (this.match(TokenType.TRUE, TokenType.FALSE)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: token.type === TokenType.TRUE,
    valueType: 'boolean',
    position: token.position
  } as LiteralNode;
}

// Null literal (empty set {})
if (this.match(TokenType.NULL)) {
  return {
    type: NodeType.Literal,
    value: null,
    valueType: 'null',
    position: this.previous().position
  } as LiteralNode;
}

// Date/Time literals
if (this.match(TokenType.DATE, TokenType.DATETIME, TokenType.TIME)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: token.value,
    valueType: token.type === TokenType.DATE ? 'date' : 
               token.type === TokenType.TIME ? 'time' : 'datetime',
    position: token.position
  } as LiteralNode;
}

// Variables ($this, $index, $total, %env)
if (this.match(TokenType.THIS, TokenType.INDEX, TokenType.TOTAL, TokenType.ENV_VAR)) {
  return {
    type: NodeType.Variable,
    name: this.previous().value,
    position: this.previous().position
  } as VariableNode;
}
```

## Parser Modes and Features

### Performance Mode (throwOnError)
When `throwOnError: true`, the parser:
- Throws immediately on the first syntax error
- Skips creating diagnostic infrastructure
- Provides fastest parsing performance
- Best for production use where expressions are pre-validated

### Diagnostic Mode (default)
By default, the parser:
- Collects all syntax errors without throwing
- Creates diagnostic infrastructure (DiagnosticCollector, SourceMapper)
- Returns diagnostics array with detailed error information
- Suitable for validation and user-facing error messages

### Development Mode (errorRecovery + trackRanges)
With both flags enabled, the parser:
- Attempts to recover from errors and continue parsing
- Creates partial ASTs with ErrorNode/IncompleteNode markers
- Tracks source ranges for every AST node
- Provides contextual error messages
- Ideal for IDE integration and development tools

## Error Handling

### Error Reporting Infrastructure

#### DiagnosticCollector
**Location**: [`/src/parser/diagnostics.ts`](../../src/parser/diagnostics.ts)

Collects and manages parse diagnostics:
```typescript
export class DiagnosticCollector {
  private diagnostics: ParseDiagnostic[] = [];
  private errorCount: number = 0;
  private maxErrors: number;
  
  addError(range: TextRange, message: string, code: ErrorCode): void {
    if (this.errorCount >= this.maxErrors) return;
    
    this.diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range,
      message,
      code,
      source: 'fhirpath-parser'
    });
    this.errorCount++;
  }
}
```

#### SourceMapper
**Location**: [`/src/parser/source-mapper.ts`](../../src/parser/source-mapper.ts)

Maps tokens and AST nodes to source text ranges:
```typescript
export class SourceMapper {
  private lines: string[];
  private lineOffsets: number[];
  
  tokenToRange(token: Token): TextRange {
    return {
      start: {
        line: token.position.line - 1,  // Convert to 0-based
        character: token.position.column - 1,
        offset: token.position.offset
      },
      end: {
        line: token.position.line - 1,
        character: token.position.column - 1 + token.value.length,
        offset: token.position.offset + token.value.length
      }
    };
  }
}
```

### Error Recovery
**Location**: [`parser.ts:parseWithRecovery()`](../../src/parser/parser.ts)

When `errorRecovery: true`, the parser attempts to recover from errors:

```typescript
private expressionWithRecovery(minPrecedence: number = 14): ASTNode {
  try {
    return this.expression(minPrecedence);
  } catch (error) {
    if (error instanceof ParseError && this.errorRecovery) {
      const errorNode = this.createErrorNode(error.token, error.message);
      this.recoverToSyncPoint();
      
      // Try to continue parsing after recovery
      if (!this.isAtEnd() && !this.isAtSyncPoint()) {
        try {
          const right = this.expressionWithRecovery(minPrecedence);
          return this.createPartialBinaryNode(errorNode, right);
        } catch {
          // Return the error node if recovery fails
        }
      }
      
      return errorNode;
    }
    throw error;
  }
}

private recoverToSyncPoint(): void {
  while (!this.isAtEnd()) {
    if (this.isAtSyncPoint()) {
      return;
    }
    this.advance();
  }
}

private isAtSyncPoint(): boolean {
  const token = this.peek();
  return token.type === TokenType.COMMA ||
         token.type === TokenType.RPAREN ||
         token.type === TokenType.RBRACKET ||
         token.type === TokenType.RBRACE ||
         token.type === TokenType.PIPE ||
         token.type === TokenType.AND ||
         token.type === TokenType.OR ||
         this.isStatementBoundary(token);
}
```

## AST Pretty Printing
**Location**: [`/src/parser/pprint.ts`](../../src/parser/pprint.ts)

Utility for debugging and visualization using S-expressions:

```typescript
export function pprint(node: ASTNode, multiline: boolean = false, indent: number = 0): string {
  const spaces = multiline ? ' '.repeat(indent) : '';
  const nl = multiline ? '\n' : '';
  const childIndent = indent + 2;
  
  switch (node.type) {
    case NodeType.Literal:
      const lit = node as LiteralNode;
      return `${spaces}(${pprintLiteralValue(lit)}:${lit.valueType})`;
    
    case NodeType.Identifier:
      return `${spaces}(${(node as IdentifierNode).name}:id)`;
    
    case NodeType.Variable:
      const varNode = node as VariableNode;
      const varName = varNode.name.startsWith('$') ? varNode.name : `%${varNode.name}`;
      return `${spaces}(${varName}:var)`;
    
    case NodeType.Binary:
      const binary = node as BinaryNode;
      const op = tokenToOp(binary.operator);
      if (multiline) {
        return `${spaces}(${op}${nl}` +
               `${pprint(binary.left, multiline, childIndent)}${nl}` +
               `${pprint(binary.right, multiline, childIndent)})`;
      } else {
        return `(${op} ${pprint(binary.left)} ${pprint(binary.right)})`;
      }
    
    case NodeType.Function:
      const func = node as FunctionNode;
      const funcName = func.name.type === NodeType.Identifier 
        ? (func.name as IdentifierNode).name 
        : pprint(func.name);
      // ... handle function printing
    
    // ... other node types
  }
}
```

The pretty printer outputs compact S-expression format for easy debugging of AST structures.

## Usage Examples

### Basic Parsing (Default Mode)
```typescript
import { parse } from '@atomic-ehr/fhirpath';

const result = parse("Patient.name.where(use = 'official').given");
console.log(result.ast);         // The parsed AST
console.log(result.diagnostics); // Empty array if no errors
console.log(result.hasErrors);   // false
```

### Performance Mode
```typescript
import { parseForEvaluation } from '@atomic-ehr/fhirpath';

try {
  // Fastest parsing - throws on first error
  const ast = parseForEvaluation("Patient.name.given");
  // Use ast directly for evaluation
} catch (error) {
  console.error('Parse error:', error.message);
}

// Or using parse with throwOnError:
const result = parse("Patient.name", { throwOnError: true });
```

### Development Tool Mode
```typescript
import { parse } from '@atomic-ehr/fhirpath';

// Enable all features for IDE integration
const result = parse("Patient..name[0", {
  errorRecovery: true,   // Continue parsing after errors
  trackRanges: true,     // Track source locations
  maxErrors: 10          // Collect up to 10 errors
});

if (result.hasErrors) {
  console.log('Diagnostics:', result.diagnostics);
  // [
  //   {
  //     severity: 1,
  //     range: { start: { line: 0, character: 7 }, end: { line: 0, character: 9 } },
  //     message: "Invalid '..' operator - use single '.' for navigation",
  //     code: "INVALID_OPERATOR"
  //   },
  //   {
  //     severity: 1,
  //     range: { start: { line: 0, character: 14 }, end: { line: 0, character: 14 } },
  //     message: "Expected ']' after index expression",
  //     code: "UNCLOSED_BRACKET"
  //   }
  // ]
  
  console.log('Is partial AST:', result.isPartial); // true
  console.log('AST with error nodes:', result.ast);
  
  // Use ranges for highlighting
  if (result.ranges) {
    for (const [node, range] of result.ranges) {
      console.log(`Node at ${range.start.line}:${range.start.character}`);
    }
  }
}
```

### Pretty Printing
```typescript
import { parse } from '@atomic-ehr/fhirpath';
import { pprint } from '../parser/pprint';

const result = parse("Patient.name.where(use = 'official').given.first()");
console.log(pprint(result.ast));
// Output (S-expression format):
// (. (. (. (. (Patient:id) (name:id)) (where (= (use:id) ('official':string)))) (given:id)) (first))

// With multiline pretty printing:
console.log(pprint(result.ast, true));
// Output:
// (.
//   (.
//     (.
//       (.
//         (Patient:id)
//         (name:id))
//       (where
//         (=
//           (use:id)
//           ('official':string))))
//     (given:id))
//   (first))
```

## Integration Points

### With Lexer
The parser consumes tokens produced by the lexer, expecting:
- Properly classified token types
- Accurate position information
- EOF token at the end

### With Analyzer
The parser produces AST nodes that include:
- Type hints for the analyzer
- Position information for error reporting
- Structural information for type inference

### With Interpreter/Compiler
The AST nodes are designed for efficient traversal:
- Consistent node structure
- Clear parent-child relationships
- No circular references

## Performance Considerations

### Zero-Cost Features
The parser uses lazy initialization to ensure features have no cost when disabled:

1. **Conditional Infrastructure**: 
   - DiagnosticCollector only created when `!throwOnError`
   - SourceMapper only created when `trackRanges || !throwOnError`
   - ContextualErrorReporter only created when `errorRecovery`

2. **Inline Checks**: Feature flags are checked inline with minimal branching:
   ```typescript
   if (this.throwOnError) {
     throw error;  // Fast path - no diagnostic overhead
   }
   // Diagnostic path only when needed
   ```

3. **Performance Characteristics**:
   - **throwOnError mode**: Same performance as legacy parser (~0.05ms for typical expressions)
   - **Default mode**: ~5% overhead for diagnostic collection
   - **trackRanges**: ~10% overhead for source mapping
   - **errorRecovery**: ~20% overhead due to try-catch blocks

### Parsing Optimizations

1. **Single Pass**: The parser completes in a single pass without backtracking
2. **Minimal Lookahead**: Most parsing decisions require only one token lookahead
3. **Direct Construction**: AST nodes are constructed directly without intermediate representations
4. **Memory Efficiency**: Shared position objects and interned strings from the lexer
5. **Precedence Mapping**: Pre-computed precedence table avoids runtime lookups