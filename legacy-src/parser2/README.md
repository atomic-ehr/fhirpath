# Parser2 - High-Performance FHIRPath Parser

This directory contains two FHIRPath parser implementations sharing a common base:

## Production Parser (`prod.ts`)
- **Purpose**: High-performance parsing for production use
- **Performance**: 1.25M+ expressions/second
- **Features**:
  - Minimal memory footprint
  - Basic offset tracking for error reporting
  - No position tracking overhead
  - Optimized for runtime evaluation

```typescript
import { parse } from './parser2/prod';
// or
import { parse } from './parser2'; // default export

const ast = parse('Patient.name.given');
// ast.offset provides basic position info
```

## LSP Parser (`lsp.ts`)
- **Purpose**: Rich AST for Language Server Protocol and IDE features
- **Performance**: 75K+ expressions/second
- **Features**:
  - Full position tracking (line, column, offset)
  - Bidirectional navigation (parent/child/sibling)
  - Error recovery and partial parsing
  - Fast node lookups via indexes
  - Source text preservation
  - Trivia support (whitespace/comments)

```typescript
import { parseLSP } from './parser2/lsp';

const result = parseLSP('Patient.name.given');
// result.ast has rich position info and navigation
// result.indexes provides O(1) lookups
// result.errors contains parse errors
```

## Base Parser (`base.ts`)
- Shared parsing logic (70-80% code reuse)
- Abstract methods for node creation
- Pratt parsing with bit-packed precedence
- Hot path optimizations

## Performance Comparison

| Parser | Expressions/sec | Use Case |
|--------|----------------|----------|
| Production | 1,250,000+ | Runtime evaluation |
| LSP | 75,000+ | IDE features |
| ANTLR (reference) | 170,000 | General purpose |

The production parser is 7.3x faster than ANTLR while the LSP parser provides rich features at acceptable IDE performance.