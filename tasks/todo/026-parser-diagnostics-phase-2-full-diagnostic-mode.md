# Task 026: Parser Diagnostics Phase 2 - Full Diagnostic Mode

## Overview
Implement comprehensive error recovery, contextual error reporting, and full diagnostic capabilities for the Diagnostic mode, including AST error nodes and advanced position tracking.

## Background
Building on Phase 1's infrastructure, this phase implements the full Diagnostic mode with error recovery, enabling IDEs and language servers to provide rich feedback even for malformed expressions.

## Prerequisites
- Phase 1 completed (core infrastructure, Fast/Standard modes)
- DiagnosticCollector and SourceMapper available
- Mode-based parser architecture in place

## Scope

### 1. Error Recovery Infrastructure
- [ ] Implement error recovery in parser
- [ ] Add synchronization points
- [ ] Create error recovery strategy

### 2. Enhanced AST Nodes
- [ ] Add to `src/parser/ast.ts`:
  - `NodeType.Error` and `NodeType.Incomplete`
  - `ErrorNode` interface
  - `IncompleteNode` interface
  - Range tracking for all nodes

### 3. Contextual Error Reporter
- [ ] Create `src/parser/error-reporter.ts`:
  - `ContextualErrorReporter` class
  - `ParseContext` enum
  - Token description utilities
  - Context-aware message building

### 4. Diagnostic Messages
- [ ] Create `src/parser/diagnostic-messages.ts`:
  - `FHIRPathDiagnostics` static factory
  - Common diagnostic creators
  - Related information support

### 5. Parser Enhancement
- [ ] Update `src/parser/parser.ts`:
  - Add error recovery methods
  - Implement Diagnostic mode parsing
  - Track parsing context
  - Generate partial AST on errors

### 6. Range Calculation
- [ ] Enhance `SourceMapper`:
  - `nodeToRange()` method
  - `calculateNodeEnd()` for all node types
  - Lazy range calculation support

## Implementation Steps

### Step 1: Error Node Types
```typescript
// src/parser/ast.ts
export enum NodeType {
  // ... existing types ...
  Error = 'Error',
  Incomplete = 'Incomplete'
}

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
```

### Step 2: Error Recovery Implementation
```typescript
// src/parser/parser.ts
private recoverFromError(expected: string, context: ParseContext): ASTNode {
  const errorToken = this.peek();
  
  // Report error if in diagnostic mode
  if (this.errorReporter) {
    this.errorReporter.reportExpectedToken(
      this.getExpectedTokens(context),
      errorToken,
      context
    );
  }
  
  // Skip to synchronization point
  while (!this.isAtEnd() && !this.isAtSyncPoint()) {
    this.advance();
  }
  
  // Create error node
  return this.createErrorNode(errorToken, expected);
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

### Step 3: Contextual Error Reporter
```typescript
// src/parser/error-reporter.ts
export class ContextualErrorReporter {
  constructor(
    private sourceMapper: SourceMapper,
    private collector: DiagnosticCollector
  ) {}
  
  reportExpectedToken(
    expected: TokenType[],
    actual: Token,
    context: ParseContext
  ): void {
    const message = this.buildContextualMessage(expected, actual, context);
    const range = this.sourceMapper.tokenToRange(actual);
    
    this.collector.addError(range, message, ErrorCode.UNEXPECTED_TOKEN);
  }
  
