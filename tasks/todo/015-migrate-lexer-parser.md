# Task 002: Migrate Lexer and Parser to Use Registry

## Objective
Update lexer and parser to use the unified registry for keywords, literals, and operator precedence.

## Requirements

### Lexer Migration

1. **Remove hardcoded keywords**:
   - Replace hardcoded keyword list with `Registry.isKeyword()`
   - Use `Registry.get()` to retrieve operator tokens

2. **Integrate literal parsing**:
   - Replace literal regex patterns with `Registry.matchLiteral()`
   - Use registry's `parse()` method for literal values
   - Store operation reference in tokens

3. **Update token structure**:
   - Add `operation?: Operation` field to Token type
   - Include parsed literal values in tokens

### Parser Migration

1. **Use registry for precedence**:
   - Replace `PRECEDENCE` table with `Registry.getPrecedence()`
   - Remove hardcoded precedence values

2. **Handle special forms**:
   - Check `operation.syntax.special` for special parsing rules
   - Use `operation.syntax.endToken` for bracketed forms

3. **Validate operations**:
   - Ensure operators exist in registry
   - Pass operation reference through AST nodes

## Files to Update

- `/src/lexer/lexer.ts` - Main lexer implementation
- `/src/lexer/token.ts` - Token type definition
- `/src/parser/parser.ts` - Parser implementation
- `/src/parser/ast.ts` - AST node types (add operation references)

## Tests to Update

- Lexer tests for keyword detection
- Lexer tests for literal parsing
- Parser precedence tests
- Parser operator validation tests

## Dependencies

- Task 001 must be completed first