# Dynamic FHIRPath System

This document describes the dynamic lexer, parser, and registry system that allows for extensible FHIRPath implementations.

## Overview

The dynamic system consists of three main components that work together:

1. **Dynamic Registry** - Central source of truth for operators and functions
2. **Dynamic Lexer** - Uses registry to tokenize input
3. **Dynamic Parser** - Uses registry for precedence and parsing rules

## Architecture

```
┌─────────────────┐
│  Configuration  │
│   (operators)   │
└────────┬────────┘
         │
         v
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Dynamic Registry│────>│  Dynamic Lexer  │────>│ Dynamic Parser  │
│                 │     │                 │     │                 │
│ - Token Types   │     │ - Uses Registry │     │ - Uses Registry │
│ - Precedence    │     │ - Creates Tokens│     │ - Builds AST    │
│ - Associativity │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Features

### 1. Dynamic Token Allocation

Instead of a fixed enum, token types are allocated dynamically:

```typescript
const registry = new DynamicRegistry();

// Register an operator - get a unique token type
const plusToken = registry.registerOperator({
  symbol: '+',
  name: 'plus',
  precedence: 70,
  associativity: 'left',
  // ...
});
```

### 2. Registry-Driven Lexing

The lexer queries the registry to map symbols to tokens:

```typescript
const lexer = new DynamicLexer('2 + 3', registry);
const tokens = lexer.tokenize();
// Tokens use the dynamically allocated types from registry
```

### 3. Registry-Driven Parsing

The parser uses registry for precedence and associativity:

```typescript
const parser = new DynamicParser('2 + 3 * 4', registry);
const ast = parser.parse();
// Respects precedence: 2 + (3 * 4)
```

## Benefits

1. **Extensibility** - Add new operators without modifying core code
2. **Configuration** - Load operators from external sources
3. **Consistency** - Single source of truth for operator behavior
4. **Type Safety** - TypeScript still provides type checking
5. **Performance** - Token lookups are cached for efficiency

## Usage Example

```typescript
// Create registry and add operators
const registry = new DynamicRegistry();

// Standard operators
registry.registerOperator({
  symbol: '+',
  name: 'plus',
  category: ['arithmetic'],
  precedence: 70,
  associativity: 'left',
  description: 'Addition operator',
  examples: ['2 + 3'],
  signatures: [/* type signatures */]
});

// Custom operators
registry.registerOperator({
  symbol: '**',
  name: 'power',
  category: ['arithmetic'],
  precedence: 90,
  associativity: 'right',
  description: 'Exponentiation',
  examples: ['2 ** 3'],
  signatures: [/* type signatures */]
});

// Parse expressions
const parser = new DynamicParser('2 ** 3 ** 2', registry);
const ast = parser.parse();
// Correctly parses as 2 ** (3 ** 2) due to right associativity
```

## Files

- `src/dynamic-registry.ts` - Registry implementation
- `src/dynamic-lexer.ts` - Registry-based lexer
- `src/dynamic-parser.ts` - Registry-based parser
- `src/registry-tokens.ts` - Base token definitions

## Tests

Run tests with:

```bash
bun test test/dynamic-parser-simple.test.ts
bun test test/dynamic-registry.test.ts
bun test test/registry-based-lexer.test.ts
```

## Future Enhancements

1. **Type Checking** - Use registry signatures for semantic analysis
2. **Error Recovery** - Better error messages using operator metadata
3. **Plugin System** - Load operators from npm packages
4. **Code Generation** - Generate optimized code based on operators
5. **Language Server** - Provide autocomplete for registered operators