  private buildContextualMessage(
    expected: TokenType[],
    actual: Token,
    context: ParseContext
  ): string {
    const expectedDesc = this.describeTokens(expected);
    const actualDesc = this.describeToken(actual);
    
    switch (context) {
      case ParseContext.FunctionCall:
        return `Expected ${expectedDesc} in function call, found ${actualDesc}`;
      case ParseContext.IndexExpression:
        return `Expected ${expectedDesc} in index expression, found ${actualDesc}`;
      default:
        return `Expected ${expectedDesc}, found ${actualDesc}`;
    }
  }
}
```

### Step 4: Enhanced Parsing with Recovery
```typescript
// Update expression parsing methods
private parseFunctionCall(name: ASTNode): ASTNode {
  const lparen = this.consume(TokenType.LPAREN, "Expected '(' after function name");
  if (!lparen && this.mode === ParserMode.Diagnostic) {
    return this.recoverFromError("'('", ParseContext.FunctionCall);
  }
  
  const args: ASTNode[] = [];
  while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
    try {
      args.push(this.expression());
      if (!this.match(TokenType.COMMA)) break;
    } catch (e) {
      if (this.mode === ParserMode.Diagnostic) {
        args.push(this.recoverFromError("expression", ParseContext.FunctionCall));
      } else {
        throw e;
      }
    }
  }
  
  const rparen = this.consume(TokenType.RPAREN, "Expected ')' after arguments");
  if (!rparen && this.mode === ParserMode.Diagnostic) {
    // Report unclosed parenthesis
    this.errorReporter?.reportUnclosedDelimiter(lparen, ')');
  }
  
  return this.createFunctionNode(name, args, lparen, rparen);
}
```

## Definition of Done

### Tests Required

#### 1. Error Recovery Tests (`test/parser/error-recovery.test.ts`)
```typescript
describe('Error Recovery', () => {
  it('recovers from missing closing parenthesis', () => {
    const result = parse('Patient.where(active = true', { 
      mode: ParserMode.Diagnostic 
    });
    
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe(ErrorCode.UNCLOSED_PARENTHESIS);
    expect(result.isPartial).toBe(true);
    expect(result.ast).toBeDefined(); // Partial AST created
  });
  
  it('recovers from multiple errors', () => {
    const result = parse('Patient..name[.given', { 
      mode: ParserMode.Diagnostic 
    });
    
    expect(result.diagnostics.length).toBeGreaterThan(1);
    expect(result.ast).toContainErrorNodes();
  });
  
  it('finds correct synchronization points', () => {
    const result = parse('Patient.name(, other', { 
      mode: ParserMode.Diagnostic 
    });
    
    // Should recover at comma and continue parsing
    expect(result.ast).toHaveProperty('right');
  });
});
```

#### 2. Contextual Error Tests (`test/parser/contextual-errors.test.ts`)
```typescript
describe('Contextual Error Messages', () => {
  it('provides context-specific messages for function calls', () => {
    const result = parse('Patient.where(])', { 
      mode: ParserMode.Diagnostic 
    });
    
    const diagnostic = result.diagnostics[0];
    expect(diagnostic.message).toContain('in function call');
    expect(diagnostic.message).toContain("Expected expression");
  });
  
  it('describes tokens in human-readable form', () => {
    const result = parse('Patient.name[', { 
      mode: ParserMode.Diagnostic 
    });
    
    expect(result.diagnostics[0].message).toContain("Expected expression in index");
  });
});
```

#### 3. Range Accuracy Tests (`test/parser/range-tracking.test.ts`)
```typescript
describe('Range Tracking', () => {
  it('calculates accurate ranges for all node types', () => {
    const result = parse('Patient.name.given.first()', { 
      mode: ParserMode.Diagnostic 
    });
    
    const ast = result.ast;
    expect(ast.range).toEqual({
      start: { line: 0, character: 0, offset: 0 },
      end: { line: 0, character: 26, offset: 26 }
    });
  });
  
  it('tracks ranges for error nodes', () => {
    const result = parse('Patient..name', { 
      mode: ParserMode.Diagnostic 
    });
    
    const errorNode = findErrorNode(result.ast);
    expect(errorNode.range).toBeDefined();
  });
});
```

#### 4. AST Error Node Tests (`test/parser/error-nodes.test.ts`)
```typescript
describe('Error Nodes in AST', () => {
  it('creates ErrorNode for invalid syntax', () => {
    const result = parse('Patient.[0]', { 
      mode: ParserMode.Diagnostic 
    });
    
    const errorNode = findNodeOfType(result.ast, NodeType.Error);
    expect(errorNode).toBeDefined();
    expect(errorNode.diagnostic).toBeDefined();
  });
  
  it('creates IncompleteNode for partial expressions', () => {
    const result = parse('Patient.name.', { 
      mode: ParserMode.Diagnostic 
    });
    
    const incompleteNode = findNodeOfType(result.ast, NodeType.Incomplete);
    expect(incompleteNode.missingParts).toContain('property');
  });
});
```

#### 5. Diagnostic Factory Tests (`test/parser/diagnostic-messages.test.ts`)
```typescript
describe('FHIRPathDiagnostics', () => {
  it('creates specific diagnostic for double dot', () => {
    const diagnostic = FHIRPathDiagnostics.doubleDotOperator(
      firstDotToken,
      secondDotToken,
      mapper
    );
    
    expect(diagnostic.code).toBe(ErrorCode.INVALID_OPERATOR);
    expect(diagnostic.message).toContain("Invalid '..' operator");
  });
  
  it('includes related information when applicable', () => {
    const diagnostic = FHIRPathDiagnostics.missingFunctionArguments(
      functionNode,
      mapper
    );
    
    expect(diagnostic.relatedInformation).toHaveLength(1);
    expect(diagnostic.relatedInformation[0].message).toContain("Function defined here");
  });
});
```

### JSON Test Cases
Create `test-cases/parser/diagnostics/error-recovery.json`:
```json
{
  "name": "Error Recovery Test Suite",
  "tests": [
    {
      "name": "recovers from unclosed parenthesis",
      "expression": "Patient.where(active = true",
      "mode": "diagnostic",
      "expected": {
        "diagnosticCount": 1,
        "hasErrors": true,
        "isPartial": true,
        "firstDiagnostic": {
          "code": "UNCLOSED_PARENTHESIS",
          "severity": "error"
        }
      }
    },
    {
      "name": "multiple errors with recovery",
      "expression": "Patient..name[.given",
      "mode": "diagnostic",
      "expected": {
        "diagnosticCount": 3,
        "errorNodeCount": 2
      }
    }
  ]
}
```

### Performance Criteria
- [ ] Diagnostic mode performs within 80-85% of Fast mode
- [ ] Error recovery doesn't cause infinite loops
- [ ] Memory usage remains reasonable with many errors

### Integration Tests
- [ ] Diagnostic mode works with all existing test expressions
- [ ] Partial ASTs are valid and traversable
- [ ] Error nodes don't break AST visitors

## Success Criteria
1. Parser recovers from common syntax errors
2. All errors in an expression are reported
3. Contextual messages help users fix issues
4. Partial ASTs enable IDE features for incomplete code
5. Range information is accurate for all nodes
6. Performance within expected bounds

## Dependencies
- Phase 1 completed
- Existing AST node types
- Error code definitions

## Estimated Effort
- Error recovery implementation: 4 hours
- Enhanced AST nodes: 2 hours
- Contextual error reporter: 3 hours
- Diagnostic messages: 2 hours
- Parser enhancements: 4 hours
- Range calculation: 3 hours
- Tests: 5 hours
- **Total: ~23 hours**

## Notes
- Focus on common error patterns from real usage
- Ensure error recovery doesn't mask critical syntax issues
- Consider future incremental parsing needs
- Test with malformed expressions from test-cases/