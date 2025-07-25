# Parser Diagnostics Source Generation

## Overview

This document outlines required improvements to the FHIRPath parser to generate detailed diagnostic information. The parser will serve as the diagnostic source, while auxiliary actions, quick fixes, and LSP-specific features will be implemented in a dedicated package.

## Current State Analysis

### Existing Parser Capabilities
- **Pratt Parser Implementation**: Uses recursive descent with Pratt parsing for operator precedence
- **Basic Error Handling**: `ParseError` class with position tracking
- **AST Generation**: Complete AST with position information
- **Error Recovery**: Limited synchronization points implemented

### Current Error Structure
```typescript
interface Location {
  line: number;
  column: number;
  offset: number;
  length: number;
}

class ParseError extends Error {
  constructor(message: string, public position: Position, public token: Token)
}

class FHIRPathError extends Error {
  constructor(message: string, public code: ErrorCode, public location?: Location, public expression?: string)
}
```

### Identified Limitations
1. **Location Information Lost**: Parser errors have `Position` but API converts to `FHIRPathError` without proper `Location` mapping
2. **No Error Recovery**: Parser stops at first error, preventing multiple diagnostic collection
3. **Limited Error Context**: Generic "Expected expression" messages without specific guidance
4. **No Range Information**: Only single position tracking, missing error spans
5. **No Severity Levels**: All errors treated equally, no warnings or hints
6. **No Related Information**: Cannot reference related code locations

## Parser Diagnostic Requirements

### Core Diagnostic Information
The parser should generate structured diagnostic information including:

1. **Precise Location Data**: Exact position and range information for each diagnostic
2. **Error Classification**: Categorized error types with specific codes
3. **Contextual Messages**: Detailed, helpful error descriptions
4. **Multiple Diagnostics**: Collect all issues in a single parse pass
5. **Related Information**: Link related locations and provide context

### Required Capabilities
1. **Error Recovery**: Continue parsing after errors to find additional issues
2. **Range Calculation**: Map AST nodes and tokens to exact text ranges
3. **Diagnostic Collection**: Accumulate multiple diagnostics during parsing
4. **Context Tracking**: Maintain parsing context for better error messages

## Improvement Plan

### Phase 1: Enhanced Error Recovery

#### 1.1 Parser Error Recovery
```typescript
class FHIRPathParser {
  private diagnostics: ParseDiagnostic[] = [];
  private isInErrorRecovery: boolean = false;
  
  // Enhanced error handling with recovery
  private recoverFromError(expected: string): ASTNode | null {
    this.reportError(expected);
    this.isInErrorRecovery = true;
    
    // Skip tokens until synchronization point
    while (!this.isAtEnd() && !this.isAtSyncPoint()) {
      this.advance();
    }
    
    this.isInErrorRecovery = false;
    return this.createErrorNode();
  }
  
  // Extended synchronization points
  private isAtSyncPoint(): boolean {
    const token = this.peek();
    return token.type === TokenType.COMMA ||
           token.type === TokenType.RPAREN ||
           token.type === TokenType.RBRACKET ||
           token.type === TokenType.RBRACE ||
           token.type === TokenType.PIPE ||
           token.type === TokenType.AND ||
           token.type === TokenType.OR ||
           this.isOperatorKeyword(token.type);
  }
  
  // Create error node for partial AST
  private createErrorNode(): ASTNode {
    return {
      type: NodeType.Error,
      position: this.peek().position,
      diagnostic: this.diagnostics[this.diagnostics.length - 1]
    } as ErrorNode;
  }
}
```

#### 1.2 Enhanced Error Node Type
```typescript
enum NodeType {
  // ... existing types
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
```

