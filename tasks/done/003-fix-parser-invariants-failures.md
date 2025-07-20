# Task 003: Fix Parser Invariants Failures

## Overview
Fix parser to handle all 52 failing FHIRPath expressions from invariants.json. Current success rate is 84.5% (283/335).

## Root Causes Analysis

### 1. Postfix Method Calls (24 failures, ~46%)
Parser cannot handle method calls directly on expression results:
- `exists().not()` fails at the dot after closing paren
- `empty().not()` 
- `hasValue().not()`
- Any pattern: `expression().methodCall()`

### 2. String Method Calls (6 failures, ~12%)
Parser doesn't support method calls on strings:
- `'string'.method()`
- `reference.startsWith('#')`
- `fullUrl.contains('/_history/')`
- `code.matches('\\{.*?\\}')`

### 3. Type Testing with is() (4 failures, ~8%)
Parser expects simple identifier after 'is', not function syntax:
- `resource.is(Composition)`
- `resource.is(MessageHeader)`
- `resolve() is Patient`

### 4. Missing XOR Operator (2 failures, ~4%)
XOR token exists but not in precedence table:
- `expr1 xor expr2`

### 5. Complex Navigation (8 failures, ~15%)
Issues with complex path expressions and method chains

### 6. Missing Functions (8 failures, ~15%)
- `defineVariable(name, value)`
- `trace(label, value)`
- `iif(condition, then, else)`
- `memberOf(valueSet)`
- `lowBoundary()`, `highBoundary()`
- `comparable()`

## Implementation Steps

### 1. Fix Postfix Method Calls
- [x] Update parser to handle method calls after any primary expression
- [x] Modify `expression()` to continue parsing after function calls
- [x] Allow dot operator after closing parenthesis
- [x] Test pattern: `expr().method()`, `expr().method().method2()`

### 2. Add String Methods Support
- [x] Add string method recognition in parser
- [x] Support methods: `startsWith()`, `contains()`, `endsWith()`, `matches()`, `substring()`, `toString()`
- [x] Allow method calls on string literals and string-returning expressions

### 3. Fix Type Testing
- [x] Update 'is' operator handling to support both:
  - Simple form: `expr is TypeName`
  - Function form: `expr.is(TypeName)`
- [x] Handle `resolve() is TypeName` pattern

### 4. Add XOR Operator
- [x] Add XOR to precedence table (level 11, same as OR)
- [x] Ensure proper parsing of `expr xor expr`

### 5. Add Missing Functions
- [ ] Add to parser as built-in functions:
  - `defineVariable(name, value)` - defines variable in scope
  - `trace(label, value)` - debugging function
  - `iif(condition, then, else)` - immediate if
  - `memberOf(valueSet)` - membership test
  - `lowBoundary()`, `highBoundary()` - range boundaries
  - `comparable()` - comparability test
  - `resolve()` - reference resolution

### 6. Fix Complex Navigation
- [ ] Ensure proper handling of array indices in paths: `element[0]`
- [ ] Support complex where clauses with nested expressions

## Test Cases

### Postfix Method Tests
```typescript
// Should all parse successfully
parse("exists().not()");
parse("empty().not()");
parse("hasValue().not()");
parse("answer.exists() and item.exists()).not()");
parse("path.contains('.').not()");
```

### String Method Tests
```typescript
// Should all parse successfully
parse("reference.startsWith('#')");
parse("fullUrl.contains('/_history/')");
parse("code.matches('\\{.*?\\}')");
parse("value.toString().contains('.')");
```

### Type Testing Tests
```typescript
// Should all parse successfully
parse("resource.is(Composition)");
parse("resolve() is Patient");
parse("entry.first().resource.is(MessageHeader)");
```

### XOR Tests
```typescript
// Should parse successfully
parse("a xor b");
parse("exists() xor empty()");
parse("contains.version.exists() xor parameter.where(name = 'system-version').exists()");
```

## Success Metrics
- All 335 expressions in invariants.json parse successfully
- No regression in existing tests
- Performance remains under 0.1ms average per expression

## Failing Expressions Reference
Full list of 52 failing expressions with error locations:

1. `$this.where(element[0].mustSupport='true').exists().not()` - Error at 57
2. `%context.repeat(action).relatedAction.where((targetId in %context.repeat(action).id).not()).exists().not()` - Error at 90
3. `%context.repeat(action).where((goalId in %context.goal.id).not()).exists().not()` - Error at 64
4. `($this is Range) implies ((low.empty() or ((low.code.exists() or low.value.empty()) and (low.system.empty() or low.system = %ucum) and (low.code.empty() or low.code = '1') and (low.value.empty() or low.value.hasValue().not() or low.value.toString().contains('.').not()) and (low.value.empty() or low.value.hasValue().not() or low.value >= 0))) and (high.empty() or ((high.code.exists() or high.value.empty()) and (high.system.empty() or high.system = %ucum) and (high.code.empty() or high.code = '1') and (high.value.empty() or high.value.hasValue().not() or high.value.toString().contains('.').not()) and (high.value.empty() or high.value.hasValue().not() or high.value >= 0))))` - Error at 224
5. `(answer.exists() and item.exists()).not()` - Error at 41
[... continue with all 52 expressions ...]

## Notes
- Priority should be postfix method calls as they account for ~46% of failures
- XOR is easiest fix (just add to precedence table)
- Some functions like `defineVariable` and `trace` may need special handling for side effects
- String methods might require adding a StringNode type or handling in Binary operator

## Completion Summary (2025-07-20)

Successfully improved parser from 84.5% to 99.4% success rate (333/335 expressions parsing correctly).

### What Was Fixed

1. **Postfix Method Calls (Fixed ~46% of failures)**
   - Added support for method calls after any expression: `exists().not()`, `(expr).method()`
   - Modified functionCall() to check for dots after function completion
   - Modified parenthesized expression handling to check for dots after closing paren
   - Added keyword-as-identifier handling after dots (keywords like 'not', 'empty', 'contains' can be method names)

2. **Type Testing with is() (Fixed ~8% of failures)**
   - Added support for both `expr is Type` and `expr.is(Type)` syntax
   - Modified type operator handling to accept optional parentheses

3. **XOR Operator (Fixed ~4% of failures)**
   - XOR was already in the precedence table at level 12 (same as OR)

4. **String Methods (Fixed ~12% of failures)**
   - Keywords after dots are now treated as identifiers, enabling methods like:
     - `reference.startsWith('#')`
     - `fullUrl.contains('/_history/')`
     - `code.matches(pattern)`

### Key Implementation Changes

1. **Keyword-as-Identifier Logic**: When a DOT is followed by a keyword token (NOT, EMPTY, EXISTS, etc.), the parser now treats it as an identifier for method calls.

2. **Postfix Continuations**: After parsing functions and parenthesized expressions, the parser now checks for following dots to enable method chaining.

3. **Duplicate Code**: The keyword-as-identifier logic was added in three places:
   - parseBinary() for dot operator
   - functionCall() for method calls after functions
   - primary() for parenthesized expressions

### Remaining Issues (2 expressions, 0.6%)

1. **Expression 136**: `reference | as(uri)` - The `as` operator in a union context with function-like syntax
2. **Expression 137**: `contains` at start of expression is lexed as CONTAINS keyword instead of identifier

These edge cases would require more complex lexer/parser changes:
- Context-sensitive lexing for keywords
- Special handling of `as` as both operator and function-like construct

### Performance
- Average parse time: 0.025ms per expression
- No performance regression
- All existing tests still pass