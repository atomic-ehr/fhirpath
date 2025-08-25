# Task: Fix Invalid Brace Collection Syntax

## Problem

Our parser incorrectly accepts `{1, 2, 3}` as a collection literal, when according to the FHIRPath specification, `{}` should ONLY represent an empty collection. Any content between braces should be a syntax error.

### Spec Reference
From §1.8.3-literals.md:
> **Empty** (`{ }`)|The empty collection

The spec clearly states that `{}` is only for empty collections, not for creating collections with values.

## Current Behavior

```fhirpath
{1, 2, 3}  // Currently parsed as Collection with 3 elements - WRONG!
{}         // Currently parsed as empty Collection - CORRECT
```

## Expected Behavior

```fhirpath
{1, 2, 3}  // Should throw parse error: "Unexpected token '1', expected '}'"
{}         // Should parse as empty Collection
```

## Implementation Steps

### 1. Fix Parser (src/parser.ts)

Modify the `parseCollectionElements()` method to reject any content between braces:

```typescript
// In parseCollectionElements()
if (this.peek().type === TokenType.RBRACE) {
  return elements; // Empty collection is valid
}

// Any other token should be an error
throw this.error(`Unexpected token '${this.peek().value}', expected '}'`);
```

### 2. Fix Test Cases

Search and replace all invalid `{n1, n2, ...}` syntax with proper collection syntax `(n1 | n2 | ...)`:

#### Files to fix:
- `test-cases/operations/comparison/eq.json`
  - `{1, 2, 3} = {1, 2, 3}` → `(1 | 2 | 3) = (1 | 2 | 3)`
  - `{1, 2, 3} = {1, 3, 2}` → `(1 | 2 | 3) = (1 | 3 | 2)`

- `test-cases/operations/membership/contains.json`
  - `{1, 2, 3} contains 1` → `(1 | 2 | 3) contains 1`
  - `{1, 2, 3} contains 4` → `(1 | 2 | 3) contains 4`

- `test-cases/operations/membership/in.json`
  - `1 in {1, 2, 3}` → `1 in (1 | 2 | 3)`
  - `4 in {1, 2, 3}` → `4 in (1 | 2 | 3)`
  - `{1, 2, 3} contains 1` → `(1 | 2 | 3) contains 1`
  - `{1, 2, 3} contains 4` → `(1 | 2 | 3) contains 4`

- `test-cases/operations/collection/union.json`
  - `{1, 2, 3}.union({3, 4, 5})` → `(1 | 2 | 3).union((3 | 4 | 5))`
  - `{1, 2, 3}.union({4, 5, 6})` → `(1 | 2 | 3).union((4 | 5 | 6))`

- `test-cases/operations/aggregates/aggregate.json`
  - `(1 | 2 | 3).aggregate($total | $this, { })` - Keep `{ }` as it's valid empty collection

### 3. Add Parser Tests

Add specific tests to verify the parser correctly rejects invalid syntax:

```typescript
// test/parser-errors.test.ts
describe('Parser error handling', () => {
  it('should reject non-empty brace collections', () => {
    expect(() => parse('{1}')).toThrow("Unexpected token '1', expected '}'");
    expect(() => parse('{1, 2}')).toThrow("Unexpected token '1', expected '}'");
    expect(() => parse('{1, 2, 3}')).toThrow("Unexpected token '1', expected '}'");
  });
  
  it('should accept empty brace collections', () => {
    const ast = parse('{}');
    expect(ast.type).toBe('Collection');
    expect(ast.elements).toEqual([]);
  });
});
```

### 4. Update Documentation

Add a note to CLAUDE.md about this FHIRPath compliance issue:

```markdown
## FHIRPath Syntax Notes

- Collections with values must use pipe syntax: `(1 | 2 | 3)`, not `{1, 2, 3}`
- The `{}` syntax is ONLY for empty collections per FHIRPath spec
- Any content between braces is a syntax error
```

## Testing

1. Run all tests to ensure no regressions:
   ```bash
   bun test
   ```

2. Specifically test the parser changes:
   ```bash
   bun test parser
   ```

3. Test the fixed test cases:
   ```bash
   bun tools/testcase.ts operations/comparison/eq.json
   bun tools/testcase.ts operations/membership/contains.json
   bun tools/testcase.ts operations/membership/in.json
   bun tools/testcase.ts operations/collection/union.json
   ```

## Success Criteria

- [ ] Parser throws error for `{1, 2, 3}` syntax
- [ ] Parser still accepts `{}` for empty collection
- [ ] All test cases use correct `(n | n | n)` syntax
- [ ] All tests pass with the corrected syntax
- [ ] No regression in other functionality

## Notes

This is a breaking change for any code that relies on the non-standard `{1, 2, 3}` syntax. However, this brings us into compliance with the FHIRPath specification.