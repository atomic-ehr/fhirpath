# Task 004: Merge LSP Parser into Main Parser

## Status: DONE

## Completion Date: 2025-07-30

## What Was Done

Successfully merged LSPParser functionality into the main Parser class with a mode option. The parser now supports both simple (default) and LSP modes through configuration.

### Implemented Features:
- ParserOptions interface with mode selection
- Conditional LSP features based on mode
- Error collection and recovery in LSP mode
- Node IDs and comprehensive indexing
- Parent/child relationships
- Raw source text preservation
- Partial parsing with cursor context
- Maintained backward compatibility

### Code Changes:
- Updated Parser class to support both modes
- Added enrichNodeForLSP method for conditional features
- Updated all node creation methods
- Removed LSPParser and related files (~900 lines)
- Updated imports in index.ts and tools
- Added comprehensive tests for both modes

### Not Completed:
- Documentation updates (README, API docs)
- Performance benchmarking/optimization

## Status: TODO

## Problem Statement

We currently have two parser implementations:
1. `Parser` - Simple parser that returns basic AST nodes
2. `LSPParser` - Advanced parser with LSP features, error recovery, and rich AST

This duplication leads to:
- Maintenance overhead
- Code duplication
- Confusion about which parser to use
- Difficulty keeping features in sync

**Note**: LSPParser is not currently used anywhere in the codebase, so we can safely remove it after merging its features into Parser.

## Goal

Merge LSPParser functionality into the main Parser class with an option to produce advanced AST. This will provide a single, unified parser with optional LSP features.

## Requirements

1. **Backward Compatibility**: Existing Parser API must work unchanged
2. **Performance**: Simple mode should have minimal overhead
3. **Type Safety**: Different modes should have proper TypeScript types
4. **Feature Parity**: All LSPParser features must be available
5. **Clean API**: Clear and intuitive options for users

## Design

### Parser Options

```typescript
export interface ParserOptions {
  mode?: 'simple' | 'lsp';     // Default: 'simple'
  preserveTrivia?: boolean;     // Auto-enabled in LSP mode
  buildIndexes?: boolean;       // Auto-enabled in LSP mode
  errorRecovery?: boolean;      // Auto-enabled in LSP mode
  partialParse?: {              // For partial parsing
    cursorPosition: number;
  };
}
```

### Return Types

```typescript
// Simple mode
parser.parse(): ASTNode;

// LSP mode
parser.parse(): ParseResult;

interface ParseResult {
  ast: ASTNode;
  errors: ParseError[];
  indexes?: {
    nodeById: Map<string, ASTNode>;
    nodesByType: Map<NodeType | 'Error', ASTNode[]>;
    identifiers: Map<string, ASTNode[]>;
  };
  cursorContext?: {
    node: ASTNode | null;
    expectedTokens: TokenType[];
    availableCompletions: string[];
  };
}
```

### Implementation Strategy

1. **Conditional Properties**: Add LSP-specific properties only when needed
2. **Mode-Based Logic**: Use mode checks for LSP-specific behavior
3. **Lazy Initialization**: Initialize indexes and navigation only in LSP mode
4. **Error Handling**: Collect errors in LSP mode, throw in simple mode

## Implementation Steps

### Phase 1: Prepare Parser Class
- [x] Add ParserOptions interface
- [x] Update Parser constructor to accept options
- [x] Add mode property and conditional initialization
- [x] Create ParseResult interface

### Phase 2: Merge Core Features
- [x] Move error collection from LSPParser
- [x] Add node ID generation (LSP mode only)
- [x] Implement trivia handling based on mode
- [x] Add raw source preservation (LSP mode only)

### Phase 3: Advanced Features
- [x] Implement error recovery and synchronization
- [x] Add node indexing (by ID, type, identifier)
- [x] Build parent/child/sibling navigation
- [x] Add partial parsing support

### Phase 4: API Design
- [x] Design overloaded parse() method signatures
- [x] Add parsePartial() method
- [x] Ensure type safety for different modes
- [x] Add helper methods for LSP features

### Phase 5: Migration
- [x] Update existing Parser usage
- [x] Update tests for both modes
- [ ] Update documentation

### Phase 6: Cleanup
- [x] Delete LSPParser and parser-lsp.ts file
- [x] Remove LSPParser imports from index.ts
- [x] Remove parser-lsp.test.ts or convert useful tests
- [ ] Optimize performance
- [x] Final testing

## Code Structure

```typescript
export class Parser extends BaseParser<ASTNode> {
  private mode: 'simple' | 'lsp';
  private errors?: ParseError[];
  private nodeIdCounter?: number;
  private nodeIndex?: Map<string, ASTNode>;
  private nodesByType?: Map<NodeType | 'Error', ASTNode[]>;
  private identifierIndex?: Map<string, ASTNode[]>;
  
  constructor(input: string, options: ParserOptions = {}) {
    this.mode = options.mode || 'simple';
    
    // Initialize LSP features only if needed
    if (this.mode === 'lsp') {
      this.errors = [];
      this.nodeIdCounter = 0;
      this.nodeIndex = new Map();
      this.nodesByType = new Map();
      this.identifierIndex = new Map();
      options.preserveTrivia = true;
      options.errorRecovery = true;
    }
    
    super(input, {
      trackPosition: true,
      preserveTrivia: options.preserveTrivia
    });
  }
  
  parse(): ASTNode | ParseResult {
    if (this.mode === 'simple') {
      return this.parseSimple();
    } else {
      return this.parseLSP();
    }
  }
}
```

## Testing Strategy

1. **Mode Testing**: Test both simple and LSP modes
2. **Performance Tests**: Ensure simple mode has no overhead
3. **Feature Tests**: Verify all LSP features work
4. **Type Tests**: Verify TypeScript types work correctly
5. **Integration Tests**: Test with analyzer and other tools

## Migration Plan

Since LSPParser is not currently used in the codebase:

1. **Phase 1**: Add LSP mode to Parser
2. **Phase 2**: Test all LSP features work correctly
3. **Phase 3**: Remove LSPParser completely
4. **Phase 4**: Update documentation

## Success Criteria

- [ ] Single parser implementation
- [ ] No performance regression in simple mode
- [ ] All LSP features available
- [ ] Clean, intuitive API
- [ ] Smooth migration path
- [ ] Comprehensive tests
- [ ] Updated documentation

## Dependencies

- Task 003: Unified AST structure (completed)

## Estimated Effort

- Design and planning: 1-2 hours
- Implementation: 4-6 hours
- Testing: 2-3 hours
- Documentation: 1 hour
- Total: ~10 hours

## Notes

- Consider using a builder pattern for complex parser configurations
- May want to extract LSP features into a separate class for composition
- Could add more modes in future (e.g., 'streaming' for large files)
- Performance benchmarks should guide optimization decisions