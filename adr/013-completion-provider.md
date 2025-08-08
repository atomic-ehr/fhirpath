# ADR-013: Completion Provider for FHIRPath LSP

## Status
Proposed

## Context
With cursor node support (ADR-012) and analyzer cursor mode (Task 013) in place, we need a completion provider that can generate intelligent, context-aware completions for FHIRPath expressions. The completion provider should leverage:
- Cursor node types to understand what kind of completion is needed
- Type information from the analyzer to provide type-appropriate suggestions
- Model provider for FHIR resource structure
- Registry for available functions and operators

## Decision
Implement a `provideCompletions` function that generates completions based on cursor context and type information.

## Detailed Design

### API

```typescript
interface CompletionItem {
  label: string;           // Display text
  kind: CompletionKind;    // variable, function, property, operator, type, keyword
  detail?: string;         // Short description
  documentation?: string;  // Full documentation
  insertText?: string;     // Text to insert (if different from label)
  sortText?: string;       // Sort order
}

enum CompletionKind {
  Property = 'property',
  Function = 'function',
  Variable = 'variable',
  Operator = 'operator',
  Type = 'type',
  Keyword = 'keyword',
  Constant = 'constant'
}

function provideCompletions(
  expression: string,
  cursorPosition: number,
  modelProvider?: ModelProvider,
  variables?: Record<string, any>
): CompletionItem[]
```

### Completion Strategies by Cursor Context

#### 1. CursorIdentifierNode (after dot)
```typescript
Patient.name.|
```
- Get type from analyzer's `cursorContext.typeBeforeCursor`
- If type is known:
  - Use modelProvider to get properties of that type
  - Add built-in collection functions if type is a collection
  - Add type-specific functions from registry
- Always include common functions: `where`, `select`, `first`, `last`, etc.

#### 2. CursorOperatorNode (between expressions)
```typescript
Patient.name |
5 |
```
- Provide operator completions based on left side type:
  - Arithmetic operators for numbers (`+`, `-`, `*`, `/`, `div`, `mod`)
  - Comparison operators for all types (`=`, `!=`, `<`, `>`, `<=`, `>=`)
  - Logical operators for booleans (`and`, `or`, `xor`, `implies`)
  - String operators for strings (`+`, `&`)
  - Collection operators (`|`, `union`, `intersect`, `exclude`)
  - Type operators (`is`, `as`)

#### 3. CursorTypeNode (after is/as/ofType)
```typescript
value is |
collection.ofType(|)
```
- Provide FHIRPath type completions:
  - Primitive types: `Boolean`, `String`, `Integer`, `Decimal`, `Date`, `DateTime`, `Time`, `Quantity`
  - FHIR types: `Coding`, `CodeableConcept`, `Period`, `Range`, etc.
- For `ofType()`, also include FHIR resource types from modelProvider:
  - `Patient`, `Observation`, `Condition`, `Procedure`, etc.

#### 4. CursorArgumentNode (in function arguments)
```typescript
where(|)
substring(0, |)
```
- Get function signature from registry using function name
- Determine argument position from `cursorNode.argumentIndex`
- Based on expected parameter type:
  - If expects expression: provide context-aware completions
  - If expects literal: suggest appropriate literals
  - Special handling for lambda functions:
    - `where()`, `select()`, `all()`, `exists()`: `$this` is the item type
    - Provide properties of item type
    - Include `$this`, `$index` variables

#### 5. CursorIndexNode (in brackets)
```typescript
Patient[|]
```
- Suggest:
  - Integer literals: `0`, `1`, etc.
  - Index-related functions: `first()`, `last()`
  - Variables: `$index` if in iteration context
  - Expressions that return integers

### Special Contexts

#### Variables in Scope
- System variables: `$this`, `$index`, `$total` (context-dependent)
- Environment variables: `%resource`, `%context`, `%ucum`
- User-defined variables from `defineVariable()`
- Variables passed to analyzer

#### Collection vs Singleton Context
- For collections: offer aggregation functions (`count`, `distinct`, `aggregate`)
- For singletons: offer navigation and property access
- Adjust function suggestions based on cardinality

#### Type-specific Completions
- String type: `length`, `startsWith`, `endsWith`, `contains`, `substring`
- DateTime types: `toDate()`, `toString()`, date arithmetic
- Quantity type: unit conversions, arithmetic
- Coding/CodeableConcept: `system`, `code`, `display`

### Implementation Approach

1. **Parse with cursor**: 
   ```typescript
   const parseResult = parse(expression, { cursorPosition });
   ```

2. **Analyze with cursor mode**:
   ```typescript
   const analysis = analyzer.analyze(
     parseResult.ast, 
     variables, 
     inputType,
     { cursorMode: true }
   );
   ```

3. **Extract context**:
   ```typescript
   const cursorNode = analysis.cursorContext?.cursorNode;
   const typeBeforeCursor = analysis.cursorContext?.typeBeforeCursor;
   ```

4. **Generate completions based on context**:
   ```typescript
   switch (cursorNode.context) {
     case CursorContext.Identifier:
       return getPropertyCompletions(typeBeforeCursor, modelProvider);
     case CursorContext.Operator:
       return getOperatorCompletions(typeBeforeCursor);
     // etc.
   }
   ```

### Filtering and Ranking

1. **Prefix matching**: Filter completions by partial text before cursor
2. **Type compatibility**: Only show type-compatible suggestions
3. **Relevance scoring**:
   - Exact type matches score higher
   - Common operations score higher
   - Recently used (if tracked) score higher
4. **Grouping**: Group by kind (properties, functions, operators)

### Examples

```typescript
// After dot on Patient type
"Patient." → 
  - Properties: name, birthDate, gender, address...
  - Functions: where(), select(), first()...

// In where() on name array
"Patient.name.where(" →
  - Properties of name: use, family, given, text...
  - Variables: $this, $index
  - Operators: =, !=, ~...

// After 'is' operator
"value is " →
  - Types: String, Integer, Boolean, Patient...

// Between number expressions  
"5 + " →
  - Numbers: literals
  - Operators: +, -, *, /
  - Functions returning numbers
```

## Consequences

### Positive
- Type-aware completions improve developer productivity
- Context-sensitive suggestions reduce errors
- Leverages existing infrastructure (cursor nodes, analyzer)
- Extensible through modelProvider and registry
- Supports complex scenarios (lambdas, variables, type checking)

### Negative
- Requires modelProvider for full FHIR completions
- Performance considerations for large type hierarchies
- Complexity in handling all contexts correctly
- May need caching for frequently requested completions

### Implementation Considerations
- Should handle partial identifiers for filtering
- Need to merge completions from multiple sources
- Consider async loading of completions if needed
- May want to limit number of completions returned
- Should handle error cases gracefully (missing types, etc.)

## Future Enhancements
- Snippet completions with placeholders
- Auto-import suggestions
- Context-aware documentation
- Learning from user selections
- Custom completion providers for extensions

## References
- Language Server Protocol Completion specification
- FHIRPath specification section on functions and operators
- FHIR resource type definitions