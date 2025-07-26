# ADR-013: Parser Mode Refactoring with Composition

## Status

Implemented (Simplified approach)

## Context

The current FHIRPath parser implementation uses a single class with mode-based behavior controlled by conditionals throughout the code. This approach has led to several issues:

1. **Code Duplication**: ~375 lines of duplicated code across different parser modes, including:
   - Lexer error handling duplicated 3 times (~90 lines each)
   - Validate mode completely reimplements parsing logic (~195 lines)
   - Similar error handling patterns repeated with slight variations

2. **Scattered Conditionals**: Mode-specific behavior is scattered throughout the codebase with ~15 if/switch statements checking the parser mode, making the code hard to follow and maintain.

3. **Testing Complexity**: Testing individual modes requires instantiating the entire parser, making it difficult to test mode-specific behavior in isolation.

4. **Performance Issues**: Validate mode, which should be faster by skipping AST construction, still performs unnecessary object allocations due to shared code paths.

5. **Extensibility Concerns**: Adding new modes or modifying mode-specific behavior requires changes throughout the parser class, violating the Open/Closed Principle.

## Decision

Refactor the parser to use composition with the Strategy pattern, separating concerns into focused, pluggable components:

### Core Architecture

```typescript
class FHIRPathParser {
  constructor(
    private tokenizer: ITokenizer,
    private errorStrategy: IErrorStrategy,
    private astStrategy: IASTStrategy,
    private validator?: ISyntaxValidator
  ) {}
  
  parse(): ParseResult {
    const tokens = this.tokenizer.tokenize(this.input);
    return this.parseExpression(tokens);
  }
}
```

### Component Interfaces

1. **IErrorStrategy** - Handles errors according to mode requirements
   - `FastErrorStrategy`: Throws on first error
   - `StandardErrorStrategy`: Collects errors without recovery
   - `DiagnosticErrorStrategy`: Collects errors with recovery
   - `ValidateErrorStrategy`: Collects errors for validation only

2. **IASTStrategy** - Controls AST node creation
   - `StandardASTStrategy`: Creates normal AST nodes
   - `DiagnosticASTStrategy`: Creates AST with error/incomplete nodes
   - `NullASTStrategy`: No-op implementation for validate mode

3. **ITokenizer** - Abstraction over lexing
   - Allows for future optimizations or alternative lexer implementations

4. **ISyntaxValidator** - Optional validation-specific logic
   - Used only in validate mode for optimized syntax checking

### Factory Pattern

```typescript
class ParserFactory {
  static create(input: string, options: ParserOptions): Parser {
    const strategies = this.getStrategiesForMode(options.mode);
    return new FHIRPathParser(input, ...strategies);
  }
  
  private static getStrategiesForMode(mode: ParserMode) {
    switch (mode) {
      case ParserMode.Fast:
        return {
          errorStrategy: new FastErrorStrategy(),
          astStrategy: new StandardASTStrategy()
        };
      // ... other modes
    }
  }
}
```

## Consequences

### Positive

1. **Eliminates Code Duplication**: ~375 lines of duplicated code removed by extracting common patterns into strategies.

2. **Single Responsibility**: Each strategy has one clear responsibility, making the code easier to understand and maintain.

3. **Improved Testability**: Strategies can be tested in isolation with mock dependencies.

4. **Better Performance**: Mode-specific optimizations are easier to implement (e.g., NullASTStrategy avoids all object allocations).

5. **Extensibility**: New modes can be added by creating new strategy combinations without modifying existing code.

6. **Type Safety**: Each strategy can have specific return types, improving compile-time safety.

7. **Flexible Combinations**: Strategies can be mixed and matched for hybrid modes if needed.

### Negative

1. **More Files**: The solution requires creating ~8-10 new files for the various strategies and interfaces.

2. **Indirection**: The strategy pattern adds a layer of indirection that might make the code flow less obvious to newcomers.

3. **Initial Complexity**: The setup is more complex than a single class, requiring understanding of the strategy pattern.

4. **Memory Overhead**: Each parser instance now holds references to multiple strategy objects (minimal impact).

## Alternatives Considered

### 1. Inheritance-Based Approach

Create a base parser class with mode-specific subclasses:

```typescript
abstract class BaseParser { ... }
class FastParser extends BaseParser { ... }
class StandardParser extends BaseParser { ... }
```

**Why Not Chosen**: 
- The different modes aren't truly different types of parsers (no IS-A relationship)
- Would lead to protected method coupling and fragile base class issues
- Less flexible for mixing behaviors
- Harder to test individual aspects

### 2. Keep Current Approach with Cleanup

Refactor the existing code to reduce duplication while keeping the mode-based conditionals.

**Why Not Chosen**:
- Doesn't address the fundamental issue of tangled responsibilities
- Still difficult to test modes in isolation
- Adding new modes would still require changes throughout the class

### 3. Functional Approach with Higher-Order Functions

Use functions and closures instead of classes for strategies.

**Why Not Chosen**:
- TypeScript's class-based approach provides better type safety
- Less familiar pattern for most developers
- Harder to maintain state within strategies if needed

## Implementation Plan

1. Create strategy interfaces
2. Implement error strategies
3. Implement AST strategies  
4. Refactor parser to use strategies
5. Create factory
6. Update tests
7. Deprecate old API (maintain backward compatibility)

## Update: Actual Implementation (2025-07-26)

Instead of the full Strategy pattern approach, we implemented a simpler solution that achieved the same goals:

### What Was Done

1. **Removed ParserMode enum entirely** - Eliminated the mode-based conditionals
2. **Replaced modes with feature flags**:
   ```typescript
   interface ParserOptions {
     throwOnError?: boolean;    // Replaces Fast mode
     trackRanges?: boolean;     // Opt-in range tracking
     errorRecovery?: boolean;   // Opt-in error recovery (replaces Diagnostic mode)
     maxErrors?: number;
   }
   ```
3. **Removed Validate mode** - Eliminated ~195 lines of duplicate code
4. **Unified ParseResult type** - Single result type with optional properties
5. **Lazy initialization** - Infrastructure only created when features are enabled

### Benefits Achieved

- **Eliminated code duplication**: Removed ~650 lines of code
- **Zero performance overhead**: Features have no cost when disabled
- **Simpler API**: Boolean flags instead of mode enum
- **More flexible**: Can mix and match features as needed
- **Backward compatible**: Old parse function still works

### Performance Impact

- When all features disabled: Same performance as old Fast mode
- When features enabled: Same performance as corresponding old modes
- No runtime overhead from unused features

This simplified approach achieved all the original goals without the complexity of a full Strategy pattern implementation.