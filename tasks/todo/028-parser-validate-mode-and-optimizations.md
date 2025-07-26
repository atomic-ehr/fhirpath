# Task 029: Parser Validate Mode and Optimizations

## Overview
Complete the unfinished work from Task 027. Implement the Validate mode for fast syntax checking without AST generation, add trivia tracking for LSP support, and implement performance optimizations across all parser modes.

## Background
Task 027 was partially completed with focus on fixing parser diagnostic issues. The main objectives (Validate mode, trivia tracking, and performance optimizations) were not implemented. This task continues that work.

## Prerequisites
- Task 027 partially completed (error codes, context-aware messages, duplicate diagnostic fixes)
- Parser diagnostic infrastructure in place
- Parser modes framework exists but Validate mode not implemented

## Scope

### 1. Validate Mode Implementation (Priority: HIGH)
- [ ] Implement validation-only parsing without AST construction
- [ ] Skip AST node creation for performance
- [ ] Early exit on validity determination
- [ ] Return ValidationResult type properly
- [ ] Ensure Validate mode is significantly faster than Standard mode

### 2. Trivia Tracking (Priority: MEDIUM)
- [ ] Add trivia tracking to Diagnostic mode only
- [ ] Create TriviaToken type and TriviaCollector
- [ ] Track whitespace and comments
- [ ] Preserve trivia for formatting use cases
- [ ] Support single-line (//) and multi-line (/* */) comments

### 3. Performance Optimizations (Priority: MEDIUM)
- [ ] Implement lazy range calculation
- [ ] Add line offset caching to SourceMapper
- [ ] Create object pools for common types (tokens, nodes)
- [ ] Optimize diagnostic collection
- [ ] Measure and document performance improvements

### 4. Smart Matrix Test Runner (Priority: LOW)
- [ ] Create test runner for mode matrix testing
- [ ] Implement performance tracking
- [ ] Add differential testing between modes
- [ ] Generate performance reports
- [ ] Validate mode consistency

### 5. Benchmarking Suite (Priority: LOW)
- [ ] Create comprehensive benchmarks
- [ ] Compare modes performance
- [ ] Memory usage profiling
- [ ] Generate performance matrix
- [ ] Document performance characteristics

## Implementation Plan

### Step 1: Implement Validate Mode
```typescript
// src/parser/parser.ts
private parseValidate(): ValidationResult {
  try {
    this.validateExpression();
    return {
      valid: true,
      diagnostics: this.diagnostics!.getDiagnostics()
    };
  } catch (error) {
    return {
      valid: false,
      diagnostics: this.diagnostics!.getDiagnostics()
    };
  }
}

private validateExpression(): void {
  // Similar to expression() but without creating AST nodes
  this.validatePrimary();
  
  while (!this.isAtEnd()) {
    const token = this.peek();
    const precedence = this.getPrecedence(token);
    
    if (precedence === 0) break;
    
    // Validate binary operation without creating nodes
    this.advance(); // operator
    this.validatePrimary();
  }
}

private validatePrimary(): void {
  if (this.match(TokenType.IDENTIFIER)) {
    // Valid primary - check for function call
    if (this.check(TokenType.LPAREN)) {
      this.validateFunctionCall();
    }
  } else if (this.match(TokenType.NUMBER, TokenType.STRING)) {
    // Valid literal
  } else if (this.match(TokenType.LPAREN)) {
    this.validateExpression();
    this.consume(TokenType.RPAREN, "Expected ')'");
  } else {
    this.error("Expected expression");
  }
}
```

### Step 2: Add Trivia Tracking
```typescript
// src/parser/trivia.ts
export interface TriviaToken {
  type: 'whitespace' | 'comment' | 'line-comment';
  value: string;
  range: TextRange;
}

export class TriviaCollector {
  private trivia: TriviaToken[] = [];
  
  addTrivia(token: Token): void {
    if (token.channel === Channel.HIDDEN) {
      this.trivia.push({
        type: this.getTriviaType(token),
        value: token.value,
        range: this.sourceMapper.tokenToRange(token)
      });
    }
  }
  
  getTriviaBeforePosition(pos: Position): TriviaToken[] {
    return this.trivia.filter(t => 
      t.range.end.offset <= pos.offset
    );
  }
}
```

### Step 3: Performance Optimizations
```typescript
// Lazy range calculation
export class LazyRange {
  private _range?: TextRange;
  
  constructor(
    private startToken: Token,
    private endToken: Token,
    private mapper: SourceMapper
  ) {}
  
  get range(): TextRange {
    if (!this._range) {
      this._range = this.mapper.calculateRange(this.startToken, this.endToken);
    }
    return this._range;
  }
}

// Line offset cache in SourceMapper
private buildLineOffsets(): void {
  this.lineOffsets.push(0);
  for (let i = 0; i < this.source.length; i++) {
    if (this.source[i] === '\n') {
      this.lineOffsets.push(i + 1);
    }
  }
}

offsetToPosition(offset: number): Position {
  // Binary search for line
  const line = this.binarySearchLine(offset);
  return {
    line,
    character: offset - this.lineOffsets[line],
    offset
  };
}
```

## Testing Requirements

### 1. Validate Mode Tests
- Validate correct expressions quickly
- Detect invalid expressions without AST
- Early exit on first error
- Performance comparison with other modes

### 2. Trivia Tests
- Preserve whitespace in diagnostic mode
- Track single-line comments
- Track multi-line comments
- Trivia only in diagnostic mode

### 3. Performance Tests
- Lazy range calculation
- Line offset cache performance
- Object pooling effectiveness
- Overall mode performance comparison

## Success Criteria
1. Validate mode provides >90% performance of Fast mode
2. Trivia tracking enables formatting preservation
3. Performance optimizations show measurable improvements
4. All existing tests continue to pass
5. New tests for all features pass

## Estimated Effort
- Validate mode: 4 hours
- Trivia tracking: 4 hours
- Performance optimizations: 6 hours
- Smart matrix runner: 4 hours
- Benchmark suite: 3 hours
- Testing and documentation: 4 hours
- **Total: ~25 hours**

## Notes
- Validate mode should be the fastest for syntax checking
- Trivia tracking only makes sense in Diagnostic mode
- Performance optimizations should not break existing functionality
- Consider memory vs speed tradeoffs
- Document when to use each mode