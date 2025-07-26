# Task 027: Parser Diagnostics Phase 3 - Optimizations and Validate Mode

## Overview
Implement the Validate mode for fast expression validation without AST generation, add trivia tracking for LSP support, optimize performance across all modes, and establish comprehensive benchmarking.

## Background
This final phase completes the parser diagnostics implementation by adding the Validate mode for quick syntax checking and optimizing performance across all modes, including trivia tracking for full LSP support.

## Prerequisites
- Phase 1 and Phase 2 completed
- All diagnostic infrastructure in place
- Error recovery working in Diagnostic mode

## Scope

### 1. Validate Mode Implementation
- [ ] Implement validation-only parsing
- [ ] Skip AST construction
- [ ] Early exit on validity determination
- [ ] Return ValidationResult

### 2. Trivia Tracking
- [ ] Add trivia tracking to Diagnostic mode
- [ ] Create trivia token collection
- [ ] Preserve whitespace and comments
- [ ] Support formatting use cases

### 3. Performance Optimizations
- [ ] Implement lazy range calculation
- [ ] Add line offset caching to SourceMapper
- [ ] Create object pools for common types
- [ ] Optimize diagnostic collection

### 4. Smart Matrix Test Runner
- [ ] Create test runner for mode matrix
- [ ] Implement performance tracking
- [ ] Add differential testing
- [ ] Generate performance reports

### 5. Benchmarking Suite
- [ ] Create comprehensive benchmarks
- [ ] Compare modes performance
- [ ] Memory usage profiling
- [ ] Generate performance matrix

## Implementation Steps

### Step 1: Validate Mode
```typescript
// src/parser/parser.ts
private validateOnly(): boolean {
  try {
    this.validateExpression();
    return !this.diagnostics!.hasErrors();
  } catch (e) {
    return false;
  }
}

private validateExpression(): void {
  // Similar to expression() but without AST construction
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
    // Valid primary
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

### Step 2: Trivia Tracking
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

// Update parser for trivia
private initializeForMode(input: string, options: ParserOptions): void {
  // ... existing code ...
  
  if (options.trackTrivia && this.mode === ParserMode.Diagnostic) {
    this.triviaCollector = new TriviaCollector();
    this.enableTriviaTracking();
  }
}
```

### Step 3: Performance Optimizations
```typescript
// src/parser/optimizations.ts

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

// Object pooling
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  
  constructor(factory: () => T, reset: (obj: T) => void) {
    this.factory = factory;
    this.reset = reset;
  }
  
  acquire(): T {
    return this.pool.pop() || this.factory();
  }
  
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}

// Line offset cache
export class OptimizedSourceMapper extends SourceMapper {
  private lineOffsets: number[] = [];
  
  constructor(source: string) {
    super(source);
    this.buildLineOffsets();
  }
  
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
}
```

### Step 4: Smart Matrix Test Runner
```typescript
// tools/smart-matrix-runner.ts
import type { TestSuite, TestResult } from './test-types';

export class SmartMatrixRunner {
  private results = new Map<ParserMode, TestResult[]>();
  
  async runTests(testFile: string): Promise<void> {
    const suite = await this.loadTestSuite(testFile);
    const modeGroups = this.groupTestsByModes(suite.tests);
    
    // Run tests in parallel for each mode
    const results = await Promise.all(
      Object.entries(modeGroups).map(([mode, tests]) =>
        this.runModeTests(mode as ParserMode, tests)
      )
    );
    
    // Analyze results
    this.generatePerformanceMatrix(results);
    this.validateModeConsistency(results);
    this.generateReport(results);
  }
  
  private async runModeTests(
    mode: ParserMode, 
    tests: Test[]
  ): Promise<ModeResult> {
    const startTime = performance.now();
    const results = [];
    
    for (const test of tests) {
      const result = await this.runSingleTest(test, mode);
      results.push(result);
    }
    
    return {
      mode,
      tests: results,
      totalTime: performance.now() - startTime,
      averageTime: (performance.now() - startTime) / tests.length
    };
  }
  
  private validateModeConsistency(results: ModeResult[]): void {
    // Ensure Fast mode AST matches Standard/Diagnostic (when no errors)
    // Verify diagnostic counts increase with mode complexity
    // Check performance is within expected bounds
  }
}
```

## Definition of Done

### Tests Required

#### 1. Validate Mode Tests (`test/parser/validate-mode.test.ts`)
```typescript
describe('Validate Mode', () => {
  it('validates correct expressions quickly', () => {
    const start = performance.now();
    const result = parse('Patient.name.given', { 
      mode: ParserMode.Validate 
    });
    const duration = performance.now() - start;
    
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(duration).toBeLessThan(fastModeDuration * 0.9);
  });
  
  it('detects invalid expressions without AST', () => {
    const result = parse('Patient..name', { 
      mode: ParserMode.Validate 
    });
    
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect('ast' in result).toBe(false);
  });
  
  it('exits early on first error', () => {
    const result = parse('((((', { 
      mode: ParserMode.Validate 
    });
    
    expect(result.valid).toBe(false);
    // Should not try to validate all parentheses
  });
});
```

