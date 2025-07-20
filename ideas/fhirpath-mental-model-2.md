# FHIRPath as Processing Nodes: A Stream-Based Mental Model

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

### Execution Trace

```
1. Root dot.evaluate([Bundle], context)
   2. → Left dot.evaluate([Bundle], context)
      3. → Patient.evaluate([Bundle], context)
      4. ← Returns [Patient1, Patient2]
      5. → name.evaluate([Patient1, Patient2], context)
      6. ← Returns [Name1, Name2, Name3]
   7. ← Left dot returns [Name1, Name2, Name3]
   8. → given.evaluate([Name1, Name2, Name3], context)
   9. ← Returns ['John', 'Jane', 'Bob']
10. ← Root dot returns ['John', 'Jane', 'Bob']
```

## The Complete Node Taxonomy

### 1. The Dot Operator - Pipeline Builder

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
Context In: {%var: 'value', env: {...}}

Evaluation:
1. Left (Patient) with original input/context → [Patient1, Patient2]
2. Right (name) with LEFT's output as input → [Name1, Name2, Name3]
3. Return right's output and context

Output: [Name1, Name2, Name3]
Context Out: {%var: 'value', env: {...}}  // from right node
```

**Key**: The dot feeds left's output as right's input, creating data pipelines (→).

### 2. Simple Value Nodes

#### Identifier Nodes - Navigation
```
Node: name
Input: [Patient1, Patient2]
Output: [Name1, Name2, Name3]  // extracted 'name' fields
Context: unchanged
```

#### Variable Nodes - Context Readers
```
Node: %varName
Input: ignored
Context: {%varName: ['a', 'b'], ...}
Output: ['a', 'b']  // value from context
Context: unchanged
```

#### Literal Nodes - Constants
```
Node: 'official'
Input: ignored
Output: ['official']
Context: unchanged
```

### 3. Operators - Parallel Evaluation

Unlike dots, operators evaluate arguments in parallel:

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

**Key Difference**:
- **Dot**: Sequential (→) - right uses left's output
- **Operators**: Parallel (||) - both use same input

### 4. Functions - Evaluation Orchestrators

Functions control how their arguments are evaluated:

#### Iterator Functions (`where`, `select`)
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

## Quick Reference: Context Behavior

| Node Type | Context Behavior |
|-----------|-----------------|
| **Dot** | Threads through left → right |
| **Operators** | Pass through unchanged |
| **Iterators** | Temporary $this/$index, restore original |
| **Conditionals** | Return from evaluated branch |
| **Simple** | Pass through unchanged |
| **Modifiers** | Permanently modify |

## The Complete Picture

```
┌─────────────────────────────────────────────────────┐
│                 FHIRPath Expression                  │
├─────────────────────────────────────────────────────┤
│  Dot Nodes: Sequential pipelines (→)                │
│  Operators: Parallel evaluation (||)                 │
│  Functions: Controlled evaluation (↻)                │
│  Variables: Context readers (←ctx)                   │
│  Literals: Constants                                 │
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

## Real-World Example

Let's see how this works in practice:

```fhirpath
// Find all patients with recent high blood pressure readings
Observation
  .where(code.coding.exists(system = 'http://loinc.org' and code = '85354-9'))
  .where(effectiveDateTime > today() - 30 'days')
  .where(valueQuantity.value > 140)
  .subject.resolve()
```

Breaking it down:
1. Start with all Observations (collection)
2. Filter by code (each `where` creates iterator context)
3. Filter by date (context preserved between wheres)
4. Filter by value (can access any upstream variables)
5. Navigate to subject and resolve references

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

## Why This Model Matters

Understanding FHIRPath as stream processing reveals:

1. **Why everything is a collection** - Uniform processing interface
2. **How variables work** - Context stream flows parallel to data
3. **Why functions take expressions** - To control evaluation context
4. **How complex expressions compose** - Simple nodes connected by dots

The elegance of FHIRPath isn't in any single feature—it's in how a simple, uniform processing model creates a powerful query language.

## Next Steps

Now that you understand the model:

1. **Debug expressions** by tracing data and context flow
2. **Build complex queries** by composing simple nodes
3. **Optimize performance** by understanding evaluation order
4. **Learn more**:
   - [FHIRPath Specification](http://hl7.org/fhirpath/)
   - [FHIRPath Playground](https://hl7.github.io/fhirpath.js/)
   - Practice with real FHIR resources

Remember: Every FHIRPath expression is just processing nodes transforming streams of data. Master the nodes, master the language.