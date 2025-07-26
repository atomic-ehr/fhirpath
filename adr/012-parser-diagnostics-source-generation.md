# ADR-012: Parser Diagnostics Source Generation

## Status

Proposed

## Context

The FHIRPath parser currently has several limitations that prevent it from serving as an effective diagnostic source for developer tools:

1. **Single Error Reporting**: The parser throws on the first error encountered, preventing collection of multiple issues in a single parse pass
2. **Limited Position Information**: While tokens have positions, the conversion from `ParseError` to `FHIRPathError` loses precise location data
3. **No Error Recovery**: Parser cannot continue after errors, making it impossible to provide diagnostics for the rest of the expression
4. **Generic Error Messages**: Messages like "Expected expression" provide little guidance to developers
5. **Missing Range Information**: Only single positions are tracked, not the full spans of errors
6. **No Severity Levels**: All issues are treated as fatal errors, with no support for warnings or hints

These limitations significantly impact the ability to build effective developer tools, particularly the Language Server Protocol (LSP) implementation described in ADR-005. The LSP requires rich diagnostic information including:
- Multiple diagnostics per expression
- Precise text ranges for error squiggles
- Contextual error messages
- Error recovery to continue analysis
- Related information linking

## Decision

We will enhance the FHIRPath parser to generate detailed diagnostic information by implementing a mode-based architecture that allows users to choose the appropriate level of diagnostic detail based on their use case.

### 1. Parser Modes Architecture

Introduce different parsing modes to balance performance and diagnostic capabilities:

```typescript
enum ParserMode {
  Fast = 'fast',              // No diagnostics, throws on first error (baseline performance)
  Standard = 'standard',      // Basic diagnostics, limited error recovery (~95% performance)
  Diagnostic = 'diagnostic',  // Full diagnostics with error recovery, optional trivia (~75-85% performance)
  Validate = 'validate'       // Validation only, no AST (~90% performance)
}
```

### 2. Diagnostic Collection Infrastructure
- `ParseDiagnostic` interface with range, severity, code, and message
- `DiagnosticCollector` class to accumulate multiple diagnostics
- Support for error, warning, info, and hint severity levels
- Related information to link associated code locations
- Conditional initialization based on parser mode

### 3. Enhanced Error Recovery (Diagnostic mode only)
- Synchronization points for recovering from errors (commas, closing parens, operators)
- Error nodes in the AST to represent malformed expressions
- Incomplete nodes for partial expressions
- Continue parsing after errors to find additional issues

### 4. Precise Location Tracking (Standard/Diagnostic modes)
- `SourceMapper` class to convert between offsets and line/column positions
- Text ranges (start/end positions) for all AST nodes
- Accurate span calculation for complex expressions
- Token-to-range and node-to-range mapping
- Lazy range calculation for performance

### 5. Contextual Error Reporting (Diagnostic mode)
- `ContextualErrorReporter` with parse context awareness
- Human-readable token descriptions
- Specific error messages based on parsing context
- Suggestions for common mistakes

### 6. Unified API
- Single `parse()` function with mode parameter
- `ParseResult` type that varies based on mode
- LSP utility functions for diagnostic conversion
- Clear mode selection for different use cases

## Consequences

### Positive

- **Performance Flexibility**: Users can choose the appropriate performance/feature trade-off
- **Zero Overhead Option**: Fast mode maintains baseline performance for production use
- **Multiple Diagnostics**: Diagnostic mode can report all issues in an expression
- **Better Developer Experience**: Clear, contextual error messages with precise locations
- **LSP Foundation**: Diagnostic mode with trivia tracking provides everything needed for ADR-005's LSP implementation
- **Partial Parsing**: Diagnostic mode can provide analysis even for malformed expressions
- **Extensibility**: Mode system allows adding new capabilities without affecting existing modes
- **IDE Integration**: Enables squiggles, error tooltips, and problem panel integration
- **Progressive Enhancement**: Can start with fast parsing and upgrade to diagnostics when needed

### Negative

- **Complexity**: Multiple code paths increase parser complexity
- **Testing Matrix**: Need to test all modes and their interactions
- **Mode Selection**: Users must understand which mode to use for their use case
- **Maintenance**: More code paths to maintain and keep synchronized
- **Documentation**: Each mode needs clear documentation of capabilities and trade-offs
- **Breaking Change**: Removes backward compatibility with existing parse() function signature