#### 1.3 Diagnostic Collection
```typescript
interface ParseDiagnostic {
  range: TextRange;
  severity: DiagnosticSeverity;
  code: ErrorCode;
  message: string;
  source: 'fhirpath-parser';
  relatedInformation?: RelatedInformation[];
}

interface TextRange {
  start: Position;
  end: Position;
}

interface RelatedInformation {
  location: TextRange;
  message: string;
}

class DiagnosticCollector {
  private diagnostics: ParseDiagnostic[] = [];
  
  addError(range: TextRange, message: string, code: ErrorCode): void;
  addWarning(range: TextRange, message: string, code: ErrorCode): void;
  addInfo(range: TextRange, message: string, code: ErrorCode): void;
  
  getDiagnostics(): ParseDiagnostic[];
  clear(): void;
}
```

### Phase 2: Position Mapping Enhancement

#### 2.1 Source Position Tracking
```typescript
class SourceMapper {
  constructor(private source: string) {}
  
  // Convert token position to LSP range
  tokenToRange(token: Token): TextRange {
    const start = this.offsetToPosition(token.position.offset);
    const end = this.offsetToPosition(token.position.offset + token.value.length);
    return { start, end };
  }
  
  // Convert AST node to text range
  nodeToRange(node: ASTNode): TextRange {
    const start = this.offsetToPosition(node.position.offset);
    const end = this.calculateNodeEnd(node);
    return { start, end };
  }
  
  // Calculate end position of AST node
  private calculateNodeEnd(node: ASTNode): Position {
    switch (node.type) {
      case NodeType.Binary:
        const binary = node as BinaryNode;
        return this.nodeToRange(binary.right).end;
      case NodeType.Function:
        const func = node as FunctionNode;
        // Find closing parenthesis
        return this.findClosingParen(func);
      // ... handle all node types
    }
  }
  
  // Convert offset to line/character position
  private offsetToPosition(offset: number): Position {
    let line = 0;
    let character = 0;
    
    for (let i = 0; i < offset && i < this.source.length; i++) {
      if (this.source[i] === '\n') {
        line++;
        character = 0;
      } else {
        character++;
      }
    }
    
    return { line, character };
  }
}
```

#### 2.2 Enhanced AST Position Information
```typescript
interface ASTNode {
  type: NodeType;
  position: Position;
  range?: TextRange;        // Full text range
  // ... existing fields
}

// Enhance parser to track ranges
class FHIRPathParser {
  private sourceMapper: SourceMapper;
  
  constructor(input: string) {
    this.sourceMapper = new SourceMapper(input);
    // ... existing initialization
  }
  
  // Wrap node creation with range calculation
  private createNode<T extends ASTNode>(type: NodeType, startToken: Token): T {
    const node = {
      type,
      position: startToken.position,
      range: this.sourceMapper.tokenToRange(startToken)
    } as T;
    
    return node;
  }
  
  // Update range after node completion
  private finalizeNode<T extends ASTNode>(node: T, endToken?: Token): T {
    if (endToken) {
      const endRange = this.sourceMapper.tokenToRange(endToken);
      node.range = {
        start: node.range!.start,
        end: endRange.end
      };
    }
    return node;
  }
}
```

### Phase 3: Contextual Error Messages

