# Task 025: Parser Diagnostics Phase 1 - Core Infrastructure and Basic Modes

## Overview
Implement the foundational mode-based parser architecture with Fast and Standard modes, establishing the core diagnostic infrastructure while maintaining backward compatibility.

## Background
As defined in ADR-012, we're implementing a mode-based parser architecture to support different performance/feature trade-offs. This first phase establishes the foundation.

## Scope

### 1. Core Types and Interfaces
- [ ] Create `src/parser/types.ts` with:
  - `ParserMode` enum (Fast, Standard, Diagnostic, Validate)
  - `ParserOptions` interface
  - `ParseResult` union type
  - Mode-specific result interfaces

### 2. Diagnostic Infrastructure
- [ ] Create `src/parser/diagnostics.ts` with:
  - `ParseDiagnostic` interface
  - `DiagnosticSeverity` enum
  - `TextRange` and `Position` interfaces
  - `DiagnosticCollector` class (basic implementation)

### 3. Source Mapping
- [ ] Create `src/parser/source-mapper.ts` with:
  - `SourceMapper` class
  - `tokenToRange()` method
  - `offsetToPosition()` method
  - Line offset caching for performance

### 4. Parser Refactoring
- [ ] Update `src/parser/parser.ts`:
  - Add mode field and initialization
  - Implement `initializeForMode()` method
  - Update `parse()` to return `ParseResult`
  - Maintain Fast mode as current behavior
  - Implement Standard mode with basic diagnostics

### 5. API Updates
- [ ] Update `src/api/index.ts`:
  - Export new `parse()` function with options
  - Add `parseForEvaluation()` convenience function
  - Export diagnostic types

### 6. Error Code Extensions
- [ ] Update `src/api/errors.ts`:
  - Add parser-specific error codes
  - Ensure compatibility with diagnostic system

## Implementation Steps

### Step 1: Core Types
```typescript
// src/parser/types.ts
export enum ParserMode {
  Fast = 'fast',
  Standard = 'standard',
  Diagnostic = 'diagnostic',
  Validate = 'validate'
}

export interface ParserOptions {
  mode?: ParserMode;
  maxErrors?: number;
}

export type ParseResult = FastParseResult | StandardParseResult | DiagnosticParseResult | ValidationResult;

export interface FastParseResult {
  ast: ASTNode;
}

export interface StandardParseResult {
  ast: ASTNode;
  diagnostics: ParseDiagnostic[];
  hasErrors: boolean;
}
```

### Step 2: Basic Diagnostic Collector
```typescript
// src/parser/diagnostics.ts
export class DiagnosticCollector {
  private diagnostics: ParseDiagnostic[] = [];
  private errorCount = 0;
  
  addError(range: TextRange, message: string, code: ErrorCode): void {
    this.diagnostics.push({
      range,
      severity: DiagnosticSeverity.Error,
      code,
      message,
      source: 'fhirpath-parser'
    });
    this.errorCount++;
  }
  
  getDiagnostics(): ParseDiagnostic[] {
    return [...this.diagnostics];
  }
  
  hasErrors(): boolean {
    return this.errorCount > 0;
  }
}
```

### Step 3: Parser Mode Integration
```typescript
// Update parser constructor
constructor(input: string, options: ParserOptions = {}) {
  this.mode = options.mode ?? ParserMode.Standard;
  this.tokens = lex(input);
  this.initializeForMode(input, options);
}

private initializeForMode(input: string, options: ParserOptions): void {
  switch (this.mode) {
    case ParserMode.Fast:
      // No diagnostic infrastructure
      break;
    case ParserMode.Standard:
      this.diagnostics = new DiagnosticCollector();
      this.sourceMapper = new SourceMapper(input);
      break;
  }
}
```

## Definition of Done

### Tests Required

