# FHIRPath as Processing Nodes: A Stream-Based Mental Model

FHIRPath becomes intuitive when viewed through one core concept: **processing nodes**. Every part of a FHIRPath expression is a node that transforms inputs into outputs while managing context.

## The Processing Node Model

Every FHIRPath component shares this interface:

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

## Two-Phase Evaluation

FHIRPath evaluation has two distinct phases:

### Phase 1: Control Flow (Top-Down)
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

### Phase 2: Data Flow (Bottom-Up)
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

## Example: `Patient.name.given`

Let's trace the complete flow:

### Expression Tree
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

## Node Types

### 1. The Dot Operator - Pipeline Builder
```typescript
class DotNode {
  evaluate(input, context) {
    const [leftOutput, leftContext] = this.left.evaluate(input, context);
    const [rightOutput, rightContext] = this.right.evaluate(leftOutput, leftContext);
    return [rightOutput, rightContext];
  }
}
```
The dot connects nodes by feeding left's output as right's input.

### 2. Identifier Nodes - Navigation
```
Node: name
Input: [Patient1, Patient2]
Output: [Name1, Name2, Name3]  // extracted 'name' fields
Context: unchanged
```

### 3. Variable Nodes - Context Readers
```
Node: %varName
Input: ignored
Context: {%varName: ['a', 'b'], ...}
Output: ['a', 'b']  // value from context
Context: unchanged
```

### 4. Literal Nodes - Constants
```
Node: 'official'
Input: ignored
Output: ['official']
Context: unchanged
```

### 5. Operator Nodes - Parallel Evaluation

Unlike the dot operator, most operators evaluate their arguments in parallel with the same input/context:

#### Equality Operator (`=`)
```
Expression: use = 'official'

          ┌───────┐
          │   =   │
          └───┬───┘
              │
      ┌───────┴───────┐
      │               │
  ┌───┴──┐      ┌─────┴──────┐
  │ use  │      │ 'official' │
  └──────┘      └────────────┘

Evaluation:
1. Both children get SAME input and context
2. Left (use) evaluates: [Name1, Name2] → ['official', 'nickname']
3. Right ('official') evaluates: [Name1, Name2] → ['official']
4. Operator compares results → [true]
```

#### Union Operator (`|`)
```
Expression: given | family

          ┌───────┐
          │   |   │
          └───┬───┘
              │
      ┌───────┴───────┐
      │               │
  ┌───┴───┐     ┌─────┴──┐
  │ given │     │ family │
  └───────┘     └────────┘

Evaluation:
1. Both children get SAME input: [Name1]
2. Left (given) → ['John', 'J.']
3. Right (family) → ['Doe']
4. Operator combines → ['John', 'J.', 'Doe']
```

#### Key Difference from Dot
- **Dot**: Sequential - right uses left's output
- **Other operators**: Parallel - both sides use same input
- **Context**: Passed through unchanged (except for special cases)

### 6. Function Nodes - Orchestrators

Functions have different evaluation patterns based on their purpose:

#### Iterator Functions (`where`, `select`, `all`, `exists`)
These evaluate their expression arguments multiple times, once per input item:

```
where(use = 'official')

Input: [Name1, Name2, Name3]
Context In: {%var: 'value', env: {...}}
For each item:
  - Controlled input: [Name1]
  - Controlled context: {%var: 'value', $this: Name1, $index: 0, env: {...}}
  - Evaluate: use = 'official' → [true/false]
  - Filter based on result
Output: [Name1, Name3]  // items where condition was true
Context Out: {%var: 'value', env: {...}}  // UNCHANGED - $this removed
```

```
select(given | family)

Input: [Name1, Name2]
Context In: {%var: 'value', env: {...}}
For each item:
  - Controlled input: [Name1]
  - Controlled context: {%var: 'value', $this: Name1, env: {...}}
  - Evaluate: given | family → ['John', 'Doe']
  - Collect results
Output: ['John', 'Doe', 'Jane', 'Smith']  // flattened
Context Out: {%var: 'value', env: {...}}  // UNCHANGED - $this removed
```