## Alternatives Considered

### 1. Post-Parse Diagnostic Generation
Generate diagnostics by re-analyzing the expression after parsing.

**Pros**:
- Keeps parser simple
- Could reuse existing parser
- Separate concerns

**Cons**:
- Would need to re-parse on errors
- Difficult to maintain position accuracy
- Can't provide partial AST for incomplete expressions

**Decision**: Rejected - Inefficient and loses context

### 2. External Diagnostic Tool
Create a separate tool that analyzes FHIRPath expressions for issues.

**Pros**:
- Complete separation of concerns
- Could use different parsing strategy
- No impact on existing parser

**Cons**:
- Duplicate parsing logic
- Synchronization issues between tools
- Harder to maintain consistency

**Decision**: Rejected - Violates DRY principle

### 3. Simple Error List Collection
Just collect errors in a list without recovery.

**Pros**:
- Minimal changes to parser
- Easy to implement
- Low performance impact

**Cons**:
- Still only finds first error
- No partial AST generation
- Limited usefulness for IDEs

**Decision**: Rejected - Insufficient for LSP needs

### 4. Full Incremental Parsing
Implement a complete incremental parsing system.

**Pros**:
- Best performance for real-time editing
- Minimal re-parsing needed
- Industry best practice for IDEs

**Cons**:
- Extremely complex to implement
- Major rewrite of parser
- Overkill for FHIRPath expressions (typically small)

**Decision**: Rejected - Over-engineering for current needs

### 5. Multiple Parse Functions
Create separate functions like `parse()`, `parseWithDiagnostics()`, `parseForIDE()`, etc.

**Pros**:
- Explicit function names
- No need to understand modes
- Type-safe return values without casting

**Cons**:
- API proliferation (many functions doing similar things)
- Confusion about which function to use
- Maintenance of multiple entry points
- Violates DRY principle
- Harder to add new modes/options

**Decision**: Rejected - The mode-based approach with a single `parse()` function provides a cleaner, more maintainable API. Convenience functions can wrap the main API for common use cases without duplicating the core parsing logic.

## Implementation Details

### Mode-Based Parser Architecture

```typescript
interface ParserOptions {
  mode?: ParserMode;
  maxErrors?: number;        // Limit error collection
  collectRanges?: boolean;   // Force range collection in any mode
  trackTrivia?: boolean;     // Track whitespace/comments (Diagnostic mode only)
}

class FHIRPathParser {
  private mode: ParserMode;
  private diagnostics?: DiagnosticCollector;
  private sourceMapper?: SourceMapper;
  private errorReporter?: ContextualErrorReporter;
  private tokens: Token[];
  private current: number = 0;
  
  constructor(input: string, options: ParserOptions = {}) {
    this.mode = options.mode ?? ParserMode.Standard;
    this.tokens = lex(input);
    this.initializeForMode(input, options);
  }
  
  private initializeForMode(input: string, options: ParserOptions): void {
    switch (this.mode) {
      case ParserMode.Fast:
        // No diagnostic infrastructure needed
        break;
        
      case ParserMode.Standard:
        this.diagnostics = new DiagnosticCollector();
        this.sourceMapper = new SourceMapper(input);
        break;
        
      case ParserMode.Diagnostic:
        this.sourceMapper = new SourceMapper(input);
        this.diagnostics = new DiagnosticCollector();
        this.errorReporter = new ContextualErrorReporter(this.sourceMapper, this.diagnostics);
        // Track trivia if requested
        if (options.trackTrivia) {
          this.enableTriviaTracking();
        }
        break;
        
      case ParserMode.Validate:
        this.diagnostics = new DiagnosticCollector();
        break;
    }
  }
  
  parse(): ParseResult {
    switch (this.mode) {
      case ParserMode.Fast:
        return { ast: this.fastParse() };
      case ParserMode.Validate:
        return { valid: this.validateOnly(), diagnostics: this.diagnostics!.getDiagnostics() };
      default:
        return this.diagnosticParse();
    }
  }
}
```

### Mode-Specific Return Types

