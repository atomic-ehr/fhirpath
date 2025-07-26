# Task 030: Parser Diagnostics Phase 4 - API Cleanup and Migration

## Overview
Remove old parser interfaces, migrate all existing code to use the new mode-based API, and update all tests, tools, and documentation to reflect the breaking changes.

## Background
With the new mode-based parser architecture fully implemented, we need to clean up the old API and ensure all consumers throughout the codebase use the new interface. This is a breaking change that requires careful migration.

## Prerequisites
- Phase 1, 2, and 3 completed
- New parser API fully functional
- All modes tested and working

## Scope

### 1. Remove Old Parser API
- [ ] Remove old `parse()` function from `src/parser/parser.ts`
- [ ] Remove direct parser class exports
- [ ] Clean up legacy error handling code
- [ ] Remove unused imports and types

### 2. Update Core API
- [ ] Update `src/api/index.ts` to export only new API
- [ ] Update `src/api/fhirpath.ts` to use new parser
- [ ] Update type exports for new result types
- [ ] Add migration guide to API docs

### 3. Migrate Runtime/Evaluation
- [ ] Update `src/runtime/interpreter.ts`
- [ ] Update `src/runtime/compiler.ts`
- [ ] Update `src/analyzer/analyzer.ts`
- [ ] Fix error handling to use diagnostics

### 4. Update All Tools
- [ ] `tools/parser.ts` - Use appropriate mode
- [ ] `tools/interpreter.ts` - Use Fast mode
- [ ] `tools/compiler.ts` - Use Fast mode
- [ ] `tools/inspect.ts` - Use Diagnostic mode
- [ ] `tools/testcase.ts` - Mode selection based on test
- [ ] `tools/spec.ts` - Update if needed

### 5. Migrate Test Suite
- [ ] Update `test/parser.test.ts`
- [ ] Update `test/interpreter.test.ts`
- [ ] Update `test/compiler.test.ts`
- [ ] Update all test utilities
- [ ] Fix test helper functions

### 6. Update Test Case Runner
- [ ] Update test case runner to handle modes
- [ ] Add mode specification to test cases
- [ ] Update existing test cases

## Implementation Steps

### Step 1: Remove Old API
```typescript
// src/parser/parser.ts - REMOVE:
export function parse(input: string | Token[]): ASTNode {
  const parser = new FHIRPathParser(input);
  return parser.parse();
}

// REMOVE direct class export:
// export { FHIRPathParser };

// Keep only:
export { parse } from '../api'; // New API
```

### Step 2: Update Core API Usage
```typescript
// src/api/fhirpath.ts
import { parse, ParserMode, isStandardResult } from '../parser';

class FHIRPathAPI {
  parse(expression: string): FHIRPathExpression {
    // Use Standard mode for API parsing
    const result = parse(expression, { mode: ParserMode.Standard });
    
    if (isStandardResult(result) && result.hasErrors) {
      // Convert first diagnostic to FHIRPathError
      const diagnostic = result.diagnostics[0];
      throw new FHIRPathError(
        diagnostic.message,
        diagnostic.code,
        {
          line: diagnostic.range.start.line,
          column: diagnostic.range.start.character,
          offset: diagnostic.range.start.offset,
          length: diagnostic.range.end.offset - diagnostic.range.start.offset
        },
        expression
      );
    }
    
    return new FHIRPathExpressionImpl(result.ast, expression);
  }
}
```

### Step 3: Update Runtime Components
```typescript
// src/runtime/interpreter.ts
import { parse, ParserMode, type FastParseResult } from '../parser';

export class Interpreter {
  constructor(private ast: ASTNode) {}
  
  static fromExpression(expression: string): Interpreter {
    // Use Fast mode for production evaluation
    const result = parse(expression, { mode: ParserMode.Fast }) as FastParseResult;
    return new Interpreter(result.ast);
  }
}

// src/runtime/compiler.ts
export class Compiler {
  compile(expression: string): CompiledExpression {
    // Use Fast mode for compilation
    const result = parse(expression, { mode: ParserMode.Fast }) as FastParseResult;
    return this.compileAST(result.ast);
  }
}
```

### Step 4: Update Tools
```typescript
// tools/parser.ts
import { parse, ParserMode, type ParseResult } from '../src/parser';

const expression = process.argv[2];
const mode = (process.argv[3] as ParserMode) || ParserMode.Diagnostic;

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<expression>" [mode]');
  console.error('Modes: fast, standard, diagnostic, validate');
  process.exit(1);
}

try {
  const result = parse(expression, { mode });
  
  if (mode === ParserMode.Validate) {
    console.log(`Valid: ${result.valid}`);
    if (!result.valid) {
      console.log('Diagnostics:', result.diagnostics);
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error('Parse error:', error.message);
  process.exit(1);
}

// tools/interpreter.ts
import { parse, ParserMode, parseForEvaluation } from '../src/parser';

// Simplified - use convenience function
const ast = parseForEvaluation(expression);
const interpreter = new Interpreter(ast);
const result = interpreter.evaluate(input, context);
```

### Step 5: Update Tests
```typescript
// test/parser.test.ts
import { parse, ParserMode, isStandardResult } from '../src/parser';

describe('Parser', () => {
  // Update existing tests
  it('parses simple navigation', () => {
    const result = parse('Patient.name', { mode: ParserMode.Standard });
    expect(isStandardResult(result)).toBe(true);
    expect(result.ast.type).toBe(NodeType.Binary);
    expect(result.hasErrors).toBe(false);
  });
  
  it('reports errors with diagnostics', () => {
    const result = parse('Patient..name', { mode: ParserMode.Standard });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe(ErrorCode.INVALID_OPERATOR);
  });
  
  // Add migration tests
  it('Fast mode throws on error like old parser', () => {
    expect(() => parse('Patient..name', { mode: ParserMode.Fast }))
      .toThrow();
  });
});

// test/test-utils.ts
export function parseForTest(expression: string): ASTNode {
  // Use Standard mode for tests to get diagnostics
  const result = parse(expression, { mode: ParserMode.Standard });
  if (isStandardResult(result) && result.hasErrors) {
    throw new Error(result.diagnostics[0].message);
  }
  return result.ast;
}
```

