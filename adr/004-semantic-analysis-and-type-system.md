# ADR-004: Pure Type Analysis System

## Status

Proposed

## Context

The current FHIRPath implementation has a parser that produces an untyped Abstract Syntax Tree (AST). We need a type analysis system that can:

1. **Analyze Types**: Determine the types of expressions without modifying the existing interpreter, essentially performing "evaluation without data".

2. **Leverage Function Signatures**: The existing function registry already contains rich type information through function signatures that we can use for type inference.

3. **Navigate Complex Types**: Support property navigation through nested structures, handling both simple properties and complex paths like `Patient.name.given`.

4. **Track Singleton vs Collection**: Determine whether expressions produce single values or collections, enabling validation of function requirements.

5. **Extend AST**: Add type information directly to AST nodes rather than creating wrapper structures.

6. **Validation**: Support validating FHIRPath expressions and provide meaningful error messages without executing the expressions.

## Decision

We will implement a pure type analysis system that operates on the AST without modifying the interpreter. This system will be completely separate from the runtime execution path:

### 1. Core Concept: Type Analysis as Evaluation Without Data

The type analyzer follows the same evaluation pattern as the interpreter, but instead of processing actual values, it tracks type information through the expression tree. This approach ensures consistency between type checking and runtime behavior.

Each AST node is extended with optional fields:
- `resultType`: The type that this expression will produce
- `isSingleton`: Whether the expression produces a single value or a collection

### 2. Function Registry with Type Signatures

A comprehensive function registry must be created with predefined type signatures for all built-in functions. Each function signature specifies:
- Input type constraints and singleton requirements
- Parameter types and their singleton requirements  
- Return type calculation (static or dynamic)
- Whether the function returns a singleton or collection

Functions fall into several categories based on their type behavior:

**Static Return Types**: Functions with fixed return types
- `count()` → always returns Integer singleton
- `exists()` → always returns Boolean singleton
- `toString()` → always returns String (singleton if input is singleton)

**Dynamic Return Types**: Functions that compute return type from inputs
- `first()` → returns input type as singleton
- `union()` → returns common base type of all inputs
- `iif()` → returns common type of true/false branches