#### 1. Mode Selection Tests (`test/parser/parser-modes.test.ts`)
```typescript
describe('Parser Modes', () => {
  it('defaults to Standard mode', () => {
    const result = parse('Patient.name');
    expect(isStandardResult(result)).toBe(true);
  });
  
  it('uses Fast mode when specified', () => {
    const result = parse('Patient.name', { mode: ParserMode.Fast });
    expect('diagnostics' in result).toBe(false);
  });
  
  it('returns diagnostics in Standard mode', () => {
    const result = parse('Patient..name', { mode: ParserMode.Standard });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.hasErrors).toBe(true);
  });
});
```

#### 2. Diagnostic Collection Tests (`test/parser/diagnostics.test.ts`)
```typescript
describe('DiagnosticCollector', () => {
  it('collects multiple diagnostics', () => {
    const collector = new DiagnosticCollector();
    collector.addError(mockRange, 'Error 1', ErrorCode.SYNTAX_ERROR);
    collector.addError(mockRange, 'Error 2', ErrorCode.UNEXPECTED_TOKEN);
    
    expect(collector.getDiagnostics()).toHaveLength(2);
    expect(collector.hasErrors()).toBe(true);
  });
  
  it('preserves diagnostic order', () => {
    // Test that diagnostics are returned in order added
  });
});
```

#### 3. Source Mapper Tests (`test/parser/source-mapper.test.ts`)
```typescript
describe('SourceMapper', () => {
  it('converts offset to position correctly', () => {
    const mapper = new SourceMapper('line1\nline2\nline3');
    expect(mapper.offsetToPosition(0)).toEqual({ line: 0, character: 0, offset: 0 });
    expect(mapper.offsetToPosition(6)).toEqual({ line: 1, character: 0, offset: 6 });
  });
  
  it('maps tokens to ranges', () => {
    const token: Token = { 
      type: TokenType.IDENTIFIER, 
      value: 'Patient',
      position: { line: 0, column: 0, offset: 0 }
    };
    const range = mapper.tokenToRange(token);
    expect(range.end.character).toBe(7); // "Patient" length
  });
});
```

#### 4. Backward Compatibility Tests (`test/parser/compatibility.test.ts`)
```typescript
describe('Backward Compatibility', () => {
  it('Fast mode matches current parser behavior', () => {
    const expression = 'Patient.name.given';
    const oldResult = currentParse(expression); // Current implementation
    const newResult = parse(expression, { mode: ParserMode.Fast });
    
    expect((newResult as FastParseResult).ast).toEqual(oldResult);
  });
  
  it('Fast mode throws on first error like current parser', () => {
    expect(() => parse('Patient..name', { mode: ParserMode.Fast }))
      .toThrow(ParseError);
  });
});
```

#### 5. API Tests (`test/api/parse-api.test.ts`)
```typescript
describe('Parse API', () => {
  it('parseForEvaluation returns AST directly', () => {
    const ast = parseForEvaluation('Patient.name');
    expect(ast.type).toBe(NodeType.Binary);
  });
  
  it('type guards work correctly', () => {
    const result = parse('Patient.name');
    if (isStandardResult(result)) {
      expect(result.diagnostics).toBeDefined();
    }
  });
});
```

### Performance Criteria
- [ ] Fast mode maintains 100% of current performance
- [ ] Standard mode performs within 95% of Fast mode
- [ ] Run benchmark suite: `bun test:benchmark`

### Documentation
- [ ] Update parser documentation with mode descriptions
- [ ] Add examples for each mode
- [ ] Document breaking changes (if any)

## Success Criteria
1. All existing tests pass with Fast mode
2. Standard mode correctly reports basic diagnostics
3. No performance regression in Fast mode
4. Clean API with type-safe result handling
5. Source mapping works correctly for all positions

## Dependencies
- Current parser implementation
- Lexer token types
- Error code definitions

## Estimated Effort
- Core types and interfaces: 2 hours
- Diagnostic infrastructure: 3 hours
- Source mapper: 3 hours
- Parser refactoring: 4 hours
- API updates: 2 hours
- Tests: 4 hours
- **Total: ~18 hours**

## Notes
- Maintain strict backward compatibility in Fast mode
- Focus on clean architecture over features in this phase
- Ensure all infrastructure is extensible for Phase 2
- Consider using existing test expressions from test-cases/