#### 2. Trivia Tracking Tests (`test/parser/trivia.test.ts`)
```typescript
describe('Trivia Tracking', () => {
  it('preserves whitespace in diagnostic mode', () => {
    const result = parse('Patient.name  // comment', { 
      mode: ParserMode.Diagnostic,
      trackTrivia: true
    });
    
    expect(result.trivia).toBeDefined();
    expect(result.trivia).toContainEqual({
      type: 'whitespace',
      value: '  ',
      range: expect.any(Object)
    });
  });
  
  it('preserves comments', () => {
    const result = parse('Patient.name /* inline */ .given', { 
      mode: ParserMode.Diagnostic,
      trackTrivia: true
    });
    
    const comment = result.trivia.find(t => t.type === 'comment');
    expect(comment?.value).toBe(' inline ');
  });
  
  it('does not track trivia in other modes', () => {
    const result = parse('Patient.name  // comment', { 
      mode: ParserMode.Standard,
      trackTrivia: true // Should be ignored
    });
    
    expect('trivia' in result).toBe(false);
  });
});
```

#### 3. Performance Optimization Tests (`test/parser/performance.test.ts`)
```typescript
describe('Performance Optimizations', () => {
  it('lazy ranges calculate only when accessed', () => {
    const result = parse('Patient.name.given.first()', { 
      mode: ParserMode.Diagnostic 
    });
    
    // Ranges should not be calculated yet
    const rangeCalculations = spyOn(sourceMapper, 'calculateRange');
    
    // Access range
    const range = result.ast.range;
    
    expect(rangeCalculations).toHaveBeenCalledTimes(1);
  });
  
  it('line offset cache improves position lookup', () => {
    const mapper = new OptimizedSourceMapper(largeSource);
    const iterations = 10000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      mapper.offsetToPosition(Math.random() * largeSource.length);
    }
    const optimizedTime = performance.now() - start;
    
    expect(optimizedTime).toBeLessThan(baselineTime * 0.5);
  });
});
```

#### 4. Mode Matrix Tests (`test/parser/mode-matrix.test.ts`)
```typescript
describe('Parser Mode Matrix', () => {
  const expressions = [
    'Patient.name',
    'Patient.where(active = true).name.given',
    'Patient.name.given[0].substring(0, 1)',
    // ... more test expressions
  ];
  
  it('maintains performance characteristics', () => {
    const results = expressions.map(expr => ({
      expr,
      fast: measureParse(expr, ParserMode.Fast),
      standard: measureParse(expr, ParserMode.Standard),
      diagnostic: measureParse(expr, ParserMode.Diagnostic),
      validate: measureParse(expr, ParserMode.Validate)
    }));
    
    results.forEach(r => {
      expect(r.standard.time).toBeLessThan(r.fast.time * 1.05);
      expect(r.diagnostic.time).toBeLessThan(r.fast.time * 1.25);
      expect(r.validate.time).toBeLessThan(r.fast.time * 0.9);
    });
  });
  
  it('produces consistent ASTs across modes', () => {
    expressions.forEach(expr => {
      const fast = parse(expr, { mode: ParserMode.Fast });
      const standard = parse(expr, { mode: ParserMode.Standard });
      const diagnostic = parse(expr, { mode: ParserMode.Diagnostic });
      
      expect(standard.ast).toEqual(fast.ast);
      expect(diagnostic.ast).toEqual(fast.ast);
    });
  });
});
```

### Benchmark Suite
Create `benchmarks/parser-modes.bench.ts`:
```typescript
import { bench, describe } from 'vitest';

describe('Parser Mode Benchmarks', () => {
  const expressions = {
    simple: 'Patient.name',
    medium: 'Patient.where(active = true).name.given.first()',
    complex: generateComplexExpression(),
    withErrors: 'Patient..name[.given'
  };
  
  Object.entries(expressions).forEach(([name, expr]) => {
    bench(`${name} - Fast mode`, () => {
      parse(expr, { mode: ParserMode.Fast });
    });
    
    bench(`${name} - Standard mode`, () => {
      parse(expr, { mode: ParserMode.Standard });
    });
    
    bench(`${name} - Diagnostic mode`, () => {
      parse(expr, { mode: ParserMode.Diagnostic });
    });
    
    bench(`${name} - Validate mode`, () => {
      parse(expr, { mode: ParserMode.Validate });
    });
  });
});
```

### Performance Criteria
- [ ] Validate mode: 90% of Fast mode performance
- [ ] Diagnostic mode with trivia: 75-80% of Fast mode
- [ ] Memory usage increase < 2x in worst case
- [ ] No memory leaks with object pooling

### Documentation
- [ ] Document performance characteristics
- [ ] Add trivia tracking examples
- [ ] Create mode selection guide
- [ ] Update benchmarking instructions

