# Lexer Optimization Summary

## 1. Lookup Tables for Character Classification

### What was changed:
- Created lookup tables (`IS_DIGIT`, `IS_LETTER`, `IS_LETTER_OR_DIGIT`, `IS_HEX_DIGIT`) as `Uint8Array(256)`
- Replaced all function calls like `isDigit(charCode)` with direct array lookups like `IS_DIGIT[charCode]`
- Added bounds checking where needed (`charCode >= 0 && charCode < 256`)

### Performance Impact:
- Before: ~1,477K expressions/second
- After: ~1,546K expressions/second
- Improvement: ~4.7%

### Why it works:
- Array lookups are O(1) and avoid function call overhead
- Modern JavaScript engines optimize array access very well
- Lookup tables fit in CPU cache (only 256 bytes per table)
- Eliminates branching in character classification logic

### Trade-offs:
- Slightly more memory usage (4 × 256 = 1KB for lookup tables)
- One-time initialization cost when module loads
- Need bounds checking for safety (charCode < 256)

## 2. Switch-based Keyword Lookup

### What was changed:
- Replaced object/hash map keyword lookup with nested switch statements
- First switch on keyword length (2-12 characters)
- Then switch on the actual keyword value
- Early exit for non-keyword lengths

### Performance Impact:
- Before: ~1,546K expressions/second
- After: ~2,192K expressions/second
- Improvement: ~42%

### Why it works:
- Switch statements compile to jump tables in V8
- Length check filters out most identifiers immediately
- No hash computation or object property lookup
- Better CPU branch prediction
- Compiler can optimize switch statements very aggressively

