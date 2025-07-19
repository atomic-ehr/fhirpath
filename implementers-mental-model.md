# FHIRPath Implementer's Mental Model

## Core Architecture: The Expression Tree Evaluator

At its heart, a FHIRPath implementation is an **expression tree evaluator** that operates on collections. Think of it as building and walking an AST (Abstract Syntax Tree) where each node:

1. Accepts a collection as input (the "context")
2. Performs some operation
3. Returns a collection as output

```typescript
interface Expression {
  evaluate(context: Collection, environment: Environment): Collection
}
```

This simple interface drives the entire implementation.

## The Collection Abstraction

The fundamental data structure is a **Collection**—an ordered, non-unique list of values. Key implementation insights:

- Collections are **immutable**: Operations create new collections
- Collections are **lazy when possible**: Chain operations without intermediate materializations
- Collections **preserve order**: This matters for functions like `first()` and indexing
- Collections **allow duplicates**: `union()` vs `combine()` have different semantics

```typescript
type Collection = readonly Value[]
type Value = Primitive | ComplexType | Collection
```

## The Type System Strategy

FHIRPath allows multiple implementation strategies for types:

### 1. **Dynamic Typing** (Simplest)
- Types are checked at runtime during evaluation
- Every value carries type information
- Type errors produce empty collections
- Good for: Interpreters, dynamic environments

### 2. **Static Typing** (Most Complex)
- Types are inferred during parsing/compilation
- Requires type inference engine
- Can catch errors before evaluation
- Good for: Compilers, IDE support

### 3. **Hybrid Approach** (Recommended)
- Parse-time validation for obvious errors
- Runtime type checking for polymorphic paths
- Best balance of safety and implementation complexity

## The Evaluation Pipeline

Think of evaluation as a pipeline with these stages:

### 1. **Lexing/Parsing**
```
"Patient.name.given" → [IDENTIFIER, DOT, IDENTIFIER, DOT, IDENTIFIER]
                    → PathExpression(PathExpression(Identifier("Patient"), "name"), "given")
```

### 2. **Context Resolution**
Each expression evaluates against a context:
- Initial context: The root resource
- Navigation changes context: `name` evaluates with Patient as context
- Functions create nested contexts: `where()` evaluates its expression with each item

### 3. **Navigation Strategy**
Path navigation (`a.b`) is the core operation:
```typescript
function navigate(context: Collection, path: string): Collection {
  return context.flatMap(item => getProperty(item, path))
}
```

The key insight: **always flatMap**, never map. This automatically handles:
- Empty collections → empty results
- Single items → their property values
- Multiple items → flattened collection of all property values

## Critical Implementation Patterns

### 1. **The Singleton Converter**
Many operators expect single values. Implement a consistent pattern:
```typescript
function toSingleton(collection: Collection): Value | undefined {
  if (collection.length === 0) return undefined
  if (collection.length === 1) return collection[0]
  throw new Error("Multiple values where single expected")
}
```

### 2. **The Three-Valued Logic Handler**
Boolean operations need special handling:
```typescript
function toBoolean(collection: Collection): boolean | undefined {
  if (collection.length === 0) return undefined
  const values = collection.filter(v => typeof v === 'boolean')
  if (values.some(v => v === true)) return true
  if (values.some(v => v === false)) return false
  return undefined
}
```

### 3. **The Type Filter**
Polymorphic navigation requires runtime type filtering:
```typescript
function ofType(collection: Collection, type: string): Collection {
  return collection.filter(item => matchesType(item, type))
}
```

### 4. **The Environment Propagator**
Environment variables (`%context`) must flow through evaluation:
```typescript
interface Environment {
  variables: Map<string, Value>
  rootResource: Value
  typeResolver?: TypeResolver
}
```

## Memory and Performance Considerations

### 1. **Lazy Evaluation Opportunities**
- Chain transformations without materializing intermediate results
- Use iterators/generators for large collections
- Defer computation until terminal operations (`count()`, `first()`)

