# FHIRPath as Processing Nodes: A Complete Stream-Based Mental Model

## The Mystery of FHIRPath

Consider this FHIRPath expression:

```fhirpath
Patient.name.where(use = 'official').given
```

What's really happening here? How does data flow through this expression? Why does FHIRPath work the way it does?

The answer lies in understanding FHIRPath's elegant design: **every part of an expression is a processing node that transforms streams of data while managing a parallel stream of context**.

## The Core Insight: Everything is a Processing Node

FHIRPath becomes intuitive when you realize that every component—identifiers, operators, functions, literals—shares the same interface:

```
           arguments (other nodes)
                 │
                 ▼
           ┌─────────────────┐
input   ──►│   Processing    │──► output
context ──►│      Node       │──► new context
           └─────────────────┘
```

- **Input**: Always a collection (even single values are collections of one)
- **Context**: Variables, services, and environment data
- **Arguments**: Other nodes that provide processing logic
- **Output**: The resulting collection
- **New Context**: Potentially modified context

This uniform interface is the key to FHIRPath's power—complex expressions are just simple nodes connected together.

## Understanding Collections: The Foundation

Before diving into nodes, it's crucial to understand that FHIRPath operates exclusively on collections with specific properties:

### Collection Properties
- **Ordered**: Element order is preserved through all operations
- **Non-Unique**: Duplicates are allowed and maintained
- **Indexed**: 0-based indexing (unless the model specifies otherwise)
- **Typed**: Each element has a type from the type system

### The Empty Collection
The empty collection `{ }` is special—it represents:
- Missing values (null)
- No results from navigation
- Unknown values in three-valued logic
- Failed type conversions

## The Navigation Model: Trees and Graphs

FHIRPath views data as a directed acyclic graph:

```
        Patient
        ├── id: "123"
        ├── name[0]
        │   ├── use: "official"
        │   ├── given[0]: "John"
        │   └── family: "Doe"
        └── name[1]
            ├── use: "nickname"
            └── given[0]: "Johnny"
```

Key properties:
- Nodes can have primitive values AND children
- Labels are non-unique (e.g., multiple `name` elements)
- Navigation always returns collections

## A Complete Example: `Patient.name.given`

Let's trace how this simple navigation works to understand the model.

### The Expression Tree

```
                    ┌─────┐
                    │  .  │ (root)
                    └──┬──┘
                       │
            ┌──────────┴──────────┐
            │                     │
         ┌──┴──┐              ┌───┴───┐
         │  .  │              │ given │
         └──┬──┘              └───────┘
            │
     ┌──────┴──────┐
     │             │
 ┌───┴────┐    ┌───┴──┐
 │Patient │    │ name │
 └────────┘    └──────┘
```

### Two-Phase Evaluation

FHIRPath evaluation happens in two distinct phases:

#### Phase 1: Control Flow (Top-Down)
Parent nodes orchestrate when and how their children evaluate:

```
                    ┌─────┐
                    │  .  │ "I need to evaluate"
                    └──┬──┘
                       │
                ┌──────┴──────┐
                ▼             ▼
         "Evaluate first" "Wait for left"
            ┌─────┐         ┌───────┐
            │  .  │         │ given │
            └──┬──┘         └───────┘
               │
         ┌─────┴─────┐
         ▼           ▼
    "Evaluate"   "Wait"
    ┌────────┐   ┌──────┐
    │Patient │   │ name │
    └────────┘   └──────┘
```

#### Phase 2: Data Flow (Bottom-Up)
Results bubble up from children to parents:

```
                    ┌─────┐
                    │  .  │ ◄─── ['John', 'Jane', 'Bob']
                    └──┬──┘
                       │
                ┌──────┴──────────────┐
                │                     │
         ┌──────┴──┐              ┌───┴───┐
         │   .     │ ◄── [Names]  │ given │ ◄── ['John','Jane','Bob']
         └──┬──────┘              └───────┘
            │
     ┌──────┴──────────────┐
     │                     │
 ┌───┴────┐            ┌───┴──┐
 │Patient │ ◄─[Pts]    │ name │ ◄── [Names]
 └────────┘            └──────┘
```

