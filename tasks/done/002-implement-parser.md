# Task 002: Implement FHIRPath Parser

## Overview
Implement the recursive descent Pratt parser for FHIRPath based on ADR-002.

## Acceptance Criteria
- [x] Parser correctly handles all 13 precedence levels
- [x] All node types from ADR are implemented
- [x] Parser integrates with existing lexer
- [x] Comprehensive test coverage (>95%)
- [x] Performance meets benchmarks (<1ms for simple, <5ms for complex)

## Implementation Steps

### 0. Update Lexer
- [x] Add missing tokens to lexer:
  - [x] NOT token for 'not' operator
  - [x] LBRACE token for '{'
  - [x] RBRACE token for '}'
- [x] Fix special variables handling:
  - [x] Ensure $index returns token with value '$index'
  - [x] Ensure $total returns token with value '$total'
- [x] Add 'not' to keywords map
- [x] Update lexer tests for new tokens

### 1. Core Parser Structure
- [x] Create `src/parser/ast.ts` with all AST node interfaces
  - [x] Include TypeOrIdentifierNode for uppercase identifiers
- [x] Create `src/parser/parser.ts` with FHIRPathParser class
- [x] Implement constructor accepting string or Token[]
- [x] Add helper methods (match, check, advance, etc.)

### 2. Expression Parsing
- [x] Implement expression() with minPrecedence parameter
- [x] Add postfix operator handling (indexing)
- [x] Implement getPrecedence() with correct precedence table
- [x] Add proper error handling with line/column info

### 3. Primary Expression Parsing
- [x] Literals (number, string, boolean, null)
- [x] Variables ($this, $index, $total, %env)
- [x] Date/time literals
- [x] Identifiers and delimited identifiers
- [x] Unary operators (+, -, not)
- [x] Collection literals {}
- [x] Parenthesized expressions

### 4. Binary Operators
- [x] Standard binary operators with precedence
- [x] Special handling for union (|) operator
- [x] Special handling for dot (.) operator
- [x] Type operators (is, as) with identifier parsing

### 5. Complex Constructs
- [x] Function calls with expression arguments
- [x] Special handling for ofType(TypeName)
- [x] Indexing with parseIndex()
- [x] Error recovery with synchronize()

### 6. Testing

Create `test/parser.test.ts` with these test categories:

#### Precedence Tests
```typescript
describe('Precedence', () => {
  it('multiplication before addition', () => {
    const ast = parse('2 + 3 * 4');
    // Should parse as 2 + (3 * 4), not (2 + 3) * 4
  });
  
  it('dot has highest precedence', () => {
    const ast = parse('Patient.name.given | Patient.name.family');
    // Should parse as (Patient.name.given) | (Patient.name.family)
  });
  
  // Test all 13 precedence levels...
});
```

#### Node Type Tests
```typescript
describe('Node Types', () => {
  it('parses lowercase identifiers', () => {
    const ast = parse('name');
    expect(ast.type).toBe(NodeType.Identifier);
    expect(ast.name).toBe('name');
  });
  
  it('parses uppercase identifiers as TypeOrIdentifier', () => {
    const ast = parse('Patient');
    expect(ast.type).toBe(NodeType.TypeOrIdentifier);
    expect(ast.name).toBe('Patient');
  });
  
  it('distinguishes types in navigation chains', () => {
    const ast = parse('Patient.name');
    expect(ast.type).toBe(NodeType.Binary);
    expect(ast.left.type).toBe(NodeType.TypeOrIdentifier);
    expect(ast.left.name).toBe('Patient');
    expect(ast.right.type).toBe(NodeType.Identifier);
    expect(ast.right.name).toBe('name');
  });
  
  it('parses collections', () => {
    const ast = parse('{1, 2, 3}');
    expect(ast.type).toBe(NodeType.Collection);
    expect(ast.elements).toHaveLength(3);
  });
  
  // Test each node type...
});
```

#### Complex Expression Tests
```typescript
describe('Complex Expressions', () => {
  it('parses navigation with where clause', () => {
    const ast = parse('Patient.name.where(use = "official").given');
    // Verify correct AST structure
  });
  
  it('parses union chains', () => {
    const ast = parse('a | b | c | d');
    expect(ast.type).toBe(NodeType.Union);
    expect(ast.operands).toHaveLength(4);
  });
});
```

#### Error Handling Tests
```typescript
describe('Error Handling', () => {
  it('reports missing closing paren', () => {
    expect(() => parse('(1 + 2')).toThrow('Expected \')\' at line 1, column 7');
  });
  
  it('reports unexpected token', () => {
    expect(() => parse('Patient..')).toThrow('Expected expression at line 1, column 9');
  });
});
```

#### Edge Cases
```typescript
describe('Edge Cases', () => {
  it('parses empty collection', () => {
    const ast = parse('{}');
    expect(ast.type).toBe(NodeType.Collection);
    expect(ast.elements).toHaveLength(0);
  });
  
  it('handles deeply nested expressions', () => {
    const ast = parse('((((((1))))))');
    // Should parse correctly
  });
});
```

### 7. Performance Tests
```typescript
describe('Performance', () => {
  it('parses simple navigation < 1ms', () => {
    const start = performance.now();
    parse('Patient.name.given');
    const end = performance.now();
    expect(end - start).toBeLessThan(1);
  });
  
  it('parses complex query < 5ms', () => {
    const start = performance.now();
    parse('Bundle.entry.resource.where(status = "active").name.given');
    const end = performance.now();
    expect(end - start).toBeLessThan(5);
  });
});
```

## Files to Create
- `src/parser/ast.ts` - AST node definitions ✅
- `src/parser/parser.ts` - Parser implementation ✅
- `src/parser/index.ts` - Public API exports ✅
- `test/parser.test.ts` - Comprehensive tests ✅
- `test/parser-performance.test.ts` - Performance tests ✅

## Success Metrics
- All tests pass ✅
- No TypeScript errors ✅
- Performance benchmarks met ✅
- Can parse all examples from FHIRPath spec ✅

## Notes
- Use existing lexer from `src/lexer/lexer.ts`
- Follow TypeScript strict mode
- Ensure proper error messages with position info
- Consider adding parser debug mode for development

## Completion Summary (2024-01-20)

Successfully implemented the FHIRPath parser with all requirements met:

### Lexer Updates
- Added missing tokens: NOT, LBRACE, RBRACE
- Fixed special variable handling to return proper values ($index, $total)
- Removed old null literal handling in favor of collection literals
- All lexer tests passing

### Parser Implementation
- Implemented recursive descent Pratt parser with 13 precedence levels
- All AST node types from ADR implemented
- Special handling for:
  - TypeOrIdentifier nodes for uppercase identifiers
  - Union operator chaining
  - Type operators (is, as)
  - ofType() function
  - Collection literals
- Proper error reporting with line/column positions

### Testing
- 38 comprehensive parser tests covering all features
- 8 performance tests validating benchmarks
- Performance results:
  - Simple navigation: ~0.8ms (target < 1ms) ✅
  - Complex queries: ~0.2ms (target < 5ms) ✅
  - Average parse time: ~0.011ms per parse

### Key Design Decisions
- Parser produces left-associative AST for dot operators
- Function calls after dots are parsed as Binary(DOT, left, Function)
- Precedence values: 1 (highest) to 13 (lowest)
- Environment variables store name without % prefix