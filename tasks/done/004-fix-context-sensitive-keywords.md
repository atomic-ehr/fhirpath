# Task 004: Fix Context-Sensitive Keywords (Operator Keywords as Identifiers/Functions) ✓

## Overview
Fix the last 2 failing FHIRPath expressions (0.6%) where operator keywords need to be treated as identifiers or functions based on context. Currently at 99.4% success rate (333/335).

## Problem Description

### Core Issue: Operator Keywords Have Multiple Roles
Any operator keyword in FHIRPath can potentially serve as:
1. **Identifier** when at expression start or after dot: `contains.version`, `div.property`
2. **Function** when followed by parentheses: `as(uri)`, `mod(5)`
3. **Operator** in normal binary/unary context: `'hello' contains 'ell'`, `value as Patient`

### Failing Expressions

#### 1. Expression 137: `contains` at start of expression
```
contains.version.exists() xor parameter.where(name = 'system-version').exists()
```
**Error**: Expected expression at line 1, column 1
**Issue**: `contains` is lexed as CONTAINS operator token, not available as identifier at expression start

#### 2. Expression 136: `as` in function-like syntax within select
```
select(reference | as(uri))
```
**Error**: Expected expression at line 1, column 20 (after the pipe)
**Issue**: `as` is parsed as type cast operator, not as function call

## Root Cause Analysis

The current implementation:
- **Lexer**: Always tokenizes keywords as operator tokens (CONTAINS, AS, DIV, MOD, IN, etc.)
- **Parser**: Already handles keywords as identifiers after dots (lines 432-444 in parser.ts)
- **Missing**: 
  - Keywords as identifiers at expression start
  - Keywords as function calls (operator + LPAREN)

All operator keywords potentially affected:
- `div`, `mod` - arithmetic operators
- `contains`, `in` - membership operators  
- `and`, `or`, `xor`, `implies` - logical operators
- `is`, `as` - type operators
- `not` - unary operator

## Proposed Solution: Parser-Level Context Resolution

Keep lexer simple (always return keyword tokens) and handle all context sensitivity in the parser. This approach:
- Maintains clean separation between lexer and parser
- Extends existing keyword-as-identifier pattern
- Allows any operator keyword to serve multiple roles based on context

## Implementation Steps

### 1. Create Helper for Operator Keywords
- [ ] Create `isOperatorKeyword(token)` method that returns true for all operator tokens
- [ ] This consolidates the list currently duplicated in parser

### 2. Handle Operator Keywords at Expression Start
- [ ] In `primary()`, check if current token is an operator keyword
- [ ] If followed by DOT or LPAREN, treat as identifier
- [ ] Examples: `contains.version`, `div.property`, `mod(5)`

### 3. Handle Operator Keywords as Functions
- [ ] When operator keyword is followed by LPAREN, parse as function call
- [ ] Support both standalone (`as(uri)`) and after expressions (`value.as(uri)`)

### 4. Consolidate Existing Keyword-as-Identifier Logic
- [ ] Extract duplicate logic from multiple places in parser
- [ ] Use single `isOperatorKeyword()` check

## Implementation Details

### Helper Method for Operator Keywords
```typescript
private isOperatorKeyword(type: TokenType): boolean {
  return type === TokenType.DIV || 
         type === TokenType.MOD ||
         type === TokenType.CONTAINS ||
         type === TokenType.IN ||
         type === TokenType.AND ||
         type === TokenType.OR ||
         type === TokenType.XOR ||
         type === TokenType.IMPLIES ||
         type === TokenType.IS ||
         type === TokenType.AS ||
         type === TokenType.NOT ||
         type === TokenType.TRUE ||     // Already in existing logic
         type === TokenType.FALSE;      // Already in existing logic
}
```

### Handle Operator Keywords in primary()
```typescript
// In primary(), before throwing "Expected expression"
if (this.isOperatorKeyword(this.peek().type)) {
  const token = this.advance();
  const identifier: IdentifierNode = {
    type: NodeType.Identifier,
    name: token.value,
    position: token.position
  };
  
  // Check for function call
  if (this.check(TokenType.LPAREN)) {
    return this.functionCall(identifier);
  }
  
  return identifier;
}
```

### Refactor Existing Keyword-as-Identifier Logic
```typescript
// Replace multiple if checks with:
if (this.isOperatorKeyword(next.type)) {
  // Treat keyword as identifier
  this.advance();
  right = {
    type: NodeType.Identifier,
    name: next.value,
    position: next.position
  } as IdentifierNode;
} else {
  right = this.primary();
}
```

## Test Cases

```typescript
// Operator keywords as identifiers at start
parse("contains.version.exists()");
parse("div.property");
parse("mod.value");
parse("as.type");
parse("in.scope");

// Operator keywords as functions
parse("as(uri)");
parse("mod(5)");
parse("div(10)");
parse("select(reference | as(uri))");

// Mixed usage
parse("contains.version.exists() xor parameter.where(name = 'system-version').exists()");
parse("descendants().select(reference | as(uri))");

// Should still work as operators
parse("'hello' contains 'ell'");
parse("value as Patient");
parse("10 div 3");
parse("17 mod 5");
parse("item in collection");
parse("true and false");

// Complex expressions
parse("defineVariable('x', div(10)).mod(3)");
parse("Patient.where(name contains 'john' and id.exists())");
```

## Success Criteria
- All 335 expressions in invariants.json parse successfully (100%)
- No regression in existing tests
- Performance remains under 0.1ms average

## Considerations

1. **Breaking Changes**: Ensure existing operator usage still works
2. **Precedence**: Maintain correct precedence when keywords act as identifiers
3. **Error Messages**: Provide clear errors when ambiguous usage occurs
4. **Future Keywords**: Design solution to easily handle new dual-purpose keywords

## Alternative Approaches

### Lexer Modes
- Implement lexer modes/states for different contexts
- More complex but cleaner separation of concerns

### Two-Phase Parsing
- First pass: identify context
- Second pass: parse with context information

### Grammar Redesign
- Modify grammar to avoid ambiguity
- May not be possible while maintaining FHIRPath compatibility

## Notes
- These edge cases represent real-world FHIRPath usage in FHIR specifications
- Solution should be maintainable and extensible
- Consider documenting the keyword duality in parser documentation

## Completion Summary

**Status**: ✅ Completed

### What Was Done

1. **Created `isOperatorKeyword()` helper method** that checks if a token type is an operator keyword that can also serve as an identifier or function.

2. **Updated `primary()` method** to handle operator keywords at expression start:
   - Check if current token is an operator keyword
   - If followed by LPAREN, parse as function call
   - Otherwise, treat as identifier

3. **Refactored existing logic** in 3 places where keyword-as-identifier checks were duplicated, replacing them with calls to the new helper method.

4. **Added comprehensive tests** for context-sensitive keywords to ensure:
   - `contains` works at expression start
   - `as(uri)` works as function syntax
   - All operator keywords can be properties
   - Normal operator usage still works

### Results

- **Parser success rate**: Improved from 99.4% (333/335) to 100% (335/335)
- **Performance**: Maintained excellent performance (<0.1ms average)
- **No regressions**: All existing tests continue to pass
- **Search params**: Still 100% success rate on 1204 expressions

### Key Implementation Details

The solution maintains clean separation between lexer and parser by:
- Keeping the lexer unchanged (keywords always tokenized as operators)
- Handling all context sensitivity in the parser
- Using a consistent pattern for operator keyword handling

This approach is extensible - any new operator keywords will automatically work as identifiers/functions by adding them to the `isOperatorKeyword()` method.