## The Complete Node Taxonomy

### 1. The Dot Operator - Pipeline Builder (Precedence #1)

The dot is special—it creates sequential pipelines:

```
Expression: Patient.name

          ┌─────┐
          │  .  │
          └──┬──┘
              │
      ┌───────┴───────┐
      │               │
  ┌───┴────┐    ┌─────┴──┐
  │Patient │    │  name  │
  └────────┘    └────────┘

Input: [Bundle]
Context In: {%context: Bundle, %resource: Bundle, env: {...}}

Evaluation:
1. Left (Patient) with original input/context → [Patient1, Patient2]
2. Right (name) with LEFT's output as input → [Name1, Name2, Name3]
3. Return right's output and context

Output: [Name1, Name2, Name3]
Context Out: {%context: Bundle, %resource: Bundle, env: {...}}
```

**Key**: The dot feeds left's output as right's input, creating data pipelines (→).

### 2. Simple Value Nodes

#### Identifier Nodes - Navigation
```
Node: name
Input: [Patient1, Patient2]
Processing: For each input, extract 'name' field(s)
Output: [Name1, Name2, Name3]  // flattened collection
Context: unchanged
```

#### Variable Nodes - Context Readers
```
Node: %varName
Input: ignored
Context: {%varName: ['a', 'b'], ...}
Output: ['a', 'b']  // value from context
Context: unchanged

Special variables:
- %context: Original input to expression
- %resource: Current resource being processed
- %rootResource: Top-level resource
- %ucum: Unit conversion service (if available)
```

#### Literal Nodes - Constants
```
Node: 'official'
Input: ignored
Output: ['official']
Context: unchanged

Node: 42
Output: [42]
Type: System.Integer
```

### 3. Operators - Parallel Evaluation

Unlike dots, operators evaluate arguments in parallel:

#### Operator Precedence (13 levels)
```
#01: . (navigation)
#02: [] (indexing)
#03: unary + and -
#04: *, /, div, mod
#05: +, -, & (concatenation)
#06: is, as (type operations)
#07: | (union)
#08: >, <, >=, <=
#09: =, ~, !=, !~
#10: in, contains
#11: and
#12: xor, or
#13: implies
```

#### Example: Equality Operator
```
Expression: use = 'official'

          ┌───────┐
          │   =   │
          └───┬───┘
              │
      ┌───────┴───────┐
      │               │ (parallel evaluation)
  ┌───┴──┐      ┌─────┴──────┐
  │ use  │      │ 'official' │
  └──────┘      └────────────┘

Both sides get SAME input and context!
```

#### Three-Valued Logic
Boolean operators handle empty collections as "unknown":
```
true and { } → { }    // unknown
false and { } → false  // definite false
{ } or { } → { }      // unknown
not({ }) → { }        // unknown
```

### 4. Functions - Evaluation Orchestrators

Functions control how their arguments are evaluated:

#### Iterator Functions (`where`, `select`, `exists`, `all`)
```
where(use = 'official')

Input: [Name1, Name2, Name3]
Context In: {%var: 'value', env: {...}}

For each item:
  - Controlled input: [Name1]
  - Controlled context: {%var: 'value', $this: Name1, $index: 0, env: {...}}
  - Evaluate: use = 'official' → [true/false]

Output: [Name1, Name3]  // filtered
Context Out: {%var: 'value', env: {...}}  // restored - no $this
```

#### The `aggregate` Pattern
```
value.aggregate($this + $total, 0)

Iterates with special $total accumulator:
- First iteration: $total = 0 (initial value)
- Each iteration: $total = previous result
- Final output: last $total value
```

#### Conditional Functions (`iif`)
```
iif(count() > 2, defineVariable('size', 'many'), defineVariable('size', 'few'))

Evaluates condition first, then ONLY the needed branch.
Context flows from whichever branch executes!
```

#### Simple Functions (`substring`, `first`)
```
substring(length() - 3)  // expression argument evaluated once

Input: ['Hello']
1. Evaluate argument: length() - 3 → [2]
2. Apply function: substring from position 2
Output: ['llo']
Context: unchanged
```

