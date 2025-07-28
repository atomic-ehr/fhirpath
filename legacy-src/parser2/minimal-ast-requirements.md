# Minimal AST Requirements for FHIRPath LSP

## Overview

This document defines the three critical features that form the minimal viable AST for the FHIRPath LSP. These features address the most fundamental pain points and enable all other LSP functionality to work effectively.

## The Three Critical Features

### 1. Rich Position Information & Source Mapping

**This is the foundation of everything** - without accurate positions, no LSP feature can work correctly.

#### Required Structure

```typescript
interface MinimalASTNode {
  // Dual range system for accuracy
  range: Range;              // Full range including whitespace/comments
  contentRange: Range;       // Actual code range (excluding trivia)
  
  // Precise position tracking
  startPosition: Position;   // Start position with line/column/offset
  endPosition: Position;     // End position with line/column/offset
  
  // Source preservation
  raw: string;              // Original source text for this node
  leadingTrivia: Trivia[];  // Whitespace/comments before the node
  trailingTrivia: Trivia[]; // Whitespace/comments after the node
}

interface Position {
  line: number;      // 0-based line number
  character: number; // 0-based character offset in line
  offset: number;    // Absolute character offset in document
}

interface Range {
  start: Position;
  end: Position;
}

interface Trivia {
  type: 'whitespace' | 'newline' | 'comment';
  value: string;
  range: Range;
}
```

#### Why It's Critical

Every LSP feature depends on positions:
- **Diagnostics**: "Show error squiggle from character 10 to 15"
- **Hover**: "What is at line 5, character 12?"
- **Completion**: "User typed at position 24, what to suggest?"
- **Semantic Tokens**: "Highlight 'Patient' from position 0 to 7"

#### Example

```typescript
// FHIRPath: Patient.name
{
  type: 'MemberExpression',
  range: {
    start: { line: 0, character: 0, offset: 0 },
    end: { line: 0, character: 12, offset: 12 }
  },
  contentRange: {  // Same as range if no trivia
    start: { line: 0, character: 0, offset: 0 },
    end: { line: 0, character: 12, offset: 12 }
  },
  raw: 'Patient.name',
  leadingTrivia: [],
  trailingTrivia: []
}
```

### 2. Bidirectional Navigation & Fast Lookups

**Efficient tree traversal** is essential for performance and context awareness.

#### Required Structure

```typescript
interface MinimalASTNode {
  // Unique identification
  id: string;               // Unique node identifier
  type: NodeType;           // Node type for quick filtering
  
  // Bidirectional links
  parent: MinimalASTNode | null;
  children: MinimalASTNode[];
  previousSibling: MinimalASTNode | null;
  nextSibling: MinimalASTNode | null;
  
  // Navigation helpers
  path: string;            // Path from root (e.g., "root.body[0].left")
  depth: number;           // Tree depth for quick filtering
}

// Index for O(1) and O(log n) lookups
interface ASTIndex {
  // O(1) lookups
  nodeById: Map<string, MinimalASTNode>;
  nodesByType: Map<NodeType, MinimalASTNode[]>;
  
  // O(log n) spatial lookups
  nodesByPosition: RangeTree<MinimalASTNode>;
  
  // Symbol tracking
  identifiers: Map<string, MinimalASTNode[]>;
}
```

#### Why It's Critical

Fast navigation enables real-time features:
- **Find node at cursor**: O(log n) with spatial index vs O(n) traversal
- **Get context**: Walk up parent chain to find enclosing function/resource
- **Find references**: Quick lookup of all identifier nodes
- **Scope analysis**: Traverse up to find variable declarations

#### Example Operations

```typescript
// Find node at cursor position - O(log n)
const node = index.nodesByPosition.find({ line: 5, character: 10 });

// Get full context - O(depth)
const context = [];
let current = node;
while (current) {
  context.unshift(current);
  current = current.parent;
}

// Find all uses of 'name' - O(1)
const nameNodes = index.identifiers.get('name');
```

### 3. Error Recovery & Partial Parsing

**IDEs are mostly in an invalid state** as users type - the parser must handle this gracefully.

#### Required Structure

