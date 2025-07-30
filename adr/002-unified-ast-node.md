# ADR-002: Unified AST Node Structure

## Status

Proposed

## Context

Currently, we have two separate AST node structures in the codebase:

1. **ASTNode** - A minimal structure used by the standard Parser with basic type and position information
2. **LSPASTNode** - A rich structure used by LSPParser with extensive metadata for Language Server Protocol features

This dual structure creates several problems:

- **Type incompatibility**: The analyzer expects `ASTNode` but LSPParser returns `LSPASTNode`, requiring type assertions and special handling
- **Code duplication**: Similar node types are defined twice with different base interfaces
- **Maintenance burden**: Changes need to be made in two places
- **Confusion**: Developers must understand which structure to use when
- **Integration complexity**: Components that should work with both parsers need complex type handling

The key difference is that LSPASTNode can have `type: 'Error'` for parse errors and includes rich metadata (ranges, trivia, parent/child links), while ASTNode is minimal.

## Decision

Create a single, unified AST node structure that is fully compatible with Language Server Protocol requirements while supporting different modes of operation:

```typescript
// LSP-compatible position (zero-based line and character)
interface Position {
  line: number;      // uinteger in LSP
  character: number; // uinteger in LSP
  offset?: number;   // Absolute offset in source (for compatibility)
}

// LSP-compatible range
interface Range {
  start: Position;
  end: Position;
}

// Base structure for all AST nodes
interface BaseASTNode {
  // Core properties - always present
  type: NodeType | 'Error';
  
  // LSP-compatible range - always present for LSP features
  range: Range;
  
  // Optional rich information - populated based on parser options
  parent?: ASTNode;          // Parent reference
  children?: ASTNode[];      // Child nodes for navigation
  
  // Source preservation (useful for refactoring)
  leadingTrivia?: TriviaInfo[];  // Comments/whitespace before
  trailingTrivia?: TriviaInfo[]; // Comments/whitespace after
  raw?: string;                  // Original source text
  
  // Metadata for tools
  id?: string;               // Unique identifier for the node
  symbolKind?: SymbolKind;   // LSP SymbolKind for outline
}

// Trivia information for preserving formatting
interface TriviaInfo {
  type: 'whitespace' | 'comment' | 'lineComment';
  value: string;
  range: Range;
}

// Parser options to control what gets populated
interface ParserOptions {
  mode: 'production' | 'development';
  preserveTrivia?: boolean;      // Populate trivia arrays
  buildNavigation?: boolean;     // Populate parent/children
  preserveSource?: boolean;      // Populate raw text
  generateIds?: boolean;         // Generate unique IDs
}
```

### Key LSP Compatibility Features

1. **Position and Range**: Using LSP-standard zero-based line/character positions
2. **Symbol Information**: Optional `symbolKind` for document outline support
3. **Trivia Preservation**: Separate leading/trailing trivia for accurate formatting
4. **Navigation**: Parent/children references for tree traversal
5. **Error Nodes**: Special 'Error' type for parse error recovery

The structure will use discriminated unions for node-specific properties:

```typescript
type ASTNode = 
  | IdentifierNode
  | LiteralNode
  | BinaryNode
  | UnaryNode
  | FunctionNode
  | ErrorNode
  // ... etc

interface IdentifierNode extends BaseASTNode {
  type: NodeType.Identifier;
  name: string;
  // Optional LSP symbol info
  symbolKind?: SymbolKind.Variable | SymbolKind.Function | SymbolKind.Property;
}

interface FunctionNode extends BaseASTNode {
  type: NodeType.Function;
  name: ASTNode;
  arguments: ASTNode[];
  // LSP-specific
  symbolKind?: SymbolKind.Function;
  detail?: string; // Function signature for hover/outline
}

interface ErrorNode extends BaseASTNode {
  type: 'Error';
  message: string;
  expected?: string[];
  // LSP diagnostic info
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string; // e.g., 'fhirpath'
}
```

### LSP Feature Support

The unified structure enables rich LSP features:

1. **Diagnostics**: Error nodes can directly map to LSP diagnostics
2. **Document Symbols**: Nodes with `symbolKind` appear in outline
3. **Hover Information**: Range info enables precise hover targets
4. **Go to Definition**: Navigation links via parent/child references
5. **Formatting**: Trivia preservation enables accurate reformatting
6. **Refactoring**: Raw text and precise ranges enable safe transformations

