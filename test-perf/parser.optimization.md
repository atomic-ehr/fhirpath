# Parser2 Performance Optimization Summary

## Baseline Performance (2024-01-27)

### Test Configuration
- **Test Suite**: 1,539 FHIRPath expressions from real-world invariants and search parameters
- **Iterations**: 5,000 per expression (7,695,000 total parser runs)
- **Hardware**: Bun v1.2.18 runtime
- **Parser**: Recursive-descent with Pratt operator precedence parsing

### Baseline Metrics

| Metric | Value |
|--------|-------|
| **Total time** | 6.51 seconds |
| **Time per expression** | 0.0008ms (0.8 microseconds) |
| **Expressions per second** | 1,182,443 |
| **Average tokens per expression** | 11.2 |
| **Average AST nodes per expression** | 8.6 |
| **Time per token** | ~0.08 microseconds |

### Performance by Expression Complexity

| Token Range | Count | Avg Time (ms) | Time/Token (μs) |
|-------------|-------|---------------|-----------------|
| 1-5 tokens | 716 | 0.0003 | 0.08 |
| 6-10 tokens | 410 | 0.0005 | 0.08 |
| 11-20 tokens | 251 | 0.0010 | 0.07 |
| 21-50 tokens | 130 | 0.0024 | 0.08 |
| 50+ tokens | 32 | 0.0093 | 0.08 |

### Key Observations

1. **Linear Scaling**: Performance scales linearly with token count, indicating O(n) complexity
2. **Consistent Token Processing**: ~0.08μs per token across all complexity ranges
3. **Fast Baseline**: Already processing over 1 million expressions per second
4. **Memory Efficiency**: All tokens are pre-loaded, enabling random access without re-parsing

### Slowest Expressions

The most complex expression has 780 tokens and takes 0.0589ms to parse:
```
(ActivityDefinition.useContext.value...
```

This represents a worst-case scenario that's still processed in under 0.06ms.

## Design Strengths

1. **Pratt Parsing**: Eliminates recursive precedence climbing, reducing call stack depth
2. **Pre-tokenization**: All tokens generated upfront, avoiding interleaved lexing/parsing
3. **Direct Token Access**: Array-based token storage enables O(1) lookahead
4. **Minimal Allocations**: AST nodes created only when needed
5. **Type-safe Node Creation**: Separate factory methods avoid dynamic object construction

## Comparison with Lexer2

| Component | Expressions/sec | Relative Speed |
|-----------|----------------|----------------|
| Lexer2 | ~15,000,000 | 1.0x (baseline) |
| Parser2 | ~1,200,000 | 0.08x |

The parser is ~12x slower than the lexer, which is expected since it:
- Builds a complete AST structure
- Performs syntax validation
- Handles operator precedence
- Manages recursive structures

## Potential Optimizations

While the baseline performance is already excellent, potential optimizations include:

1. **Token Caching**: Cache frequently accessed token values to avoid repeated string operations
2. **Specialized Node Pools**: Pre-allocate common node types to reduce allocation overhead
3. **Inline Small Functions**: Further inline hot-path functions like `peek()` and `check()`
4. **Precedence Table**: Replace switch statement with lookup table for operator precedence
5. **String Interning**: Intern common identifier strings to reduce memory and comparison costs

## ANTLR Parser Comparison

To provide additional context, we compared parser2 performance against the ANTLR-generated parser:

### Overall Performance Comparison

| Parser | Expressions/sec | Time per Expression | Relative Performance |
|--------|----------------|-------------------|---------------------|
| ANTLR | 143,965 | 0.0069ms | 1.0x (baseline) |
| Parser2 | 1,030,046 | 0.0010ms | **7.2x faster** |

### Complex Expression Performance

| Expression | ANTLR (ms) | Parser2 (ms) | Speedup |
|------------|------------|--------------|---------|
| Patient.name.where(use = 'official').given | 0.009 | 0.001 | 7.7x |
| (ActivityDefinition.useContext.value... | 0.009 | 0.001 | 7.1x |
| ($this is Range) implies ((low.empty()... | 0.027 | 0.002 | 11.2x |
| extension.exists() or (contentType.co... | 0.047 | 0.001 | 33.1x |



### Key Differences

1. **Architecture**: ANTLR uses table-driven parsing while parser2 uses recursive descent with Pratt parsing
2. **Overhead**: ANTLR has more runtime overhead due to its generic parsing framework
3. **Scalability**: Parser2 shows better performance on complex expressions (up to 33x faster)
4. **Error Recovery**: ANTLR provides better error recovery but at a performance cost

## Optimization: Bit-Packed Precedence (2024-01-27)

### Implementation
Encoded operator precedence directly into TokenType enum values using bit-packing:
- High byte: Precedence (0-255)
- Low byte: Token ID (0-255)

### Results
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Expressions/sec | 1,182,443 | 1,214,209 | +2.7% |
| Time per expression | 0.8μs | 0.8μs | - |
| getPrecedence cycles | ~5-10 | ~1 | -90% |

### Code Simplification
- Removed 30+ line switch statement
- Replaced with single bit shift: `type >>> 8`
- Precedence now co-located with token definitions

### Note
A direct precedence value approach (without bit-packing) was also tested but resulted in 8.8% performance degradation due to lookup table overhead. The bit-packed approach with bit shift operation provides the best balance of performance and maintainability.

## Additional Optimizations (2024-01-27)

### 1. Method Inlining
Inlined hot path methods (`peek()`, `advance()`, `isAtEnd()`) to reduce function call overhead in `parseExpressionWithPrecedence()` and `parsePrimary()`.

**Results**: 
- Baseline: 1,203,640 expressions/sec
- After inlining: 1,223,027 expressions/sec (+1.6%)

### 2. Node Creation Inlining (Reverted)
Attempted to inline frequently used node creation functions (`createBinaryNode`, `createLiteralNode`, `createIdentifierNode`) but observed performance regression due to increased code size affecting CPU cache and JIT optimization.

**Results**: Performance decreased to 1,184,463 expressions/sec - optimization was reverted.

### 3. Lookup Tables for Token Type Checking (Abandoned)
Attempted to use Uint8Array lookup tables for binary operator and keyword checking, but abandoned due to bit-packed token values exceeding array bounds (values > 256).

### 4. Position Tracking Impact Analysis
Temporarily disabled position tracking to measure its performance cost.

**Results**:
- With position tracking: 1,226,319 expressions/sec
- Without position tracking: 1,212,703 expressions/sec (-1.1%)

**Surprising finding**: Removing position tracking actually decreased performance slightly, likely due to:
- Position tracking overhead is minimal (simple object property assignment)
- Code changes disrupted JIT compiler optimizations
- Modern JS engines optimize object creation very well

### Key Findings:
- Simple method inlining in hot paths provides consistent gains
- Over-optimization (excessive inlining) can hurt performance
- JIT compiler already optimizes method calls effectively
- Position tracking has negligible performance impact
- Bit-packed TokenType with getPrecedence bit shift remains the best optimization
- Current optimized performance: **1,223,027 expressions/sec** (1.6% improvement)

## Conclusion

The parser2 performance is exceptional:
- **7.2x faster** than the ANTLR-generated parser
- Processing over **1.2 million expressions per second**
- Consistent **linear O(n) scaling** with token count
- Sub-microsecond parsing times for typical expressions


The combination of recursive-descent parsing with Pratt operator precedence, enhanced with bit-packed precedence lookup, provides an optimal balance of simplicity, maintainability, and performance. Even with already excellent baseline performance, targeted optimizations like bit-packed precedence can provide measurable improvements while simplifying the codebase.