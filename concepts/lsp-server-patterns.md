# LSP Server Implementation Patterns in TypeScript

## Overview
Language Server Protocol (LSP) standardizes communication between language servers and development tools. This document explores common patterns for implementing LSP servers in TypeScript.

## Core Libraries

### 1. vscode-languageserver
The official Microsoft implementation providing:
- Protocol types and interfaces
- Connection management
- Message handling infrastructure

```typescript
import { 
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';
```

### 2. vscode-languageserver-textdocument
Document management utilities:
- Text document tracking
- Position/range calculations
- Change tracking

## Common Architecture Patterns

### 1. Document-Centric Architecture
```typescript
class DocumentManager {
  private documents = new Map<string, ParsedDocument>();
  
  onDocumentOpen(uri: string, content: string) {
    const ast = parse(content);
    const diagnostics = analyze(ast);
    this.documents.set(uri, { ast, diagnostics, content });
  }
  
  onDocumentChange(uri: string, changes: TextDocumentContentChangeEvent[]) {
    // Update document and re-analyze
  }
}
```

### 2. Service-Based Architecture
```typescript
interface LanguageService {
  validateDocument(document: TextDocument): Diagnostic[];
  getCompletions(document: TextDocument, position: Position): CompletionItem[];
  getHover(document: TextDocument, position: Position): Hover | null;
}
```

### 3. AST Cache Pattern
```typescript
class ASTCache {
  private cache = new Map<string, { 
    version: number;
    ast: ASTNode;
    errors: ParseError[];
  }>();
  
  getAST(document: TextDocument): ASTNode | undefined {
    const cached = this.cache.get(document.uri);
    if (cached?.version === document.version) {
      return cached.ast;
    }
    // Parse and cache
  }
}
```

## Key Implementation Considerations

### 1. Incremental Processing
- Track document versions
- Cache parsed ASTs
- Only re-analyze changed portions when possible

### 2. Position Mapping
```typescript
function findNodeAtPosition(ast: ASTNode, position: Position): ASTNode | null {
  // Walk AST to find node containing position
  // Requires nodes to have range information
}
```

### 3. Error Recovery
- Parser should continue on errors
- Collect all errors, not just first
- Provide partial AST for incomplete code

### 4. Async Operations
- Use async/await for long operations
- Consider cancellation tokens
- Implement request queuing

## LSP Feature Implementation Patterns

### 1. Diagnostics (Validation)
```typescript
connection.onDidChangeContent((change) => {
  const document = documents.get(change.textDocument.uri);
  const diagnostics = validateDocument(document);
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
});
```

### 2. Completion
```typescript
connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  const position = params.position;
  
  // Find context at position
  const context = getCompletionContext(document, position);
  
  // Generate completions based on context
  return generateCompletions(context);
});
```

### 3. Hover
```typescript
connection.onHover((params): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  const ast = getAST(document);
  const node = findNodeAtPosition(ast, params.position);
  
  if (node?.resultType) {
    return {
      contents: `Type: ${getTypeName(node.resultType)}`,
      range: nodeToRange(node)
    };
  }
  return null;
});
```

## Performance Optimization Patterns

### 1. Debouncing
```typescript
class DebouncedValidator {
  private timeouts = new Map<string, NodeJS.Timeout>();
  
  scheduleValidation(uri: string, delay = 500) {
    const existing = this.timeouts.get(uri);
    if (existing) clearTimeout(existing);
    
    this.timeouts.set(uri, setTimeout(() => {
      this.validate(uri);
      this.timeouts.delete(uri);
    }, delay));
  }
}
```

### 2. Progressive Enhancement
- Start with basic features (diagnostics)
- Add advanced features incrementally
- Allow disabling expensive features

### 3. Background Processing
- Use worker threads for heavy computation
- Implement progress reporting
- Support cancellation

## Testing Patterns

### 1. Protocol Testing
```typescript
import { TestConnection } from 'vscode-languageserver/test';

test('completion', async () => {
  const connection = new TestConnection();
  const result = await connection.sendRequest('textDocument/completion', {
    textDocument: { uri: 'test.fhir' },
    position: { line: 0, character: 5 }
  });
  expect(result).toContainItem({ label: 'where' });
});
```

### 2. Integration Testing
- Test against real editors
- Use LSP client libraries
- Verify end-to-end behavior

## References
- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node)
- [Example implementations](https://github.com/microsoft/language-server-protocol/wiki/Protocol-Implementations)