```typescript
type ParseResult = FastParseResult | StandardParseResult | DiagnosticParseResult | ValidationResult;

interface FastParseResult {
  ast: ASTNode;
}

interface StandardParseResult {
  ast: ASTNode;
  diagnostics: ParseDiagnostic[];
  hasErrors: boolean;
}

interface DiagnosticParseResult extends StandardParseResult {
  isPartial: boolean;
  ranges: Map<ASTNode, TextRange>;
}

interface ValidationResult {
  valid: boolean;
  diagnostics: ParseDiagnostic[];
}
```

### Core Diagnostic Interfaces

```typescript
// Diagnostic information structure
interface ParseDiagnostic {
  range: TextRange;
  severity: DiagnosticSeverity;
  code: ErrorCode;
  message: string;
  source: 'fhirpath-parser';
  relatedInformation?: RelatedInformation[];
}

// Severity levels for diagnostics
enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

// Text range with start and end positions
interface TextRange {
  start: Position;
  end: Position;
}

// Position in source text
interface Position {
  line: number;
  character: number;  // LSP-compliant (not column)
  offset: number;
}

// Related information for additional context
interface RelatedInformation {
  location: TextRange;
  message: string;
}

// Parsing context for error reporting
enum ParseContext {
  Expression,
  FunctionCall,
  IndexExpression,
  BinaryExpression,
  UnaryExpression,
  CollectionLiteral,
  TypeCast,
  MembershipTest
}
```

### Diagnostic Collection Classes

```typescript
// Accumulates diagnostics during parsing
class DiagnosticCollector {
  private diagnostics: ParseDiagnostic[] = [];
  
  addError(range: TextRange, message: string, code: ErrorCode): void;
  addWarning(range: TextRange, message: string, code: ErrorCode): void;
  addInfo(range: TextRange, message: string, code: ErrorCode): void;
  addHint(range: TextRange, message: string, code: ErrorCode): void;
  
  getDiagnostics(): ParseDiagnostic[];
  hasErrors(): boolean;
  clear(): void;
}

// Maps source text positions and ranges
class SourceMapper {
  constructor(private source: string) {}
  
  tokenToRange(token: Token): TextRange;
  nodeToRange(node: ASTNode): TextRange;
  private calculateNodeEnd(node: ASTNode): Position;
  private offsetToPosition(offset: number): Position;
}

// Generates contextual error messages
class ContextualErrorReporter {
  constructor(
    private sourceMapper: SourceMapper,
    private collector: DiagnosticCollector
  ) {}
  
  reportExpectedToken(expected: TokenType[], actual: Token, context: ParseContext): void;
  reportUnclosedDelimiter(openToken: Token, expectedClose: string): void;
  reportInvalidOperator(operator: Token, message: string): void;
  
  private buildContextualMessage(expected: TokenType[], actual: Token, context: ParseContext): string;
  private describeTokens(tokens: TokenType[]): string;
  private getTokenDescription(token: TokenType): string;
}

// Static factory for common diagnostics
class FHIRPathDiagnostics {
  static unclosedParenthesis(openParen: Token, mapper: SourceMapper): ParseDiagnostic;
  static missingFunctionArguments(func: FunctionNode, mapper: SourceMapper): ParseDiagnostic;
  static doubleDotOperator(firstDot: Token, secondDot: Token, mapper: SourceMapper): ParseDiagnostic;
  static unexpectedToken(token: Token, expected: string[], mapper: SourceMapper): ParseDiagnostic;
}
```

### Enhanced AST Node Types

```typescript
// Error recovery nodes
enum NodeType {
  // ... existing types ...
  Error,        // Error recovery node
  Incomplete,   // Incomplete expression node
}

interface ErrorNode extends ASTNode {
  type: NodeType.Error;
  expectedTokens?: TokenType[];
  actualToken?: Token;
  diagnostic: ParseDiagnostic;
}

interface IncompleteNode extends ASTNode {
  type: NodeType.Incomplete;
  partialNode?: ASTNode;
  missingParts: string[];
}

// Enhanced base AST node with optional range
interface ASTNode {
  type: NodeType;
  position: Position;
  range?: TextRange;        // Full text range (populated in diagnostic modes)
  // ... existing fields
}
```

### Error Codes Extension