**Context behavior**: Iterators temporarily add $this/$index for their arguments but restore original context for output.

#### Conditional Functions (`iif`)
These evaluate different arguments based on conditions:

```
iif(count() > 2, defineVariable('size', 'many'), defineVariable('size', 'few'))

          ┌───────┐
          │  iif  │
          └───┬───┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───┴────┐ ┌──┴───────────┐ ┌──┴──────────┐
│count()>2│ │defineVariable│ │defineVariable│
└────────┘ │('size','many')│ │('size','few')│
           └──────────────┘ └─────────────┘

Input: [Item1, Item2, Item3]
Context In: {%var: 'value', env: {...}}
Evaluation:
1. Evaluate condition with input/context → [true]
2. Since true, evaluate second argument:
   - defineVariable adds %size = 'many' to context
   - Returns ['many'] with modified context
3. Third argument is NOT evaluated
Output: ['many']
Context Out: {%var: 'value', %size: 'many', env: {...}}  // FROM CHOSEN BRANCH!
```

**Context behavior**: Conditionals return the context from whichever branch they evaluate. Key: `iif` only evaluates the branch it needs!

#### Simple Functions (`substring`, `contains`, `first`, `skip`)
These process their input directly. When they have expression arguments, they evaluate them with original input/context:

```
substring(length() - 3)  // expression argument!

Input: ['Hello']
Context In: {%var: 'value', env: {...}}
Evaluation:
1. Evaluate argument with original input/context:
   - length() with ['Hello'] → [5]
   - 5 - 3 → [2]
2. Apply function: substring starting at position 2
Output: ['llo']
Context Out: {%var: 'value', env: {...}}  // UNCHANGED
```

```
skip(count() div 2)  // expression argument!

Input: [A, B, C, D, E, F]
Context In: {%var: 'value', env: {...}}
Evaluation:
1. Evaluate argument with original input/context:
   - count() → [6]
   - 6 div 2 → [3]
2. Apply function: skip first 3 items
Output: [D, E, F]
Context Out: {%var: 'value', env: {...}}  // UNCHANGED
```

```
first()  // no arguments

Input: [Name1, Name2, Name3]
Context In: {%var: 'value', env: {...}}
Processing: Take first item
Output: [Name1]
Context Out: {%var: 'value', env: {...}}  // UNCHANGED
```

**Context behavior**: Simple functions pass context through unchanged. When they have expression arguments, those are evaluated with the original input/context (not item-by-item like iterators).

#### Context Modifiers (`defineVariable`)
```
defineVariable('names', name)

Input: [Patient1, Patient2]
Context In: {%existing: 'data', env: {...}}
Evaluation:
- Evaluate 'name' expression once with full input
- Store result in context: %names = [Name1, Name2, Name3]
Output: [Patient1, Patient2]  // input passed through
Context Out: {%existing: 'data', %names: [...], env: {...}}  // MODIFIED - added %names
```

**Context behavior**: Context modifiers permanently add new variables that flow downstream to all subsequent nodes.

#### Function Categories Summary

1. **Iterators**: Temporarily modify context (add $this/$index), restore original for output
2. **Conditionals**: Return context from the branch they evaluate (can be modified!)
3. **Simple**: Pass context through unchanged
4. **Context Modifiers**: Permanently modify context by adding variables

The key distinction: Functions with expression arguments control evaluation, while functions with value arguments just transform data.

## Context Flow: The Hidden Stream

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

## Key Insights

1. **Uniform Interface**: Every expression component is a processing node
2. **Two-Phase Evaluation**: Control flows down, data flows up
3. **Dot as Connector**: The dot operator creates pipelines by connecting outputs to inputs
4. **Context Threading**: Variables flow downstream through context
5. **Function Control**: Functions orchestrate how their arguments evaluate

## Why This Model Matters

Understanding FHIRPath as processing nodes reveals:
- Why everything is a collection (uniform processing)
- How variables work (context flow)
- Why functions take expressions not values (control over evaluation)
- How complex expressions compose (node connection via dots)

The elegance isn't in any single feature—it's in how simple processing nodes compose into powerful expressions through a uniform interface and clear data flow patterns.