**Expression-Based Types**: Functions that evaluate expressions to determine types
- `select(expression)` → evaluates expression with each input item to determine result type
- `where(condition)` → returns input type (filters don't change type)
- `ofType(Type)` → returns the specified type

**Any Return Types**: Functions where type cannot be determined statically
- `trace()` → returns Any (same cardinality as input)
- `children()` → returns Any collection
- `descendants()` → returns Any collection

The registry must support both simple type declarations and type computation functions that can analyze the AST of parameter expressions (particularly for `select()`, `where()`, etc.).

### 3. Model Provider Interface

The model provider is responsible for type resolution and property navigation. It supports:
- Type name resolution (with namespace handling)
- Property lookup on types, including polymorphic properties
- Type compatibility checking
- Union type representation for choice types

For property navigation, the model provider handles both simple and polymorphic properties:
- Simple properties: `Patient.name` → HumanName type
- Nested navigation: `Patient.name.given` → String collection
- Polymorphic properties: `Observation.value` → Union(Quantity | String | Boolean | Integer | Range | Ratio | SampledData | Period | CodeableConcept)

Union types are essential for FHIR's choice types (like `value[x]`) where a property can hold values of different types. The type analyzer must track all possible types and propagate this information through subsequent operations.

### 4. Type Analysis Algorithm

The type analyzer visits each node in the AST and computes type information by following the same patterns as the interpreter:

**For Literals**: The type is determined directly from the literal value (String, Integer, Boolean, etc.)

**For Identifiers**: 
- Use the model provider to look up the property type
- Track whether the property returns a singleton or collection
- For polymorphic properties, return a union type containing all possible types
- Subsequent operations must handle union types appropriately

**For Binary Operations**:
- The dot operator (`.`) performs type-based property navigation
- Arithmetic operators check numeric type compatibility
- Comparison operators validate comparable types
- Logical operators expect boolean-convertible types

**For Functions**:
- Look up the function signature from the registry
- Validate input type against function requirements
- Check singleton requirements for input and parameters
- Calculate return type (may depend on input/parameter types)
- Determine if result is singleton based on function behavior

**For Type Operations** (`is`, `as`, `ofType`):
- Resolve type names using the model provider
- Track type narrowing for subsequent operations

**For Union Types**:
- When navigating from a union type, check the property on each type in the union
- If all types have the property with the same type, return that type
- If types differ, return a new union of all possible result types
- If some types lack the property, the result may be empty

**For Any Type**:
- When a function returns `Any`, subsequent property access is allowed but returns `Any`
- Type checking continues but with reduced precision
- Singleton tracking may become uncertain

The analyzer operates in two modes:
- **Lenient mode**: Records type mismatches as warnings, continues analysis with `Any` type
- **Strict mode**: Treats type mismatches as errors, but still handles `Any` type gracefully

### 5. Step-by-Step Analysis Example

Consider the expression: `Patient.name.where(use = 'official').given.first()`

The analyzer processes this expression following the AST structure:

**Step 1: Analyze the root (dot operator)**
- AST: Binary(DOT, left: Binary(...), right: Function(first))
- Process left side first to determine input for right side

**Step 2: Analyze left side of root (another dot operator)**
- AST: Binary(DOT, left: Binary(...), right: Identifier(given))
- Process left side first

**Step 3: Analyze `Patient.name.where(use = 'official')`**
- This is another Binary(DOT) with Function(where) on the right
- Continue decomposing...

**Step 4: Analyze `Patient.name`**
- Binary(DOT, left: Identifier(Patient), right: Identifier(name))
- Left: `Patient` → TypeOrIdentifier resolved to Patient type
- Right: `name` → Model provider returns: HumanName type, collection (not singleton)
- Result: HumanName collection

**Step 5: Analyze `.where(use = 'official')`**
- Input type: HumanName collection
- Function signature for `where`: returns same type as input, filters collection
- Parameter expression `use = 'official'`:
  - In context of HumanName: `use` property returns code type (singleton)
  - Comparison with string literal is valid
- Result: HumanName collection (same type, potentially fewer items)

**Step 6: Analyze `.given`**
- Input type: HumanName collection
- Model provider lookup: HumanName.given → String type, collection
- For each HumanName in input, `given` returns String collection
- Result: String collection (flattened from collection of collections)

**Step 7: Analyze `.first()`**
- Input type: String collection
- Function signature: first() → returns input type as singleton
- Result: String singleton

**Final annotated AST:**
```
Binary(DOT) → String, singleton
├─ Binary(DOT) → String, collection
│  ├─ Binary(DOT) → HumanName, collection
│  │  ├─ Binary(DOT) → HumanName, collection
│  │  │  ├─ Identifier(Patient) → Patient, singleton
│  │  │  └─ Identifier(name) → HumanName, collection
│  │  └─ Function(where) → HumanName, collection
│  │     └─ Binary(EQ) → Boolean, singleton
│  │        ├─ Identifier(use) → code, singleton
│  │        └─ Literal('official') → String, singleton
│  └─ Identifier(given) → String, collection
└─ Function(first) → String, singleton
```

Each node is annotated with its result type and cardinality, enabling validation of type constraints and function requirements.

### 6. Function and Operator Registry Examples

The type system requires comprehensive registries for functions and operators. Here's how they might be structured:

**Function Registry Example:**

```
exists() → {
  requiresSingleton: false,
  parameters: [],
  returnType: { name: 'Boolean', namespace: 'System' },
  returnsSingleton: true
}

count() → {
  requiresSingleton: false,
  parameters: [],
  returnType: { name: 'Integer', namespace: 'System' },
  returnsSingleton: true
}

first() → {
  requiresSingleton: false,
  parameters: [],
  returnType: (input) => input,  // Same as input type
  returnsSingleton: true
}

select(expression) → {
  requiresSingleton: false,
  parameters: [{ expression: true }],  // Expression parameter
  returnType: (input, params, analyzer) => {
    // Analyze the expression in context of each input item
    // Return the expression's result type
    return analyzer.analyzeExpression(params[0], input);
  },
  returnsSingleton: false  // Always returns collection
}

where(condition) → {
  requiresSingleton: false,
  parameters: [{ expression: true }],
  returnType: (input) => input,  // Same as input type
  returnsSingleton: false  // Maintains collection
}

toString() → {
  requiresSingleton: false,
  parameters: [],
  returnType: { name: 'String', namespace: 'System' },
  returnsSingleton: (input) => input  // Preserves input cardinality
}

children() → {
  requiresSingleton: false,
  parameters: [],
  returnType: { name: 'Any', namespace: 'System' },
  returnsSingleton: false  // Always collection
}

iif(condition, trueResult, falseResult) → {
  requiresSingleton: true,  // Condition must be singleton
  parameters: [
    { requiresSingleton: true },  // condition
    { expression: true },          // true branch
    { expression: true }           // false branch
  ],
  returnType: (input, params, analyzer) => {
    const trueType = analyzer.analyzeExpression(params[1], input);
    const falseType = analyzer.analyzeExpression(params[2], input);
    return analyzer.commonType(trueType, falseType);
  },
  returnsSingleton: (input, params) => {
    // Result is singleton if both branches return singletons
    return params[1].isSingleton && params[2].isSingleton;
  }
}
```

**Operator Registry Example:**

```
'+' (arithmetic) → {
  requiresLeftSingleton: true,
  requiresRightSingleton: true,
  acceptedTypes: [
    { left: 'Integer', right: 'Integer', result: 'Integer' },
    { left: 'Decimal', right: 'Decimal', result: 'Decimal' },
    { left: 'Integer', right: 'Decimal', result: 'Decimal' },
    { left: 'Decimal', right: 'Integer', result: 'Decimal' },
    { left: 'String', right: 'String', result: 'String' }  // Concatenation
  ],
  returnsSingleton: true
}

'=' (equality) → {
  requiresLeftSingleton: false,  // Can compare collections
  requiresRightSingleton: false,
  acceptedTypes: 'any',  // Any types can be compared
  returnType: { name: 'Boolean', namespace: 'System' },
  returnsSingleton: true
}

'.' (dot/navigation) → {
  requiresLeftSingleton: false,
  requiresRightSingleton: false,
  returnType: (left, right, analyzer) => {
    // Special handling - right is evaluated in context of left
    return analyzer.analyzeInContext(right, left);
  },
  returnsSingleton: (left, right) => {
    // Singleton only if both sides are singleton
    return left.isSingleton && right.isSingleton;
  }
}

'and' (logical) → {
  requiresLeftSingleton: true,
  requiresRightSingleton: true,
  acceptedTypes: [
    { left: 'Boolean', right: 'Boolean', result: 'Boolean' }
  ],
  returnsSingleton: true,
  shortCircuit: true  // Can skip right evaluation if left is false
}

'in' (membership) → {
  requiresLeftSingleton: true,
  requiresRightSingleton: false,  // Right is a collection to search in
  returnType: { name: 'Boolean', namespace: 'System' },
  returnsSingleton: true
}

'|' (union) → {
  requiresLeftSingleton: false,
  requiresRightSingleton: false,
  returnType: (left, right, analyzer) => {
    return analyzer.unionType(left, right);
  },
  returnsSingleton: false  // Always returns collection
}
```

These registries enable the type analyzer to:
- Validate that functions receive appropriate inputs
- Calculate result types based on input types
- Track singleton vs collection through operations
- Handle special cases like expression parameters and type unions

### 6. Implementation Phases

**Phase 1: Core Infrastructure**
- Extend AST interfaces with type and singleton fields
- Create TypeInfo type
- Implement MockModelProvider for testing

**Phase 2: Function Registry Enhancement**
- Add type signature support to function registry
- Define signatures for all built-in functions
- Implement type computation functions for dynamic types
- Support expression evaluation for select/where type inference

**Phase 3: Type Analyzer**
- Implement AST visitor for type analysis
- Type inference for all node types
- Singleton tracking through expressions

**Phase 4: Type Checking**
- Operator type compatibility
- Singleton requirement validation
- Strict mode implementation

## Consequences

### Positive

- **No Runtime Impact**: Type analysis runs independently from the interpreter with no performance overhead
- **Early Validation**: Detects type errors before execution, improving development experience
- **Consistent with Interpreter**: Uses the same traversal patterns, ensuring behavioral consistency
- **Leverages Existing Infrastructure**: Reuses function signatures and registry
- **Flexible Model System**: Model provider interface supports various type systems
- **Progressive Enhancement**: AST extensions are optional and backward compatible

### Negative

- **Parallel Implementation**: Must maintain type rules that mirror interpreter behavior
- **Synchronization Challenge**: Changes to interpreter semantics require analyzer updates
- **Limited Runtime Benefits**: Type information isn't available for runtime optimizations
- **Model Complexity**: Accurate type modeling for complex structures requires significant effort

### Neutral

- **Separate Tool**: Type analysis becomes a separate tool/library concern
- **Optional Dependency**: Projects can choose whether to include type analysis
- **Model Loading**: Need to decide how to load/define FHIR models (JSON schema, TypeScript, etc.)

## Alternatives Considered

### 1. Modify Interpreter for Type Awareness
Update the existing interpreter to include type checking.

**Pros:**
- Single source of truth for behavior
- Can optimize based on types
- No duplication of logic

**Cons:**
- Breaks separation of concerns
- Adds runtime overhead for all users
- Makes interpreter more complex
- Can't validate without execution

### 2. Type-Annotated AST
Modify AST nodes to include type information.

**Pros:**
- Type information travels with nodes
- Natural place for type data

**Cons:**
- Requires modifying existing AST structure
- Increases memory usage for all users
- Couples parsing with type analysis

### 3. Language Server Protocol Implementation
Build type analysis as part of a full LSP implementation.

**Pros:**
- Standard protocol for IDE integration
- Could provide other IDE features

**Cons:**
- Much larger scope
- Overkill if only type checking needed
- Requires LSP runtime infrastructure

## Decision Rationale

The pure type analysis approach is chosen because:

1. **Conceptual Clarity**: Treating type analysis as "evaluation without data" provides a clear mental model
2. **Behavioral Consistency**: Following interpreter patterns ensures type checking matches runtime behavior
3. **No Runtime Impact**: Type checking remains completely optional with zero overhead
4. **Reuses Existing Knowledge**: Function signatures already encode type rules
5. **Supports Complex Navigation**: Model provider abstraction handles nested property paths naturally
6. **Progressive Implementation**: Can start simple and add sophistication incrementally

This approach frames type analysis as a static simulation of expression evaluation, making it easier to ensure that type checking rules align with actual runtime behavior. The model provider abstraction allows for rich type systems while keeping the analyzer logic focused on traversal and validation.