```typescript
// Extended error codes for parser diagnostics
enum ErrorCode {
  // ... existing codes ...
  
  // Parser-specific codes
  UNCLOSED_PARENTHESIS = 'UNCLOSED_PARENTHESIS',
  UNCLOSED_BRACKET = 'UNCLOSED_BRACKET',
  UNCLOSED_BRACE = 'UNCLOSED_BRACE',
  MISSING_ARGUMENTS = 'MISSING_ARGUMENTS',
  INVALID_OPERATOR = 'INVALID_OPERATOR',
  EXPECTED_EXPRESSION = 'EXPECTED_EXPRESSION',
  EXPECTED_IDENTIFIER = 'EXPECTED_IDENTIFIER',
  MULTIPLE_ERRORS = 'MULTIPLE_ERRORS'
}
```

### Error Recovery Strategy (Diagnostic mode)

The parser will implement synchronization points at:
- Comma (`,`) - for function arguments and collections
- Closing delimiters (`)`, `]`, `}`)
- Binary operators (`and`, `or`, `|`)
- Statement boundaries (for future multi-statement support)

When an error occurs in diagnostic modes:
1. Report the error to the diagnostic collector
2. Create an error node in the AST
3. Skip tokens until a synchronization point
4. Resume parsing from that point

Example error recovery implementation:
```typescript
private recoverFromError(expected: string, context: ParseContext): ASTNode {
  const errorToken = this.peek();
  
  // Report error based on mode
  if (this.errorReporter) {
    this.errorReporter.reportExpectedToken([/* expected tokens */], errorToken, context);
  } else if (this.diagnostics) {
    // Standard mode - basic error
    const range = this.sourceMapper!.tokenToRange(errorToken);
    this.diagnostics.addError(range, expected, ErrorCode.UNEXPECTED_TOKEN);
  }
  
  // Skip to synchronization point
  while (!this.isAtEnd() && !this.isAtSyncPoint()) {
    this.advance();
  }
  
  // Create error node
  const diagnostic = this.diagnostics?.getDiagnostics().slice(-1)[0];
  return {
    type: NodeType.Error,
    position: errorToken.position,
    range: this.sourceMapper?.tokenToRange(errorToken),
    diagnostic,
    expectedTokens: [/* expected */],
    actualToken: errorToken
  } as ErrorNode;
}
```

### API Design

The mode-based architecture eliminates the need for multiple parse functions like `parseWithDiagnostics()`. Instead, users select the appropriate mode through options:

```typescript
// Main parse function with mode selection
export function parse(input: string, options: ParserOptions = {}): ParseResult {
  return new FHIRPathParser(input, options).parse();
}

// Usage examples:
// For production evaluation (fastest)
const ast = parse(expression, { mode: ParserMode.Fast });

// For development tools (with diagnostics)
const result = parse(expression, { mode: ParserMode.Standard });

// For IDE integration (full features)
const ideResult = parse(expression, { mode: ParserMode.Diagnostic });

// For LSP with trivia tracking
const lspResult = parse(expression, { mode: ParserMode.Diagnostic, trackTrivia: true });

// Convenience functions for specific use cases
export function parseForEvaluation(input: string): ASTNode {
  const result = parse(input, { mode: ParserMode.Fast });
  return (result as FastParseResult).ast;
}

export function parseForIDE(input: string): DiagnosticParseResult {
  return parse(input, { mode: ParserMode.Diagnostic }) as DiagnosticParseResult;
}

export function validateExpression(input: string): ValidationResult {
  return parse(input, { mode: ParserMode.Validate }) as ValidationResult;
}

// Type-safe result extraction helpers
export function isStandardResult(result: ParseResult): result is StandardParseResult {
  return 'diagnostics' in result && 'ast' in result;
}

export function isDiagnosticResult(result: ParseResult): result is DiagnosticParseResult {
  return isStandardResult(result) && 'isPartial' in result && 'ranges' in result;
}
```

### Performance Optimizations by Mode

**Fast Mode**:
- No diagnostic infrastructure initialization
- Direct error throwing
- No range tracking
- Minimal memory allocation

**Standard Mode**:
- Basic diagnostic collector
- Token-level position tracking
- Limited error recovery at statement boundaries

**Diagnostic Mode**:
- Full diagnostic infrastructure
- Complete range tracking with lazy calculation
- Comprehensive error recovery
- Contextual error messages
- Optional trivia tracking (whitespace/comments) for LSP