#### 3.1 Context-Aware Error Reporting
```typescript
class ContextualErrorReporter {
  constructor(private parser: FHIRPathParser, private collector: DiagnosticCollector) {}
  
  // Report expected token with context
  reportExpectedToken(expected: TokenType[], actual: Token, context: ParseContext): void {
    const message = this.buildContextualMessage(expected, actual, context);
    const range = this.parser.sourceMapper.tokenToRange(actual);
    
    this.collector.addError(range, message, ErrorCode.UNEXPECTED_TOKEN);
  }
  
  // Build helpful error messages
  private buildContextualMessage(expected: TokenType[], actual: Token, context: ParseContext): string {
    const expectedDesc = this.describeTokens(expected);
    const actualDesc = this.describeToken(actual);
    
    switch (context) {
      case ParseContext.FunctionCall:
        return `Expected ${expectedDesc} in function call, but found ${actualDesc}`;
      case ParseContext.IndexExpression:
        return `Expected ${expectedDesc} in index expression, but found ${actualDesc}`;
      case ParseContext.BinaryExpression:
        return `Expected ${expectedDesc} in expression, but found ${actualDesc}`;
      default:
        return `Expected ${expectedDesc}, but found ${actualDesc}`;
    }
  }
  
  // Convert token types to human-readable descriptions
  private describeTokens(tokens: TokenType[]): string {
    if (tokens.length === 1) {
      return this.getTokenDescription(tokens[0]);
    }
    
    const descriptions = tokens.map(t => this.getTokenDescription(t));
    const last = descriptions.pop();
    return `${descriptions.join(', ')} or ${last}`;
  }
  
  private getTokenDescription(token: TokenType): string {
    switch (token) {
      case TokenType.IDENTIFIER: return 'an identifier';
      case TokenType.LPAREN: return "'('";
      case TokenType.RPAREN: return "')'";
      case TokenType.DOT: return "'.'";
      case TokenType.LBRACKET: return "'['";
      case TokenType.RBRACKET: return "']'";
      // ... all token types
      default: return `'${token}'`;
    }
  }
}

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

#### 3.2 Specific Error Types
```typescript
class FHIRPathDiagnostics {
  // Unclosed parenthesis
  static unclosedParenthesis(openParen: Token): ParseDiagnostic {
    return {
      range: sourceMapper.tokenToRange(openParen),
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.UNCLOSED_PARENTHESIS,
      message: "Unclosed parenthesis - missing ')' to close function call or grouping",
      source: 'fhirpath-parser'
    };
  }
  
  // Missing function arguments
  static missingFunctionArguments(func: FunctionNode): ParseDiagnostic {
    return {
      range: sourceMapper.nodeToRange(func),
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.MISSING_ARGUMENTS,
      message: `Function '${func.name}' requires arguments`,
      source: 'fhirpath-parser',
      relatedInformation: [{
        location: sourceMapper.nodeToRange(func.name),
        message: "Function defined here"
      }]
    };
  }
  
  // Double dot operator
  static doubleDotOperator(firstDot: Token, secondDot: Token): ParseDiagnostic {
    const range = {
      start: sourceMapper.tokenToRange(firstDot).start,
      end: sourceMapper.tokenToRange(secondDot).end
    };
    
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.INVALID_OPERATOR,
      message: "Invalid '..' operator - use single '.' for navigation",
      source: 'fhirpath-parser'
    };
  }
}
```

### Phase 4: Integration with Parser

#### 4.1 Modified Parser Interface
```typescript
interface ParseResult {
  ast: ASTNode;
  diagnostics: ParseDiagnostic[];
  hasErrors: boolean;
  isPartial: boolean;  // Contains error nodes
}

class FHIRPathParser {
  private diagnostics: DiagnosticCollector;
  private sourceMapper: SourceMapper;
  private errorReporter: ContextualErrorReporter;
  
  constructor(input: string) {
    this.sourceMapper = new SourceMapper(input);
    this.diagnostics = new DiagnosticCollector();
    this.errorReporter = new ContextualErrorReporter(this, this.diagnostics);
    // ... existing initialization
  }
  
  // Enhanced parse method
  parse(): ParseResult {
    try {
      const ast = this.expression();
      
      if (!this.isAtEnd() && !this.diagnostics.hasErrors()) {
        this.errorReporter.reportUnexpectedToken(this.peek(), ParseContext.Expression);
      }
      
      return {
        ast,
        diagnostics: this.diagnostics.getDiagnostics(),
        hasErrors: this.diagnostics.hasErrors(),
        isPartial: this.hasErrorNodes(ast)
      };
    } catch (error) {
      // Handle catastrophic errors
      return {
        ast: this.createErrorNode(),
        diagnostics: this.diagnostics.getDiagnostics(),
        hasErrors: true,
        isPartial: true
      };
    }
  }
  
