# Code Review: Analyzer

This review focuses on the `Analyzer` component (`src/analyzer.ts`), which is responsible for semantic analysis, type inference, and validation of the FHIRPath AST.

## 1. Overall Assessment

The Analyzer is the semantic heart of the FHIRPath engine and is impressively capable. It successfully implements the architectural goals laid out in the ADRs, including:

*   **Type Enrichment (ADR-003):** The `annotateAST` method correctly traverses the tree and attaches `typeInfo` to nodes.
*   **Model-Awareness (ADR-004):** It properly utilizes the `ModelProvider` interface for type-aware navigation and validation.
*   **System Variable Scoping (ADR-012):** It handles the contextual nature of variables like `$this` and `$total` during the analysis of filter and aggregate functions.
*   **Unified Error System (ADR-010):** It uses the centralized `Errors` factory to generate consistent, coded diagnostics.
*   **LSP/Tooling Support:** The `cursorMode` provides the necessary context for features like code completion.

The separation of the analysis process into an initial `annotateAST` pass followed by a `visitNode` validation pass is a clean and effective pattern. The suggestions below focus on refining the implementation to improve maintainability and fully align with the project's architectural vision.

## 2. Analyzer Suggestions

### 2.1. [REFACTOR] Introduce a Scope Manager for Variables

**Observation:**
The `annotateAST` method currently manages the scope of system variables (like `$this`, `$index`, `$total`) by manually saving the current state of the `systemVariableTypes` map, setting a new value for the duration of a function's argument processing, and then restoring the old value. 

**Example (`annotateAST` for `where`/`select`):**
```typescript
// Save current system variable context
const savedThis = this.systemVariableTypes.get('$this');
const savedIndex = this.systemVariableTypes.get('$index');

// Set system variables for expression evaluation
this.systemVariableTypes.set('$this', elementType);
this.systemVariableTypes.set('$index', { type: 'Integer', singleton: true });

// Process arguments...

// Restore previous context
if (savedThis) {
  this.systemVariableTypes.set('$this', savedThis);
} else {
  this.systemVariableTypes.delete('$this');
}
// ... and so on
```
This pattern, while functional, is verbose and potentially error-prone, especially with deeply nested expressions. A `restore` step could easily be missed.

**Suggestion:**
Introduce a dedicated `ScopeManager` class to handle the complexity of lexical scoping in a more robust, stack-based manner. The Analyzer would delegate all scope operations to this manager.

**Example `ScopeManager`:**
```typescript
class ScopeManager {
  private scopes: Map<string, any>[] = [new Map()];

  enterScope() {
    this.scopes.push(new Map());
  }

  leaveScope() {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  set(name: string, type: TypeInfo) {
    this.scopes[this.scopes.length - 1].set(name, type);
  }

  get(name: string): TypeInfo | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) {
        return this.scopes[i].get(name);
      }
    }
    return undefined;
  }
}
```

The `annotateAST` logic would become much cleaner:
```typescript
// In Analyzer, when processing 'where' function
this.scopeManager.enterScope();
this.scopeManager.set('$this', elementType);
this.scopeManager.set('$index', { type: 'Integer', singleton: true });

// Process arguments...

this.scopeManager.leaveScope();
```
This refactoring would make the analyzer's code easier to read, reduce boilerplate, and eliminate the risk of improperly managed scope contexts.

### 2.2. [REFACTOR] Delegate Function-Specific Type Inference Logic

**Observation:**
The `inferFunctionType` method contains a growing list of special cases for functions whose return types are dynamic and cannot be described by a simple, static signature (e.g., `iif`, `defineVariable`, `aggregate`, `children`).

**Example (`inferFunctionType`):**
```typescript
if (funcName === 'iif') { /* special logic */ }
if (funcName === 'defineVariable') { /* special logic */ }
if (funcName === 'aggregate') { /* special logic */ }
// ... etc.
```
This pattern centralizes all special logic within the Analyzer, making it harder to maintain and extend. Adding a new function with dynamic type behavior requires modifying the core analyzer.

**Suggestion:**
To improve modularity, move this specialized type inference logic into the function definitions themselves within the `registry`. A `FunctionDefinition` could have an optional `inferResultType` method.

**Example (`types.ts`):**
```typescript
export interface FunctionDefinition {
  // ... existing properties
  inferResultType?: (analyzer: Analyzer, node: FunctionNode, inputType?: TypeInfo) => Promise<TypeInfo>;
}
```

The `inferFunctionType` method in the analyzer would then become a generic dispatcher:
```typescript
// In Analyzer.inferFunctionType
const func = registry.getFunction(funcName);
if (!func) return { type: 'Any', singleton: false };

// Use custom inference if provided
if (func.inferResultType) {
  return await func.inferResultType(this, node, inputType);
}

// Fallback to standard signature-based inference
// ...
```
This change would make function definitions more self-contained and the analyzer more extensible.

### 2.3. [REFINEMENT] Complete the Asynchronous Transition

**Observation:**
As noted in the general review, the Analyzer has not fully transitioned to the asynchronous model envisioned in ADR-010. It still relies on a synchronous `modelProvider.getTypeFromCache()` method in several places to get type information during its traversal.

**Suggestion:**
Complete the transition by making all internal type inference methods that interact with the model provider `async`. 

1.  Change methods like `inferIdentifierType` and `inferNavigationType` to be consistently `async`.
2.  Replace all calls to `getTypeFromCache()` with `await this.modelProvider.getType(...)`.

This change simplifies the `ModelProvider` interface by removing the need for a separate caching method and makes the analyzer's data flow more robust and easier to reason about, fully aligning it with the project's async-first architecture.