## Consequences

### Positive

- **Single source of truth**: One AST structure to maintain and understand
- **Type safety**: No more type assertions or union types in consumers
- **LSP compatibility**: Direct support for Language Server Protocol features
- **Flexibility**: Can produce minimal ASTs for production or rich ASTs for development
- **Backward compatibility**: Existing code continues to work
- **Better IDE support**: Structure designed for rich editor features
- **Cleaner architecture**: Clear separation between core and optional features
- **Performance control**: Only pay for features you need
- **Future-proof**: Ready for advanced LSP features like semantic tokens, code lens, etc.

### Negative

- **Breaking change**: Existing code using LSPASTNode directly will need updates
- **Memory overhead**: Even minimal nodes have slots for optional properties
- **Complexity**: Single structure must handle all use cases
- **Migration effort**: Need to update all existing parser and consumer code

## Alternatives Considered

### 1. Keep Separate Structures
- **Pros**: No breaking changes, specialized structures
- **Cons**: Continued type incompatibility, maintenance burden

### 2. Interface Inheritance
```typescript
interface BasicASTNode { /* minimal */ }
interface RichASTNode extends BasicASTNode { /* LSP features */ }
```
- **Pros**: Type hierarchy, some code reuse
- **Cons**: Still have two types, compatibility issues remain

### 3. Generic AST Node
```typescript
interface ASTNode<TExtra = {}> {
  type: NodeType;
  extra?: TExtra;
}
```
- **Pros**: Very flexible
- **Cons**: Complex types, poor IntelliSense, harder to use

### 4. Separate Metadata Object
```typescript
interface ASTNode { /* minimal */ }
interface ASTMetadata { /* rich info */ }
const metadata = new WeakMap<ASTNode, ASTMetadata>();
```
- **Pros**: Clean separation, no overhead on nodes
- **Cons**: Harder to use, can't serialize easily, GC concerns

## Implementation Plan

1. Update `types.ts` with new unified structure
   - Import necessary LSP types (Position, Range, SymbolKind, DiagnosticSeverity)
   - Define BaseASTNode with LSP-compatible properties
   - Create discriminated union types for all nodes
   
2. Create adapter functions for backward compatibility
   - Function to convert old ASTNode to new format
   - Function to convert old LSPASTNode to new format
   - Type guards for checking available properties
   
3. Update Parser to use new structure (minimal mode)
   - Always populate Range with line/character positions
   - Skip optional properties in production mode
   - Ensure LSP-compatible position tracking
   
4. Update LSPParser to use new structure (rich mode)
   - Populate all optional properties
   - Add symbolKind for relevant nodes
   - Preserve trivia and source text
   
5. Update consumers (Analyzer, Interpreter) to handle unified structure
   - Remove special handling for LSPASTNode
   - Use standard Range for diagnostics
   - Check for optional properties before use
   
6. Add tests for both modes
   - Test minimal parser output
   - Test rich parser output
   - Test LSP feature compatibility
   
7. Update documentation
   - Document LSP compatibility features
   - Provide examples of LSP integration
   - Migration guide from old structures

## Migration Strategy

To ease migration, we'll provide:

1. Type guards to check which properties are available
2. Utility functions to convert between old and new formats
3. Compatibility layer for existing code
4. Clear migration guide with examples

The migration can be done incrementally, with both structures coexisting temporarily.

## LSP Integration Examples

### Document Symbols
```typescript
function extractSymbols(ast: ASTNode): LSP.DocumentSymbol[] {
  const symbols: LSP.DocumentSymbol[] = [];
  
  if (ast.symbolKind && ast.type === NodeType.Function) {
    symbols.push({
      name: (ast as FunctionNode).name.toString(),
      kind: ast.symbolKind,
      range: ast.range,
      selectionRange: ast.range,
      children: ast.children?.flatMap(extractSymbols) || []
    });
  }
  
  return symbols;
}
```

### Diagnostics from Error Nodes
```typescript
function extractDiagnostics(ast: ASTNode): LSP.Diagnostic[] {
  if (ast.type === 'Error') {
    const error = ast as ErrorNode;
    return [{
      range: error.range,
      severity: error.severity || LSP.DiagnosticSeverity.Error,
      code: error.code,
      source: error.source || 'fhirpath',
      message: error.message
    }];
  }
  
  return ast.children?.flatMap(extractDiagnostics) || [];
}
```