  // Check if AST contains error nodes
  private hasErrorNodes(node: ASTNode): boolean {
    if (node.type === NodeType.Error || node.type === NodeType.Incomplete) {
      return true;
    }
    
    // Recursively check child nodes
    switch (node.type) {
      case NodeType.Binary:
        const binary = node as BinaryNode;
        return this.hasErrorNodes(binary.left) || this.hasErrorNodes(binary.right);
      case NodeType.Function:
        const func = node as FunctionNode;
        return this.hasErrorNodes(func.name) || func.arguments.some(arg => this.hasErrorNodes(arg));
      // ... handle all node types
    }
    
    return false;
  }
}
```

#### 4.2 API Integration
```typescript
// Enhanced public API
export function parseWithDiagnostics(expression: string): ParseResult {
  const parser = new FHIRPathParser(expression);
  return parser.parse();
}

// Diagnostic export for external packages
export function getDiagnostics(expression: string): ParseDiagnostic[] {
  const result = parseWithDiagnostics(expression);
  return result.diagnostics;
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure (Week 1)
1. Implement `DiagnosticCollector` and enhanced error types
2. Add error recovery mechanisms to parser
3. Create `SourceMapper` for position tracking
4. Add error and incomplete AST node types

### Phase 2: Enhanced Error Messages (Week 2)
1. Implement `ContextualErrorReporter`
2. Add specific diagnostic types with quick fixes
3. Enhance parser to use contextual reporting
4. Add comprehensive error recovery tests

### Phase 3: Range Calculation (Week 3)
1. Enhance AST nodes with range information
2. Implement accurate range calculation for all node types
3. Add position mapping utilities
4. Test range accuracy across complex expressions

### Phase 4: Integration & Testing (Week 4)
1. Update public API to return diagnostics
2. Add LSP diagnostic conversion utilities
3. Comprehensive testing with error cases
4. Performance optimization for diagnostic collection

## Testing Requirements

### Error Recovery Tests
```typescript
describe('Parser Error Recovery', () => {
  it('should recover from unclosed parentheses', () => {
    const result = parseWithDiagnostics('Patient.name.where(active = true');
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe(ErrorCode.UNCLOSED_PARENTHESIS);
    expect(result.isPartial).toBe(true);
  });
  
  it('should collect multiple errors', () => {
    const result = parseWithDiagnostics('Patient..name[.given');
    expect(result.diagnostics.length).toBeGreaterThan(1);
  });
});
```

### Range Accuracy Tests
```typescript
describe('Position Mapping', () => {
  it('should map token positions correctly', () => {
    const result = parseWithDiagnostics('Patient.name');
    const range = result.ast.range!;
    expect(range.start).toEqual({ line: 0, character: 0 });
    expect(range.end).toEqual({ line: 0, character: 12 });
  });
});
```

### Diagnostic Export Tests
```typescript
describe('Diagnostic Export', () => {
  it('should export diagnostics correctly', () => {
    const diagnostics = getDiagnostics('invalid expression');
    expect(diagnostics[0]).toMatchObject({
      range: expect.any(Object),
      severity: expect.any(Number),
      message: expect.any(String),
      code: expect.any(String),
      source: 'fhirpath-parser'
    });
  });
});
```

## Success Metrics

1. **Error Recovery**: Parser should collect 80%+ of errors in multi-error expressions
2. **Position Accuracy**: Range mapping should be accurate within 1 character for 99%+ of cases
3. **Performance**: Diagnostic collection should add <20% overhead to parsing time
4. **Message Quality**: Error messages should be specific and actionable
5. **Diagnostic Completeness**: All parse errors should generate structured diagnostics

## Future Enhancements

1. **Semantic Diagnostics**: Type-level error reporting from analyzer
2. **Performance Diagnostics**: Warn about potentially slow expressions
3. **Style Diagnostics**: Suggest FHIRPath best practices
4. **Incremental Parsing**: Support partial re-parsing for real-time editing

## Dependencies

1. **Testing**: Enhanced test suite for error scenarios
2. **Documentation**: Update parser documentation with diagnostic capabilities

## Conclusion

These improvements will transform the FHIRPath parser into a robust diagnostic source that generates detailed, structured error information. The enhanced error recovery, precise position mapping, and contextual error messages will provide a solid foundation for external packages to build LSP servers, IDE extensions, and other developer tools.