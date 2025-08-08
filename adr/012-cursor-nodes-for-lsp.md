# ADR-012: Cursor Nodes for LSP Integration

## Status
Proposed

## Context
To support Language Server Protocol (LSP) features like auto-completion, hover information, and signature help, we need to parse FHIRPath expressions that contain a cursor position. The parser needs to understand incomplete expressions and provide context about what's valid at the cursor location.

## Decision
Introduce special cursor node types in the AST to represent cursor positions within FHIRPath expressions, using a virtual token approach.

### Cursor Node Types

1. **CursorOperatorNode** - When cursor is where an operator would go:
   - `Patient.name <CURSOR>` - expecting binary/postfix operator
   - `5 <CURSOR> 3` - expecting binary operator
   - `not <CURSOR>` - after prefix operator

2. **CursorIdentifierNode** - When cursor is in/after an identifier position:
   - `Patient.<CURSOR>` - after dot, expecting property/method
   - `Patient.na<CURSOR>` - partial identifier for completion
   - `<CURSOR>` - at expression start

3. **CursorArgumentNode** - When cursor is within function arguments:
   - `where(<CURSOR>)` - expecting first argument
   - `where(use = 'official', <CURSOR>)` - expecting next argument
   - `substring(0, <CURSOR>)` - expecting specific argument position

4. **CursorIndexNode** - When cursor is in indexer:
   - `Patient[<CURSOR>]` - expecting index expression
   - `name[0<CURSOR>]` - partial index

5. **CursorTypeNode** - When cursor is after type operators:
   - `Patient.name is <CURSOR>` - expecting FHIRPath type
   - `value as <CURSOR>` - expecting type for casting
   - `collection.ofType(<CURSOR>)` - expecting type parameter
   - `is Str<CURSOR>` - partial type name

### Implementation: Virtual Token Approach

**Cursor Position Handling:**
- Cursor positions are only meaningful at token boundaries
- Mid-token cursors (e.g., `Patient.na|me`) are ignored
- Valid cursor positions: after operators, between tokens, in function arguments

**API Design:**
```typescript
function parse(
  expression: string, 
  options?: { 
    cursorPosition?: number,
    // other existing options...
  }
): ASTNode
```

**Implementation Flow:**
1. **Lexing Phase:**
   - Lex the expression normally to get tokens with position information
   - No changes to lexer required

2. **Token Injection:**
   - If `cursorPosition` is provided, map it to nearest token boundary
   - Insert a special `CURSOR` token at that position in token stream
   - Ignore cursor if it's mid-token (not at boundary)

3. **Parsing Phase:**
   - Parser recognizes CURSOR token during parsing
   - Determines context based on parser state:
     - After dot operator → CursorIdentifierNode
     - After 'is'/'as' keyword → CursorTypeNode
     - In function arguments → CursorArgumentNode
     - In indexer brackets → CursorIndexNode
     - Between expressions → CursorOperatorNode
   - Creates appropriate cursor node
   - Continues parsing to maintain full expression structure

### Valid Cursor Positions
```
Patient.<cursor>         → expecting property/method
1 <cursor>               → expecting operator
Patient.where(<cursor>)  → expecting argument
value is <cursor>        → expecting type
Patient[<cursor>]        → expecting index expression
```

### Example Flow
```
Input: "Patient. |name" (| represents cursor at position 9)
Tokens: [IDENTIFIER(Patient), DOT, IDENTIFIER(name)]
With cursor: [IDENTIFIER(Patient), DOT, CURSOR, IDENTIFIER(name)]
Parser output: AST with CursorIdentifierNode after Patient.
```

## Consequences

### Positive
- Lexer remains simple and unchanged
- Parser has full context to determine cursor node type
- Easy to test (inject cursor token in test strings)
- Leverages existing parser error recovery
- No position tracking complexity in lexer
- Clean separation of concerns

### Negative
- Requires pre-processing step
- Parser complexity increases to handle cursor token
- Need to handle edge cases where cursor marker splits tokens

### Implementation Notes
- Cursor marker should be a string that cannot appear in valid FHIRPath
- Parser should strip cursor marker from actual values when creating nodes
- Cursor nodes should include both partial content and expected completions context

## References
- Language Server Protocol specification
- FHIRPath grammar specification