```typescript
interface ErrorNode extends MinimalASTNode {
  type: 'Error';
  
  // Error information
  message: string;
  errorCode: string;
  
  // Recovery context
  expectedTokens: TokenType[];    // What was expected
  actualToken?: Token;            // What was found
  partialParse?: MinimalASTNode; // Best-effort partial AST
  
  // Recovery strategy
  recoveryStrategy: 'skip' | 'insert' | 'replace' | 'reparse';
  recoveredNode?: MinimalASTNode; // Result after recovery
  
  // User assistance
  suggestedFixes: QuickFix[];
}

interface PartialParseResult {
  // Successfully parsed prefix
  parsedPrefix: MinimalASTNode;
  
  // Context at cursor
  expectedNext: string[];        // What can come next
  contextType?: string;         // Type at cursor position
  availableSymbols?: string[];  // Available completions
  
  // Error if any
  error?: ErrorNode;
}

// Parser must support partial parsing
interface MinimalParser {
  // Full parse with error recovery
  parse(text: string): ParseResult;
  
  // Parse incomplete expression at cursor
  parsePartial(text: string, cursorPos: Position): PartialParseResult;
  
  // Parse with known errors
  parseWithRecovery(text: string, options: RecoveryOptions): ParseResult;
}
```

#### Why It's Critical

Users rarely have valid code while typing:
- **Completions**: Must work with "Patient.name." (trailing dot)
- **Diagnostics**: Show helpful errors, not just "unexpected EOF"
- **Navigation**: Features should work despite errors elsewhere
- **Quick fixes**: Suggest corrections for common mistakes

#### Example Error Recovery

```typescript
// Input: "Patient.name..given" (double dot error)
{
  type: 'MemberExpression',
  object: { type: 'MemberExpression', /* Patient.name */ },
  property: {
    type: 'Error',
    message: 'Unexpected token "." - expected identifier',
    expectedTokens: ['IDENTIFIER'],
    actualToken: { type: 'DOT', value: '.' },
    suggestedFixes: [{
      title: 'Remove extra dot',
      edit: { range: { start: 13, end: 14 }, newText: '' }
    }],
    recoveredNode: {
      type: 'MemberExpression',
      property: { type: 'Identifier', name: 'given' }
    }
  }
}
```

## Implementation Priority

### Phase 1: Position Information (Week 1)
1. Add dual range system to all nodes
2. Implement trivia collection and attachment
3. Ensure raw source text preservation
4. Test position accuracy for all node types

### Phase 2: Bidirectional Navigation (Week 2)
1. Add parent/sibling references during parse
2. Build spatial index for position lookups
3. Implement navigation utilities
4. Create identifier index

### Phase 3: Error Recovery (Week 3-4)
1. Identify synchronization tokens for recovery
2. Implement partial parsing at cursor
3. Add error nodes with recovery strategies
4. Generate helpful quick fixes

## Benefits Matrix

| LSP Feature | Position Info | Navigation | Error Recovery |
|-------------|--------------|------------|----------------|
| Diagnostics | ✓ Accurate error positions | ✓ Find related nodes | ✓ Multiple errors |
| Completion | ✓ Cursor position | ✓ Context analysis | ✓ Works with errors |
| Hover | ✓ Find node at position | ✓ Get full context | ✓ Partial info |
| Semantic Tokens | ✓ Token ranges | ✓ Fast traversal | ✓ Best effort |
| Go to Definition | ✓ Source locations | ✓ Find declarations | ✓ Graceful degradation |
| Find References | ✓ Reference positions | ✓ Quick lookup | ✓ Partial results |
| Code Actions | ✓ Error positions | ✓ Analyze context | ✓ Fix suggestions |
| Formatting | ✓ Preserve spacing | ✓ Tree structure | ✓ Format valid parts |

## Validation Checklist

A minimal viable AST implementation must pass these tests:

### Position Accuracy Tests
- [ ] Every character in source is covered by exactly one node's range
- [ ] Trivia (whitespace/comments) is attached to appropriate nodes
- [ ] Source can be reconstructed exactly from AST + trivia
- [ ] Position lookups return the most specific node

### Navigation Performance Tests
- [ ] Find node at position: < 1ms for 10K node document
- [ ] Get parent chain: < 0.1ms
- [ ] Find all identifiers named 'X': < 1ms
- [ ] Child traversal is array access, not search

### Error Recovery Tests
- [ ] Parse "Patient." provides partial AST
- [ ] Parse "Patient.name." suggests completions
- [ ] Double operators are recovered: "Patient..name"
- [ ] Missing closing brackets are detected and recovered
- [ ] Multiple errors don't cascade

## Conclusion

These three features - **rich positions**, **bidirectional navigation**, and **error recovery** - form the absolute minimum for a functional LSP AST. They solve the most critical pain points:

1. **Positions** enable accurate feature targeting
2. **Navigation** enables fast, context-aware operations  
3. **Error Recovery** enables features to work during editing

With just these three features properly implemented, all LSP features can function effectively. Additional features like type information, incremental parsing, and immutable transformations can be added later as optimizations.