### Trade-offs:
- More verbose code (but still maintainable)
- Fixed set of keywords (can't add dynamically)
- Slightly larger code size

## 3. Character Code Switch for readWhitespace

### What was changed:
- Replaced string comparisons (`char === ' '`) with character code switch
- Single `charCodeAt()` call instead of multiple string comparisons
- Switch statement on integer values (32, 9, 13, 10)

### Performance Impact:
- Before: ~2,192K expressions/second
- After: ~2,240K expressions/second
- Improvement: ~2.2%

### Why it works:
- Integer comparison is faster than string comparison
- Switch on integers compiles to efficient jump table
- Single charCodeAt call vs multiple charAt/string comparisons
- Better branch prediction with switch statement

### Trade-offs:
- Slightly less readable (need to know ASCII codes)
- More verbose code structure

## 4. Reusable Token Attempt (Reverted)

### What was tried:
- Added a reusable token object to avoid allocations
- Created `setToken()` method to update and return the same object
- Modified `tokenize()` to clone tokens when storing in array

### Performance Impact:
- Before: ~2,240K expressions/second
- After: ~1,995K expressions/second
- **Degradation: ~11%**

### Why it failed:
- Method call overhead for `setToken()` on every token
- Still need to clone tokens in `tokenize()`, negating the benefit
- The cloning actually made it worse than direct object creation
- V8's object allocation is already highly optimized for small objects

### Lesson learned:
- Not all traditional optimizations work in modern JavaScript engines
- V8's object allocation is very fast for small, short-lived objects
- Method call overhead can outweigh allocation savings

## 5. Token Representation Benchmarks

### What was tested:
Compared different approaches for token representation:
- Plain object literals `{ type, start, end }`
- Arrays `[type, start, end]`
- Classes with constructor
- Classes with fields
- Object.create(null)
- Object.assign and spread operators

### Performance Results:

#### Token Creation (5M tokens):
- **Object literal**: 8.09ms (618M tokens/sec) ✅
- **Class with constructor**: 14.45ms (346M tokens/sec) - 78% slower
- **Arrays**: ~28ms - 244% slower in real usage
- **Object.assign**: 224.68ms - 2678% slower
- **Spread operator**: 109.61ms - 1255% slower

#### Real Lexer Usage (100K iterations):
- **Object literals**: 54.06ms (9.2M expressions/sec) ✅
- **Arrays**: 180.79ms (2.8M expressions/sec)
- **Classes**: 169.79ms (2.9M expressions/sec)

### Why Object Literals Win:
1. **V8 Hidden Classes** - Objects with consistent shape share optimized hidden classes
2. **Inline Caching** - Property access is optimized through monomorphic inline caches
3. **No Constructor Overhead** - Direct allocation without function calls
4. **JIT Optimization** - V8 heavily optimizes object literal creation
5. **Better Property Access** - Named properties are faster than array indices for this use case

### Key Insights:
- Arrays are slower despite using less memory due to worse access patterns
- Classes add constructor overhead without benefits
- V8 is extremely optimized for plain object literals with consistent shapes
- The current implementation is already optimal

### Conclusion:
The current token representation using plain object literals is the fastest approach. No change needed.

## 6. Line and Column Tracking Added Back

### What was changed:
- Added `line` and `column` fields back to Token interface
- Track line/column during advance() method
- Capture startLine and startColumn for each token
- Update line/column in readWhitespace and readSpecialIdentifier

### Performance Impact:
- Before: ~2,240K expressions/second (without line/column)
- After: ~2,147K expressions/second (with line/column)
- **Cost: ~4.2% performance decrease**

### Why it's acceptable:
- Line/column information is valuable for error reporting and debugging
- 4.2% overhead is reasonable for this functionality
- Still maintaining over 2M expressions/second
- Total performance is still 45% better than original implementation

### Implementation notes:
- Line increments on '\n', column resets to 1
- Column increments for all other characters
- Special handling in readSpecialIdentifier for multi-character advances

## 7. Numeric Enum Token Types

### What was changed:
- Converted TokenType from string enum to numeric enum
- String enum: `IDENTIFIER = 'IDENTIFIER'` → Numeric enum: `IDENTIFIER = 6`
- Added `tokenTypeToString()` helper function for debugging
- Added `debugTokens()` method for human-readable token output

### Performance Impact:
- Before: ~2,147K expressions/second (string enums)
- After: ~2,200K expressions/second (numeric enums)
- **Improvement: ~2.5%**

### Why it works:
- Numeric comparisons are faster than string comparisons
- Smaller memory footprint (4 bytes vs string length)
- Better CPU cache utilization
- Switch statements optimize better with numeric values

### Trade-offs:
- Less readable in raw debugging output (see `6` instead of `"IDENTIFIER"`)
- Need helper functions for human-readable output
- Breaking change if external code depends on string values

### Debug Support:
```typescript
// Convert numeric type to string
tokenTypeToString(TokenType.IDENTIFIER) // "IDENTIFIER"

// Debug tokens
lexer.debugTokens() // "IDENTIFIER(foo) [1:1]\nDOT(.) [1:4]..."
```

## 8. CharCode-based Dispatch in nextToken()

### What was changed:
- Replaced char-based switch (`switch (firstChar)`) with charCode-based switch (`switch (firstCharCode)`)
- Use numeric character codes instead of string literals (e.g., `case 39:` instead of `case "'"`)
- Updated all case statements to use ASCII codes with comments showing the character
- Modified error handling to convert charCode back to string when needed

### Performance Impact:
- Before: ~2,212K expressions/second (char-based dispatch)
- After: ~2,305K expressions/second (charCode-based dispatch)  
- **Improvement: ~4.2%** (93,132 more expressions/sec)

### Why it works:
- Integer comparison is faster than string comparison in switch statements
- JavaScript engines optimize numeric switches into jump tables more efficiently
- Avoids string indexing overhead when accessing characters
- Better CPU branch prediction with numeric values
- Single charCodeAt() call is more efficient than charAt() or string indexing

### Implementation Details:
```typescript
// Before
switch (firstChar) {
  case "'": return this.readString();
  case ".": return { type: TokenType.DOT, ... };
}

// After  
switch (firstCharCode) {
  case 39:  // '
    return this.readString();
  case 46:  // .
    return { type: TokenType.DOT, ... };
}
```

### Trade-offs:
- Less readable code (need ASCII code comments)
- Need to convert charCode back to string for error messages
- Slightly more complex error handling

### Isolated Test Results:
In isolated benchmarks, charCode dispatch showed 25% improvement over char dispatch. The smaller gain in the real lexer (4.2%) is due to:
- Other operations diluting the pure dispatch improvement
- Real-world expressions include various token types, not just operators
- Position tracking, token creation, and other overhead

### Current Performance Summary:
- Original: ~1,477K expressions/second
- Current: ~2,305K expressions/second
- **Total improvement: ~56%**

### Next Optimization Opportunities:
1. **Optimize readSpecialIdentifier** - Remove substring call (estimated 2-3% improvement)
2. **Optimize readDateTime/readTimeFormat** - Reduce redundant charCode lookups (estimated 1-2% improvement)
3. **Whitespace lookup table** - Use lookup table instead of switch (estimated 0.5-1% improvement)