## Success Criteria
1. Validate mode provides fast syntax checking
2. Trivia tracking enables LSP formatting features
3. Performance optimizations meet targets
4. Smart test runner provides clear insights
5. Benchmark suite tracks performance regressions
6. All modes work correctly with existing test cases

## Dependencies
- Phase 1 and Phase 2 completed
- Existing test infrastructure
- Benchmark tooling (vitest bench)

## Estimated Effort
- Validate mode: 3 hours
- Trivia tracking: 4 hours
- Performance optimizations: 5 hours
- Smart matrix runner: 4 hours
- Benchmark suite: 2 hours
- Tests and documentation: 4 hours
- **Total: ~22 hours**

## Notes
- Validate mode should be significantly faster than parsing
- Trivia tracking only makes sense in Diagnostic mode
- Consider memory vs speed tradeoffs for caching
- Benchmark against real-world expressions
- Document when to use each optimization

## Status: Partially Completed

### What Was Done:
1. **Fixed Parser Error Codes** ✅
   - Updated error() method to accept specific ErrorCode parameter
   - Replaced generic PARSE_ERROR with specific codes like:
     - EXPECTED_EXPRESSION
     - EXPECTED_IDENTIFIER
     - INVALID_OPERATOR
     - UNEXPECTED_TOKEN
     - UNCLOSED_PARENTHESIS/BRACKET/BRACE
   - Added special handling for common mistakes (e.g., "==" instead of "=")

2. **Added Context-Aware Error Messages** ✅
   - Added currentContext tracking to parser
   - Enhanced error messages based on parsing context:
     - "Expected expression in collection" for collection literals
     - "Expected expression in function call" for function arguments
     - Contextual information helps users understand where the error occurred
   - Fixed error message to include what was found (e.g., "Expected expression, found ','")

3. **Fixed Duplicate Diagnostic Reporting** ✅
   - Removed duplicate error reporting in Standard mode catch block
   - Fixed TypeScript errors related to diagnostic structure
   - Ensured errors are only reported once

4. **Parser Tool Enhancement** ✅
   - Updated tools/parser.ts to support parser modes
   - Can now test with: `bun tools/parser.ts "<expression>" [mode]`
   - Modes: fast, standard, diagnostic, validate

### What Was NOT Completed:
1. **Validate Mode Implementation** ❌
   - Still falls back to Standard mode
   - Needs implementation of fast syntax checking without AST

2. **Trivia Tracking** ❌
   - Not implemented for whitespace and comments
   - Would be needed for LSP formatting support

3. **Performance Optimizations** ❌
   - Lazy ranges not implemented
   - Object pooling not implemented
   - Line offset caching not implemented

4. **Smart Matrix Test Runner** ❌
   - Not created

5. **Benchmark Suite** ❌
   - Not created

### Test Results:
- Started with 34 failing tests
- Fixed several issues but many tests still failing due to:
  - Tests expecting errors for valid syntax (e.g., "5 + + 3" is valid as "5 + (+3)")
  - Missing error recovery features (Error/Incomplete nodes)
  - Tests designed for features not yet implemented

### Remaining Work:
The main task objectives (Validate mode, trivia tracking, performance optimizations) were not completed. The work focused on fixing existing parser diagnostic issues that were causing test failures.

## Test Failures Analysis (Added during implementation)

After analyzing the failing tests, here are the main issues that need to be fixed:

### 1. Generic Error Codes
- The parser is using generic `PARSE_ERROR` code for all parsing errors
- Tests expect specific error codes like:
  - `EXPECTED_EXPRESSION` - when expression is expected
  - `EXPECTED_IDENTIFIER` - when identifier is expected
  - `INVALID_OPERATOR` - for invalid operators like `==`
  - `UNEXPECTED_TOKEN` - for unexpected tokens
  - `UNCLOSED_PARENTHESIS`, `UNCLOSED_BRACKET`, `UNCLOSED_BRACE` - for unclosed delimiters
  - `INVALID_CHARACTER` - for invalid characters
  - `UNTERMINATED_STRING` - for unterminated strings
  - `INVALID_ESCAPE` - for invalid escape sequences

### 2. Missing Context in Error Messages
- Tests expect error messages to contain context information like:
  - "Expected expression" should include "found '+'" when appropriate
  - Collection errors should mention "collection" context
  - Function call errors should mention "function call" context
  - Type cast errors should mention type context

### 3. Valid Syntax Interpreted as Errors
- Expression "5 + + 3" is actually valid (parsed as "5 + (+3)")
- Tests may need to be updated for valid expressions

### 4. Double Diagnostic Reporting
- Some errors are reported twice (duplicate diagnostics)
- Need to ensure errors are reported only once

### 5. Missing Error Recovery Features
- Error recovery in Diagnostic mode needs improvement
- Need to create proper Error and Incomplete nodes
- Partial AST generation not fully working

### Additional Work Required:
1. Update error() method to accept ErrorCode parameter
2. Create context-aware error reporting methods
3. Fix duplicate diagnostic reporting
4. Implement proper error recovery with Error/Incomplete nodes
5. Update tests that expect errors for valid syntax
6. Add messageContains validation in test runner