**Validate Mode**:
- Diagnostic collector without AST building
- Early exit on structural validity
- Optimized for CI/CD scenarios

### Testing Strategy

#### JSON-Based Test Cases

Following the pattern established in ADR-008, we recommend using JSON test cases for parser diagnostics:

```json
{
  "name": "Parser Diagnostics Test Suite",
  "version": "1.0.0",
  "tests": [
    {
      "name": "unclosed parenthesis",
      "expression": "Patient.name.where(active = true",
      "modes": ["standard", "diagnostic"],
      "expected": {
        "diagnostics": [{
          "code": "UNCLOSED_PARENTHESIS",
          "severity": "error",
          "message": "Unclosed parenthesis - missing ')' to close function call",
          "range": {
            "start": { "line": 0, "column": 18 },
            "end": { "line": 0, "column": 19 }
          }
        }],
        "hasErrors": true,
        "isPartial": true
      }
    },
    {
      "name": "multiple errors",
      "expression": "Patient..name[.given",
      "modes": ["diagnostic"],
      "expected": {
        "diagnosticCount": 3,
        "hasErrors": true
      }
    }
  ]
}
```

#### Smart Matrix Test Runner

Implement an intelligent test runner that:

1. **Mode-Aware Execution**: Only runs tests for applicable modes
2. **Parallel Testing**: Tests different modes concurrently
3. **Performance Tracking**: Measures overhead per mode
4. **Differential Testing**: Compares outputs across modes

```typescript
class SmartMatrixRunner {
  async runTests(testFile: string) {
    const suite = await loadTestSuite(testFile);
    
    // Group tests by applicable modes
    const modeGroups = this.groupTestsByModes(suite.tests);
    
    // Run tests in parallel for each mode
    const results = await Promise.all(
      Object.entries(modeGroups).map(([mode, tests]) =>
        this.runModeTests(mode as ParserMode, tests)
      )
    );
    
    // Generate performance comparison matrix
    this.generatePerformanceMatrix(results);
    
    // Validate mode consistency
    this.validateModeConsistency(results);
  }
  
  private validateModeConsistency(results: TestResults[]) {
    // Ensure Fast mode AST matches other modes (when no errors)
    // Verify diagnostic counts increase with mode complexity
    // Check that Diagnostic mode with trivia includes all base diagnostics
  }
}
```

Benefits of this approach:
- **Maintainable**: Test cases in JSON are easy to add and modify
- **Mode Coverage**: Ensures each mode is tested appropriately
- **Performance Visibility**: Clear view of performance impact per mode
- **Regression Prevention**: Catches mode-specific regressions
- **Documentation**: Test cases serve as specification

#### Test Organization

Following ADR-008's structure, parser diagnostic tests should be organized as:

```
test-cases/
├── parser/
│   ├── diagnostics/
│   │   ├── error-recovery.json
│   │   ├── multiple-errors.json
│   │   ├── range-accuracy.json
│   │   └── contextual-messages.json
│   ├── modes/
│   │   ├── fast-mode.json
│   │   ├── standard-mode.json
│   │   ├── diagnostic-mode.json
│   │   └── validation-mode.json
│   └── performance/
│       └── mode-benchmarks.json
```

This structure allows:
- Clear separation of concerns
- Easy location of specific test types
- Consistent with existing test organization
- Simple addition of new test categories

## Future Enhancements

1. **Semantic Diagnostics**: Type-level warnings from the analyzer
2. **Code Smell Detection**: Warn about inefficient patterns
3. **Style Diagnostics**: Enforce FHIRPath best practices
4. **Quick Fixes**: Automated corrections for common errors
5. **Diagnostic Suppression**: Allow ignoring specific warnings

## Dependencies

- Parser implementation (ADR-002)
- Error handling design from API (ADR-010)
- Test cases organization (ADR-008) - for JSON test format
- Will enable LSP implementation (ADR-005)

## References

- [Language Server Protocol Specification - Diagnostics](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#diagnostic)
- [TypeScript Parser Error Recovery](https://github.com/microsoft/TypeScript/wiki/Architectural-Overview#error-recovery)
- [Roslyn Parser Error Recovery](https://github.com/dotnet/roslyn/blob/main/docs/compilers/Error%20Recovery.md)