#### Context Modifiers (`defineVariable`)
```
defineVariable('names', name)

Evaluates expression and adds result to context permanently.
Context Out: {...existing, %names: [Name1, Name2, Name3]}
```

## Type System and Polymorphism

### Type Hierarchy
```
System.Any
├── System.Primitive
│   ├── System.Boolean
│   ├── System.String
│   ├── System.Integer
│   ├── System.Decimal
│   └── System.DateTime
└── FHIR.Element
    └── FHIR.Patient
```

### Type Operations
```
// Runtime type checking
Patient.is(FHIR.Patient) → true
Patient.is(FHIR.Observation) → false

// Safe casting
resource.as(Patient)  // returns Patient or empty

// Type filtering
Bundle.entry.resource.ofType(Patient)  // only Patients
```

### Type Information
```
'hello'.type() → SimpleTypeInfo { namespace: 'System', name: 'String' }
Patient.name.type() → ListTypeInfo { elementType: 'FHIR.HumanName' }
```

## Singleton Evaluation Rules

When a single value is expected but you have a collection:

```
1. Collection with one item convertible to expected type → use it
2. Collection with one item, expecting Boolean → true
3. Empty collection → empty (propagates)
4. Multiple items → ERROR
```

Example:
```
Patient.active              // [true] → true (singleton conversion)
Patient.name.given.first()  // ['John'] → 'John'
Patient.where(false).active // { } → { } (empty propagates)
```

## Edge Cases and Special Behaviors

### Date/Time Precision
```
@2023-01 = @2023-01-15  // → { } (unknown due to precision)
@2023-01 ~ @2023-01-15  // → true (equivalent at month precision)
```

### Quantity Operations
```
5 'mg' + 10 'mg' → 15 'mg'
1 'm' + 100 'cm' → 2 'm'     // unit conversion
5 'mg' + 10 'mL' → ERROR     // incompatible dimensions
```

### String Operations
```
'hello' + ' ' + 'world' → 'helloworld'  // no space preservation
'Hello' ~ 'hello' → true                 // case-insensitive equivalence
```

### Collection Combining
```
combine(a, b)  // preserves duplicates
union(a, b)    // removes duplicates (using = operator)
```

## Quick Reference: Context Behavior

| Node Type | Context Behavior | Special Variables |
|-----------|------------------|-------------------|
| **Dot** | Threads through left → right | None |
| **Operators** | Pass through unchanged | None |
| **Iterators** | Temporary $this/$index, restore original | $this, $index |
| **Aggregate** | Temporary $total, restore original | $this, $total |
| **Conditionals** | Return from evaluated branch | None |
| **Simple** | Pass through unchanged | None |
| **Modifiers** | Permanently modify | None |

## The Complete Picture

```
┌─────────────────────────────────────────────────────┐
│                 FHIRPath Expression                  │
├─────────────────────────────────────────────────────┤
│  Collections: Ordered, non-unique, typed            │
│  Navigation: Tree traversal returning collections    │
│  Dot Nodes: Sequential pipelines (→)                │
│  Operators: Parallel evaluation (||)                 │
│  Functions: Controlled evaluation (↻)                │
│  Variables: Context readers (←ctx)                   │
│  Types: Runtime introspection and safe casting      │
│  Logic: Three-valued with empty as unknown          │
│                                                      │
│  All share: input/context → output/new context      │
└─────────────────────────────────────────────────────┘
```

## Context: The Hidden Stream

Context flows parallel to data, carrying variables downstream:

```fhirpath
Patient
  .defineVariable('allNames', name)      // Adds %allNames to context
  .name                                   // Has access to %allNames
  .where(use = 'official')               // Still has %allNames
  .select(given | family)                // Still has %allNames!
```

This enables powerful patterns:
```fhirpath
defineVariable('total', count())
  .where(price > 100)
  .select($this.price / %total)  // Uses variable defined earlier
```

## Real-World Example: Clinical Query

Let's see how this works in practice:

