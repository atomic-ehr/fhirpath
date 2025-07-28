# ADR 008: Simplified Lexer Architecture

## Status
Accepted

## Date
2024-12-28

## Context
The original lexer distinguished between keyword operators (like `and`, `or`, `contains`) and regular identifiers at the tokenization stage. This approach:
- Made the lexer complex (400+ lines)
- Made it difficult to add custom operators
- Prevented contextual use of keywords
- Coupled lexical analysis with semantic meaning

## Decision
We have simplified the lexer to:
1. Only recognize symbol operators (`+`, `-`, `*`, `/`, etc.) at the lexical level
2. Return all alphabetic sequences as IDENTIFIER tokens
3. Let the parser determine which identifiers are operators based on context

## Consequences

### Positive
- **Simpler lexer**: ~60% less code, easier to maintain
- **More flexible**: Easy to add custom operators without modifying lexer
- **Contextual keywords**: Allows `Patient.where(where = 'home')`
- **Better separation**: Lexer handles syntax, parser handles semantics
- **Performance**: Simpler lexer is actually faster overall

### Negative
- Parser becomes slightly more complex (needs operator lookup)
- Breaking change from previous architecture
- Need to update all parser code to handle keyword operators

### Neutral
- Follows industry standard (SQL, modern JavaScript parsers)
- Token stream is more uniform (fewer token types)

## Implementation
```typescript
// Before: Lexer knows about operators
case 'and':
  return { type: TokenType.AND_OPERATOR, precedence: 20 };

// After: Lexer just returns identifier
case 'and':
  return { type: TokenType.IDENTIFIER, value: 'and' };

// Parser determines if it's an operator
const KEYWORD_OPERATORS = new Map([
  ['and', 20],
  ['or', 25],
  // etc.
]);
```

## Migration Notes
- Old lexer tests are preserved in `test/lexer.old-test.ts.disabled`
- Parser needs to be updated to recognize keyword operators
- TokenType enum significantly simplified