### 2. **Memoization Points**
- Cache type resolution results
- Memoize property access patterns
- Cache parsed expressions for repeated evaluations

### 3. **Collection Sharing**
- Share immutable collections when possible
- Use structural sharing for collection operations
- Avoid copying when filtering/subsetting

## Parser Implementation Strategy

### 1. **Recursive Descent** (Recommended)
- Natural match for FHIRPath's grammar
- Easy to implement and debug
- Good error reporting
- Straightforward precedence handling

### 2. **Parser Generator**
- Use the provided ANTLR grammar
- Less code to maintain
- May have worse error messages
- Good for quick prototypes

## Function Implementation Architecture

Functions are just expression nodes with special evaluation rules:

```typescript
class FunctionCall implements Expression {
  evaluate(context: Collection, env: Environment): Collection {
    // Special handling for functions that need the expression
    if (this.name === 'where' || this.name === 'select') {
      return this.evaluateWithExpression(context, env)
    }
    
    // Standard function evaluation
    const args = this.args.map(arg => arg.evaluate(context, env))
    return this.function.apply(context, args)
  }
}
```

## Error Handling Philosophy

FHIRPath favors **graceful degradation** over exceptions:

1. **Type mismatches** → Empty collections
2. **Missing properties** → Empty collections
3. **Invalid operations** → Empty collections (or propagate undefined)
4. **Only throw for**: Syntax errors, wrong function arity, internal errors

This creates a robust system where partial data doesn't break queries.

## Testing Strategy

### 1. **Conformance Test Suite**
- Use the official test cases (tests.xml)
- These cover edge cases and specification compliance
- Run these as integration tests

### 2. **Property-Based Testing**
- Test invariants: `expr.evaluate(empty) === empty`
- Test composition: `a.b.c === a.evaluate().b.c`
- Test type safety: Type errors produce empty, not exceptions

### 3. **Performance Benchmarks**
- Large collections (1000+ items)
- Deep nesting (10+ levels)
- Complex expressions (multiple joins/filters)

## Implementation Gotchas

### 1. **The Empty vs False Distinction**
- Empty is NOT false in boolean contexts
- `empty or true` returns `true`, not empty
- Implement three-valued logic carefully

### 2. **Collection Identity**
- `=` compares values, not collection identity
- `{1, 2} = {2, 1}` is false (order matters)
- Implement value equality deeply

### 3. **Type Name Resolution**
- Types can be qualified: `FHIR.Patient`
- Unqualified names search context model first
- Implement proper namespace resolution

### 4. **Quantity Comparison**
- Requires unit conversion knowledge
- Consider UCUM library integration
- Handle incompatible units gracefully

## Optimization Opportunities

### 1. **Expression Compilation**
- Compile to bytecode or native code
- Eliminate interpretation overhead
- Inline common operations

### 2. **Path Analysis**
- Detect simple property paths
- Optimize to direct property access
- Avoid full expression evaluation

### 3. **Collection Pooling**
- Reuse collection objects
- Reduce allocation pressure
- Important for high-throughput scenarios

## Minimum Viable Implementation

Start with these core features:

1. **Basic path navigation** (`.` operator)
2. **Collection operations** (`where()`, `select()`, `first()`)
3. **Boolean logic** (`and`, `or`, `not`)
4. **Existence functions** (`exists()`, `empty()`)
5. **Type filtering** (`ofType()`)

This subset handles 80% of real-world use cases and provides a solid foundation for expansion.

## Summary: The Implementation Zen

- **Think in collections**: Every operation transforms collections
- **Embrace empty**: It's not an error, it's absence
- **Flatten aggressively**: Nested collections become flat
- **Fail gracefully**: Errors produce empty, not exceptions
- **Optimize lazily**: Get correct first, then optimize

A good FHIRPath implementation feels like a functional stream processor with healthcare domain knowledge, not a traditional query engine.