```fhirpath
// Find all patients with recent high blood pressure readings
Observation
  .where(code.coding.exists(system = 'http://loinc.org' and code = '85354-9'))
  .where(effectiveDateTime > today() - 30 'days')
  .where(valueQuantity.value > 140 and valueQuantity.unit = 'mm[Hg]')
  .defineVariable('highBP', $this)
  .subject.resolve()
  .distinct()
```

Breaking it down:
1. Start with all Observations (collection)
2. Filter by LOINC code for blood pressure
3. Filter by date with quantity arithmetic
4. Filter by value with unit checking
5. Store matching observations in context
6. Navigate to subjects and resolve references
7. Remove duplicate patients

## Common Pitfalls and Solutions

### 1. Forgetting Everything is a Collection
```fhirpath
// Wrong: Assuming single value
Patient.name.given + ' ' + Patient.name.family

// Right: Handle collections
Patient.name.select(given.first() + ' ' + family)
```

### 2. Context Modification Confusion
```fhirpath
// $this is temporary:
name.where(use = 'official')  // $this exists inside where
.given                         // $this is gone here

// %variables are permanent:
defineVariable('official', name.where(use = 'official'))
.name                         // %official still accessible
```

### 3. Expression vs Value Arguments
```fhirpath
// Expression argument - evaluated with context:
substring(length() - 3)

// Value argument - just a number:
substring(2, 3)
```

### 4. Type Safety
```fhirpath
// Runtime error - types don't match:
Patient.birthDate + 5  // Date + Integer = ERROR

// Safe with conversion:
Patient.birthDate + 5 'days'  // Date + Quantity<time> = Date
```

### 5. Three-Valued Logic Surprises
```fhirpath
// Empty doesn't equal anything:
Patient.deceased = { }  // → { } (not false!)

// Use exists() for presence checking:
Patient.deceased.exists()  // → true/false (never empty)
```

## Advanced Patterns

### Custom Aggregations
```fhirpath
// Find minimum value
value.aggregate(
  iif($total.empty(), $this, 
    iif($this < $total, $this, $total)
  )
)
```

### Tree Traversal
```fhirpath
// Find all nested items in questionnaire
Questionnaire.repeat(item)  // Recursively find 'item' children
```

### Type-Safe Navigation
```fhirpath
// Only process if correct type
Bundle.entry.resource
  .where($this.is(Patient))
  .as(Patient)
  .name
```

## Implementation Notes

### Flexibility Points
- **Type Checking**: Can be compile-time or runtime
- **Evaluation Strategy**: Lazy or eager evaluation allowed
- **Error Handling**: Can fail fast or propagate empty
- **Optimization**: Implementations can optimize as long as semantics preserved

### Required Behaviors
- Collection ordering must be preserved
- Empty collection semantics must be maintained
- Type conversions must follow specification
- Three-valued logic must be implemented correctly

## Why This Model Matters

Understanding FHIRPath as stream processing reveals:

1. **Why everything is a collection** - Uniform processing interface
2. **How variables work** - Context stream flows parallel to data
3. **Why functions take expressions** - To control evaluation context
4. **How complex expressions compose** - Simple nodes connected by dots
5. **Why empty collections are special** - Represent unknown/missing values
6. **How type safety works** - Runtime introspection with safe operations

The elegance of FHIRPath isn't in any single feature—it's in how a simple, uniform processing model creates a powerful, type-safe query language for hierarchical healthcare data.

## Next Steps

Now that you understand the complete model:

1. **Debug expressions** by tracing data and context flow
2. **Build complex queries** by composing simple nodes
3. **Optimize performance** by understanding evaluation order
4. **Handle edge cases** using three-valued logic and type operations
5. **Learn more**:
   - [FHIRPath Specification](http://hl7.org/fhirpath/)
   - [FHIRPath Playground](https://hl7.github.io/fhirpath.js/)
   - [Type System Documentation](http://hl7.org/fhirpath/#types)
   - Practice with real FHIR resources

Remember: Every FHIRPath expression is just processing nodes transforming streams of data. Master the nodes, master the language.