# Code Review: Completion Provider

This review focuses on the `CompletionProvider` (`src/completion-provider.ts`), which is responsible for generating context-aware completions for the Language Server Protocol (LSP).

## 1. Overall Assessment

The completion provider is well-structured and correctly implements the high-level design outlined in ADR-013. The core logic flow (Parse -> Analyze -> Generate Completions) is sound, and the use of a `switch` statement based on the `CursorContext` creates a clean, modular design where completion logic is separated by context (Identifier, Operator, Type, etc.).

The main opportunity for improvement lies in simplifying the provider by delegating more of the contextual analysis to the `Analyzer` itself. Currently, the completion provider performs a significant amount of post-analysis logic to interpret the AST and determine the precise cursor context. Moving this responsibility to the `Analyzer` would make the system more robust and the completion provider's role more declarative.

## 2. Completion Provider Suggestions

### 2.1. [ARCHITECTURE] Delegate Context Discovery to the Analyzer

**Observation:**
A significant portion of the `provideCompletions` function is dedicated to "fixing up" the context received from the analyzer. This includes complex logic to determine if the cursor is the right operand of a binary expression, handling partial identifiers, and using the `findFunctionName` helper to traverse the AST and find the name of the current function.

This fix-up logic is a code smell; it indicates a disconnect between the information the `Analyzer` provides and what the `CompletionProvider` truly needs. It makes the completion provider brittle, as any change in the parser's AST structure could break the traversal logic.

**Suggestion:**
Refactor the `Analyzer` to be the single source of truth for cursor context. The `AnalysisResultWithCursor` interface should be enriched to provide all the necessary information directly, removing the need for post-processing in the completion provider.

**Recommended `cursorContext` enhancements in `analyzer.ts`:**

1.  **Active Function Context:** When the analyzer detects a `CursorArgumentNode`, it should determine the function being called and attach the `FunctionDefinition` to the cursor context.

    ```typescript
    // In AnalysisResultWithCursor.cursorContext
    functionCall?: {
      definition: FunctionDefinition;
      argumentIndex: number;
    };
    ```

2.  **Reliable `typeBeforeCursor`:** The analyzer should be responsible for providing the definitive type of the expression immediately preceding the cursor, especially in binary operations. This would eliminate the need for the completion provider to look at `ast.left.typeInfo`.

3.  **Partial Identifier Text:** The parser or analyzer should identify any partial identifier text at the cursor and include it in the context, removing the need for the `extractPartialText` helper function.

By making the `Analyzer` responsible for this discovery, the `CompletionProvider` becomes much simpler and more robust. Its only job is to take the rich context provided by the analyzer and map it to a list of completion items from the registry and model provider.

### 2.2. [REFINEMENT] Improve Function Applicability Logic for Completions

**Observation:**
The `isFunctionApplicable` helper correctly delegates to the registry. However, the accuracy of completions, especially regarding singleton vs. collection functions (as tested in `completion-singleton-collection.test.ts`), depends heavily on the precision of the function signatures in the registry.

**Suggestion:**
The most effective way to improve the relevance of function completions is to fully **implement ADR-014 (Union Types in Function Signatures)**. As noted in the main code review, many function definitions still use a single signature.

Once all functions have an array of precise signatures, the `registry.isFunctionApplicableToType` method can be enhanced to strictly check not only the `type` but also the `singleton` property of the `TypeInfo`. This will ensure that:
*   `length()` and `upper()` do not appear as completions for a collection of strings (`String[]`).
*   `count()` and `distinct()` do not appear as completions for a singleton `String`.

This change will dramatically improve the user experience by reducing noise and only showing functions that are valid for the specific type and cardinality of the expression.

### 2.3. [CLARITY] Consolidate Partial Text Handling

**Observation:**
The `extractPartialText` helper function in the completion provider manually scans backwards from the cursor to find the start of an identifier. This is lexical analysis logic living in the presentation layer.

**Suggestion:**
This logic belongs closer to the source of truth. When the parser creates a `CursorIdentifierNode`, it should be responsible for capturing any partial text. The `CursorIdentifierNode` interface could be updated:

```typescript
// In src/cursor-nodes.ts
export interface CursorIdentifierNode extends CursorNode {
  context: CursorContext.Identifier;
  partialText?: string;
}
```

The parser, upon seeing a cursor, would check if the preceding token was an identifier and populate this field. This simplifies the completion provider and makes the `CursorIdentifierNode` a more complete representation of the cursor's context.
