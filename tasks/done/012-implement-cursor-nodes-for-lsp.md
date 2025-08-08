# Task 012: Implement Cursor Nodes for LSP Support

## Status: COMPLETED

## What Was Done

Successfully implemented cursor node support for LSP integration:

1. **Defined Cursor Node Types** (`src/cursor-nodes.ts`):
   - Created 5 cursor node types: CursorOperatorNode, CursorIdentifierNode, CursorArgumentNode, CursorIndexNode, CursorTypeNode
   - Each node includes position and context information

2. **Added CURSOR Token Type** to lexer (`src/lexer.ts`)

3. **Extended Parse Function** (`src/parser.ts`):
   - Added `cursorPosition` option to ParserOptions
   - Parser remains backward compatible

4. **Implemented Token Injection** (`src/parser.ts`):
   - `injectCursorToken` method inserts CURSOR token at token boundaries
   - Ignores mid-token cursor positions as designed

5. **Updated Parser Logic** to handle CURSOR tokens:
   - After dot operator → CursorIdentifierNode
   - After is/as keywords → CursorTypeNode
   - In function arguments → CursorArgumentNode
   - In indexer brackets → CursorIndexNode
   - Between expressions → CursorOperatorNode
   - Made parser lenient at EOF when cursor is present

6. **Created Comprehensive Tests** (`test/cursor-nodes.test.ts`):
   - 15 test cases covering all cursor contexts
   - Tests for mid-token cursor handling (ignored as expected)
   - All tests passing

7. **Added Helper Methods** (`src/lsp-helpers.ts`):
   - `getCursorNode()` - finds cursor node in AST
   - `getCursorContext()` - extracts completion context
   - `getCompletions()` - provides context-aware completion suggestions
   - Includes tests (`test/lsp-helpers.test.ts`) - 15 test cases, all passing

## Summary

The implementation successfully enables LSP support by allowing the parser to handle incomplete expressions with cursor positions. The parser creates special cursor nodes that indicate what type of completion is expected at that position, making it easy for an LSP server to provide intelligent auto-completion, hover information, and signature help.

## Objective
Implement cursor node types in the parser to support LSP features like auto-completion, hover information, and signature help.

## Background
Based on ADR-012, we need to add cursor handling to the parser using a virtual token approach. Cursor positions are only handled at token boundaries, not within tokens.

## Implementation Steps

### 1. Define Cursor Node Types
Create new AST node types:
- `CursorOperatorNode` - for operator positions
- `CursorIdentifierNode` - for identifier/property positions  
- `CursorArgumentNode` - for function argument positions
- `CursorIndexNode` - for indexer positions
- `CursorTypeNode` - for type positions (after is/as/ofType)

Each node should include:
- Context about what's expected at this position
- Parser state information

### 2. Add CURSOR Token Type
- Add `CURSOR` to the token type enum
- This token will be injected into the token stream

### 3. Extend Parse Function
Modify the `parse` function signature:
```typescript
function parse(
  expression: string, 
  options?: { 
    cursorPosition?: number,
    // existing options...
  }
): ASTNode
```

### 4. Implement Token Injection
Create `injectCursorToken` helper:
- Takes tokens array, expression string, and cursor position
- Maps cursor position to token boundaries
- Inserts CURSOR token at appropriate position
- Returns modified token stream
- Ignores mid-token positions

### 5. Update Parser Logic
Modify parser to handle CURSOR token:
- Check for CURSOR token at key parsing points:
  - After dot operators
  - After type operators (is/as)
  - In function argument lists
  - In indexer brackets
  - Between expressions (for operators)
- Create appropriate cursor node based on context
- Continue parsing after cursor

### 6. Testing
Create tests for:
- Cursor after dot: `Patient.<cursor>`
- Cursor after literal: `5 <cursor>`
- Cursor in function: `where(<cursor>)`
- Cursor after type operator: `value is <cursor>`
- Cursor in indexer: `Patient[<cursor>]`
- Mid-token cursor ignored: `Patient.na|me` → no cursor node
- Edge cases: start/end of expression

### 7. Add Helper Methods
Create utility methods for LSP:
- `getCursorNode(ast: ASTNode): CursorNode | null` - find cursor node in AST
- `getCursorContext(cursorNode: CursorNode): CompletionContext` - get completion info

## Implementation Order
1. Add CURSOR token type
2. Create cursor node types
3. Implement token injection
4. Extend parse function
5. Update parser to handle CURSOR token
6. Write tests
7. Add helper methods

## Acceptance Criteria
- [ ] Parse function accepts optional cursor position
- [ ] CURSOR token correctly injected at token boundaries
- [ ] Mid-token cursors are ignored
- [ ] Parser creates appropriate cursor nodes
- [ ] Parser continues after cursor position
- [ ] All test cases pass
- [ ] Helper methods for LSP usage

## Notes
- No changes to lexer required
- Regular parsing (without cursor) should have zero overhead
- Cursor token should never appear in normal AST (only in cursor nodes)
- Focus on token boundaries only - ignore mid-token positions