# Lexer2 Overview

## Introduction

Lexer2 is a high-performance manual lexer for the FHIRPath expression language, designed as a drop-in replacement for the ANTLR-based lexer. It achieves ~2.2M expressions/second, representing a 49% improvement over the initial implementation through systematic optimizations.

## Algorithm Overview

The lexer uses a single-pass, character-by-character scanning approach with the following key components:

### 1. Character Classification via Lookup Tables

Instead of function calls for character classification, we use pre-computed lookup tables:

```typescript
// src/lexer2/index.ts:184-203
const IS_DIGIT = new Uint8Array(256);
const IS_LETTER = new Uint8Array(256);
const IS_LETTER_OR_DIGIT = new Uint8Array(256);
const IS_HEX_DIGIT = new Uint8Array(256);
```

These 256-byte arrays provide O(1) character classification with excellent cache locality.

### 2. Switch-Based Token Dispatch

The main tokenization logic uses a switch statement on the first character for efficient dispatch:

```typescript
// src/lexer2/index.ts:786-906
switch (firstChar) {
  case "'": return this.readString();
  case '`': return this.readDelimitedIdentifier();
  case '@': return this.readDateTime();
  case '$': return this.readSpecialIdentifier();
  // ... single-character operators
  default:
    if (IS_DIGIT[firstCharCode]) return this.readNumber();
    if (IS_LETTER[firstCharCode]) return this.readIdentifierOrKeyword();
}
```

### 3. Optimized Keyword Recognition

Keywords are recognized using nested switches on string length first, then value:

```typescript
// src/lexer2/index.ts:662-721
switch (length) {
  case 2:
    switch (value) {
      case 'as': type = TokenType.AS; break;
      case 'in': type = TokenType.IN; break;
      // ...
    }
    break;
  case 3:
    switch (value) {
      case 'div': type = TokenType.DIV; break;
      case 'mod': type = TokenType.MOD; break;
      // ...
    }
    break;
  // ...
}
```

This approach filters out most identifiers immediately and compiles to efficient jump tables.

## Design Decisions

### 1. Token Representation

After extensive benchmarking (see [optimization-summary.md](./optimization-summary.md#token-representation-benchmarks)), we use plain object literals:

```typescript
// src/lexer2/index.ts:159-165
export interface Token {
  type: TokenType;  // numeric enum
  start: number;    // position in input string
  end: number;      // end position
  line: number;     // line number for error reporting
  column: number;   // column number for error reporting
}
```

Key findings:
- Object literals are 78% faster than classes
- Arrays are 244% slower despite lower memory usage
- V8 optimizes object literals with consistent shapes via hidden classes

### 2. Numeric Enums for Token Types

Token types use numeric enums for better performance:

```typescript
// src/lexer2/index.ts:1-82
export enum TokenType {
  NULL,      // 0
  BOOLEAN,   // 1
  STRING,    // 2
  NUMBER,    // 3
  // ...
}
```

Benefits:
- 2.5% performance improvement over string enums
- Smaller memory footprint (4 bytes vs string length)
- Better switch statement optimization

Debug support is maintained via helper functions:
- `tokenTypeToString()` - converts numeric type to string
- `debugTokens()` - human-readable token output

### 3. Position Tracking Strategy

The lexer tracks both:
- **Character positions** (`start`, `end`) - for substring extraction
- **Line/column information** - for error reporting

```typescript
// src/lexer2/index.ts:241-257
private advance(): string {
  const char = this.input[this.position] || '';
  this.position++;
  
  if (char === '\n') {
    this.line++;
    this.column = 1;
  } else {
    this.column++;
  }
  
  return char;
}
```

This dual tracking adds ~4.2% overhead but provides essential debugging information.

### 4. Whitespace Handling Optimization

Whitespace recognition uses a character code switch for efficiency:

```typescript
// src/lexer2/index.ts:268-283
switch (charCode) {
  case 32:  // ' ' (space)
  case 9:   // '\t' (tab)
    this.position++;
    this.column++;
    break;
  case 13:  // '\r' (carriage return)
    this.position++;
    break;
  case 10:  // '\n' (line feed)
    this.position++;
    this.line++;
    this.column = 1;
    break;
  default:
    // Not whitespace
}
```

### 5. Inline Hot Functions

Critical path functions are inlined to reduce call overhead:
- Character classification uses lookup tables directly
- Digit reading loops are fully inlined
- No separate utility functions in hot paths

## Performance Characteristics

Current performance: **~2,200K expressions/second**

### Optimization Timeline:
1. Initial implementation: ~1,477K expr/sec
2. Lookup tables: ~1,546K expr/sec (+4.7%)
3. Switch-based keywords: ~2,192K expr/sec (+42%)
4. Character code switches: ~2,240K expr/sec (+2.2%)
5. Numeric enums: ~2,200K expr/sec (+2.5%, with position tracking)

### Failed Optimizations:
- **Reusable tokens**: 11% performance degradation due to method call overhead
- **Character arrays**: Slower than string indexing in modern V8
- **Object pooling**: V8's allocation is already highly optimized

## Future Optimization Opportunities

Based on profiling, remaining optimization opportunities include:

1. **Optimize readSpecialIdentifier** (est. 2-3% improvement)
   - Remove substring call at line 734
   - Use direct character comparison

2. **Optimize readDateTime/readTimeFormat** (est. 1-2% improvement)
   - Reduce redundant charCode lookups
   - Cache frequently accessed positions

3. **Whitespace lookup table** (est. 0.5-1% improvement)
   - Replace switch with lookup table
   - May improve branch prediction

## Usage Example

```typescript
import { Lexer, TokenType, tokenTypeToString } from './index';

const lexer = new Lexer("Patient.name.where(use = 'official')");
const tokens = lexer.tokenize();

// Process tokens
for (const token of tokens) {
  const value = lexer.getTokenValue(token);
  const type = tokenTypeToString(token.type);
  console.log(`${type}(${value}) at ${token.line}:${token.column}`);
}

// Debug output
console.log(lexer.debugTokens());
```

## Architecture Integration

The lexer integrates with the FHIRPath parser by:
1. Providing a token stream via `tokenize()`
2. Supporting position information for error reporting
3. Maintaining compatibility with the existing Token interface
4. Offering configurable whitespace/comment handling

See [parser integration](../parser/parser.ts) for usage in the parsing pipeline.