### Step 6: Update Test Case Runner
```typescript
// tools/testcase.ts
interface TestCase {
  expression: string;
  mode?: ParserMode; // Optional mode override
  // ... other fields
}

function runTest(test: TestCase): TestResult {
  const mode = test.mode || ParserMode.Standard;
  
  try {
    const parseResult = parse(test.expression, { mode });
    
    // Handle different result types
    if (mode === ParserMode.Validate) {
      return {
        valid: parseResult.valid,
        diagnostics: parseResult.diagnostics
      };
    }
    
    // For other modes, evaluate with AST
    const ast = 'ast' in parseResult ? parseResult.ast : null;
    if (!ast) throw new Error('No AST generated');
    
    const result = evaluate(ast, test.input);
    return { result, diagnostics: parseResult.diagnostics || [] };
  } catch (error) {
    return { error: error.message };
  }
}
```

## Definition of Done

### Migration Checklist

#### Core Files
- [ ] `src/api/index.ts` - Exports only new API
- [ ] `src/api/fhirpath.ts` - Uses mode-based parser
- [ ] `src/api/errors.ts` - Compatible with diagnostics
- [ ] `src/parser/index.ts` - Clean exports

#### Runtime Files
- [ ] `src/runtime/interpreter.ts` - Uses Fast mode
- [ ] `src/runtime/compiler.ts` - Uses Fast mode
- [ ] `src/analyzer/analyzer.ts` - Uses Standard mode
- [ ] `src/analyzer/type-checker.ts` - Handles diagnostics

#### Tools (all updated)
- [ ] `tools/parser.ts`
- [ ] `tools/interpreter.ts`
- [ ] `tools/compiler.ts`
- [ ] `tools/inspect.ts`
- [ ] `tools/testcase.ts`
- [ ] `tools/registry-lookup.ts`
- [ ] `tools/spec.ts`

#### Tests (all passing)
- [ ] `test/parser.test.ts`
- [ ] `test/parser/*.test.ts`
- [ ] `test/interpreter.test.ts`
- [ ] `test/compiler.test.ts`
- [ ] `test/analyzer.test.ts`
- [ ] `test/api.test.ts`
- [ ] Test utilities updated

### Migration Tests
```typescript
describe('API Migration', () => {
  it('all tools use new parser API', () => {
    // Scan tools directory for old parse imports
    const toolFiles = glob.sync('tools/*.ts');
    toolFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain('FHIRPathParser');
      expect(content).not.toContain('../parser/parser');
    });
  });
  
  it('no direct parser class usage', () => {
    // Scan src for direct parser instantiation
    const srcFiles = glob.sync('src/**/*.ts');
    srcFiles.forEach(file => {
      if (file.includes('parser/parser.ts')) return;
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain('new FHIRPathParser');
    });
  });
});
```

### Performance Verification
- [ ] Run full benchmark suite
- [ ] Verify no performance regression
- [ ] Document performance changes

### Documentation Updates
- [ ] Update README with new API
- [ ] Create MIGRATION.md guide
- [ ] Update all code examples
- [ ] Update tool documentation

## Migration Guide

Create `MIGRATION.md`:
```markdown
# Parser API Migration Guide

## Breaking Changes

The parser API has been completely redesigned to support different modes.

### Old API
```typescript
import { parse } from './parser';
const ast = parse(expression); // Throws on error
```

### New API
```typescript
import { parse, ParserMode } from './parser';

// Choose appropriate mode
const result = parse(expression, { mode: ParserMode.Fast }); // Like old API
const result = parse(expression, { mode: ParserMode.Standard }); // With diagnostics
const result = parse(expression, { mode: ParserMode.Diagnostic }); // Full features

// Handle result based on mode
if (result.hasErrors) {
  console.error(result.diagnostics);
}
const ast = result.ast;
```

## Mode Selection Guide

- **Fast**: Production evaluation (throws on error)
- **Standard**: Development tools, CLI (basic diagnostics)
- **Diagnostic**: IDE integration (full error recovery)
- **Validate**: Syntax checking only (no AST)

## Common Migrations

### Interpreter/Compiler
```typescript
// Old
const ast = parse(expression);

// New
const ast = parseForEvaluation(expression); // Uses Fast mode
```

### Error Handling
```typescript
// Old
try {
  const ast = parse(expression);
} catch (e) {
  console.error(e.message);
}

// New
const result = parse(expression, { mode: ParserMode.Standard });
if (result.hasErrors) {
  result.diagnostics.forEach(d => console.error(d.message));
}
```
```

## Success Criteria
1. All old API removed
2. All tools use appropriate parser modes
3. All tests passing with new API
4. No performance regression
5. Clear migration documentation
6. No references to old parser classes

## Dependencies
- All previous phases completed
- Full test coverage for new API

## Estimated Effort
- Remove old API: 1 hour
- Update core API: 2 hours
- Migrate runtime: 3 hours
- Update tools: 3 hours
- Migrate tests: 4 hours
- Documentation: 2 hours
- Testing/verification: 3 hours
- **Total: ~18 hours**

## Notes
- This is a breaking change - document thoroughly
- Consider keeping a deprecated shim temporarily
- Run full regression test suite
- Benchmark before and after
- Update any external documentation