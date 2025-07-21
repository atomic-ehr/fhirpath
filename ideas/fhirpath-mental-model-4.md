# FHIRPath: A Node-Based Processing Model

## Introduction

FHIRPath is a path-based navigation and extraction language designed for FHIR resources. 
At first glance, expressions like `Patient.name.where(use = 'official').given` might seem like simple property access, 
but understanding how FHIRPath works may be quite tricky without proper mental model.
Here are few latest discussions on FHIR zulip chat demonstrating the hidden complexity of the language:
* [What should it do](https://chat.fhir.org/#narrow/channel/179266-fhirpath/topic/what.20should.20it.20do.3F/with/529563311) 
* [Can we chain iif from left side](https://chat.fhir.org/#narrow/channel/179266-fhirpath/topic/Can.20we.20chain.20iif.20from.20left.20side.3F/with/529625685)

This guide will help you build an accurate mental model of how FHIRPath works by introducing "stream processing" model and walk 
through the language by examples.


## The Core Mental Model: Everything is a Processing Node

We can represent FHIRPath expression as a tree of nodes.
The key insight that makes FHIRPath intuitive is this: 
**every part of a FHIRPath expression is a processing node with the same interface**.

```javascript
node(context, input, args) -> { output, context }
```

Context is a set of variables and services, which are available to the nodes.
Some nodes may set variables in context, which will be available to the next nodes.
Context may flow from node to node by `.` operator.


### The Universal Node Interface

```
                 arguments (other nodes)
                        │
                        ▼
                 ┌─────────────────┐
input         ──►│                 │──► output
(collection)     │   Processing    │    (collection)
                 │      Node       │
context       ──►│                 │──► context
(variables)      └─────────────────┘    (possibly modified)
```

Every node:
- **Receives** a collection as input (even single values are collections of one)
- **Receives** a context containing variables and environment
- **Has arguments** which are themselves nodes
- **Orchestrates** how and when its argument nodes are evaluated
- **Processes** the results according to its logic
- **Produces** a collection as output
- **Produces** a context (usually unchanged, but some nodes modify it)

### Node Evaluation Control

A critical insight: **nodes control their arguments' evaluation**:

1. **Simple nodes** (literals, identifiers): No arguments to control
2. **Operator nodes**: Evaluate all arguments with same input/context
3. **Function nodes**: Can control:
   - **Whether** to evaluate arguments (iif only evaluates one branch)
   - **How many times** to evaluate (where evaluates once per item)
   - **With what context** (where adds $this, select adds $this)
   - **In what order** (most evaluate left-to-right)

### How Nodes Connect

FHIRPath expressions are trees of connected nodes. **Data** (input) and **context** flow through these nodes:

```
Expression: Patient.name.given

Tree structure:
                    ┌─────┐
                    │  .  │ (dot node - root)
                    └──┬──┘
                       │
                ┌──────┴──────────┐
                │                 │
            ┌───┴──┐          ┌───┴───┐
            │  .   │          │ given │
            └───┬──┘          └───────┘
                │
        ┌───────┴────────┐
        │                │
    ┌───┴────┐      ┌───┴──┐
    │Patient │      │ name │
    └────────┘      └──────┘

Evaluation flow:
1. Patient (identifier) - extracts Patient from input
2. . (dot) - pipes Patient's output to name
3. name (identifier) - extracts name field(s)
4. . (dot) - pipes name's output to given
5. given (identifier) - extracts given field(s)
```

### Context Propagation Patterns

Understanding how context flows is crucial:

1. **Pass-through nodes** (most common): Input context = output context
   - Simple navigation: `name`, `given`
   - Simple functions: `first()`, `count()`
   - Operators: `+`, `=`, `and`

2. **Temporary context nodes**: Add variables during processing, then restore
   - `where()`: adds `$this` for each item
   - `select()`: adds `$this` for each item
   - Context is restored after processing

3. **Context-modifying nodes**: Permanently change context
   - `defineVariable()`: adds a new variable
   - Modified context flows to all subsequent nodes

Notes: In real implementation, context is more probably cloned and modified.
TODO: elaborate on context visibility. For example, `defineVariable()` should ot leak `select()` context.

## Data flow as collections 

Before we dive into specific nodes, understand that **input** (data) are  always a collection:

Collections can be:
- **Can be empty**: `{ }` represents no value/unknown
- **Ordered**: `[1, 2, 3]` is different from `[3, 2, 1]`
- **Non-unique**: `[1, 1, 2]` is valid
- **Singleton**: `[1]` is a collection of one element
- **Typed**: Each element has a type
- **Mixed**: Each element may have different type (`children()` returns mixed collection)

### The Empty Collection

The empty collection `{ }` is special:
- Represents missing or unknown values
- Propagates through most operations, unless the function/operation indicates that an exception should be thrown with no input (not too many of these).
- Acts as "unknown" in three-valued logic

## Meet Our Patient: Sarah Smith

Throughout this guide, we'll use this Patient resource:

```json
{
  "resourceType": "Patient",
  "id": "sarah-smith",
  "active": true,
  "name": [
    {
      "use": "official",
      "family": "Smith",
      "given": ["Sarah", "Jane"]
    },
    {
      "use": "nickname",
      "given": ["SJ"]
    }
  ],
  "gender": "female",
  "birthDate": "1985-08-15",
  "address": [
    {
      "use": "home",
      "city": "Boston",
      "state": "MA",
      "postalCode": "02101"
    }
  ]
}
```

We'll explore how different nodes process this data step by step.

## Input & Context are Starting Point

### What is Input?

Input is a collection of items, which are being processed.

### What is Context?

Context is the environment in which expressions evaluate. It contains:
- **Variables**: Named values available during evaluation
- **Special variables**: `$this`, `$index`, `$total`
- **Standard FHIR variables**: `%context`, `%resource`
- **Environment**: External data like terminology servers

External variables are used in FHIR SDC in questionnaire calculations
or another good example is %previous in FHIR Subscription processing.

The same expression can have different meanings depending on input and context.

- **`$this`**: At the beginning set to input, can be modified by some function nodes (select, where, etc)
- **`%context`**: The original input to the FHIRPath expression
- **`%resource`**: The resource containing the current focus (may change during evaluation when crossing resource boundaries such as domainresource.contained, or bundle.entry.resource)
- **`%rootResource`**: The root resource (for nested resources)

TODO: more on %context

#### Starting with a Patient resource:

```
Expression: name.given
Input: [Patient(Sarah Smith)]
Initial Context: {
  %context: [Patient(Sarah Smith)],
  %resource: [Patient(Sarah Smith)],
  %rootResource: [Patient(Sarah Smith)]
  $this: [Patient(Sarah Smith)]
}
Output: ['Sarah', 'Jane', 'SJ']
```

### The Ambiguity of `Patient`

When you see `Patient` in FHIRPath, it's ambiguous - the same syntax can mean different things depending on input.

```fhirpath
Patient.name  // What does "Patient" mean here?
```

This could be:
1. **Field navigation** - looking for a field named "Patient"
2. **Type filter** - filtering to only Patient resources

The interpretation depends on:
- Your input data structure
- The data model being used

Examples of the ambiguity:
```fhirpath
// Scenario 1: Input has a Patient field
// Input: {Patient: {name: [{given: ["John"]}]}}
Patient.name  → [{given: ["John"]}]  // Field navigation

// Scenario 2: Different resource type
// Input: {resourceType: "Practitioner", id: "123", name: [...]}
Patient.name  → { }  // Empty - neither field nor type match
```

## Basic Navigation Nodes

Now let's explore how individual nodes work, starting with the simplest: navigation.

### Identifier Nodes

An identifier node extracts a named field from its input:

```
Type: Identifier
Node: name
```

Processing our Patient:
```
Input:    [Patient(Sarah Smith)]
Context:  {initial context}
     ↓
    name
     ↓
Output:   [HumanName{use:'official'...}, HumanName{use:'nickname'...}]
Context:  {initial context} (unchanged)
```

Key points:
- Takes each item in input collection
- Extracts the 'name' field
- Flattens results into single collection and filters out empty values
- Context passes through unchanged

### The Dot Operator: Sequential Processing and Context Threading

The dot (`.`) is special - it connects nodes sequentially AND threads context:

The dot operator does TWO critical jobs:
1. **Data Pipeline**: Takes left's output as right's input
2. **Context Pipeline**: Passes left's context to right

This dual role is why:
```fhirpath
// Variables propagate through dots
defineVariable('x', 5).name.select(%x + 1)  // Works!

// Without dots, context doesn't flow
defineVariable('x', 5) | name.select(%x + 1)  // %x is not available here
```

The dot operator:
1. Evaluates left side with original input/context
2. Takes left's output as right's input
3. **Passes left's output context to right** (crucial for variables!)
4. Returns right's output and context

### Building Navigation Chains

Let's trace `name.family` (starting from a Patient resource):

Dot operator evaluates left side with original input/context, 
takes left's output as right's input and passes left's output context to right.
Returns right's output and context.

```
Step 1: name
Input:  [Patient(Sarah Smith)]
Output: [HumanName{official}, HumanName{nickname}]

Step 2: family (with dot)
Input:  [HumanName{official}, HumanName{nickname}]
Output: ['Smith'] 
```

### Navigation Examples with Our Patient

```fhirpath
// Starting from Patient resource
name           → [HumanName{official}, HumanName{nickname}]
name.use       → ['official', 'nickname']
name.given     → ['Sarah', 'Jane', 'SJ']
name.family    → ['Smith']  // Empty from nickname filtered out
active         → [true]
birthDate      → ['1985-08-15']

// Navigating deeper
address.city         → ['Boston']
address.state        → ['MA']
address.postalCode   → ['02101']
```

## Simple Function Nodes

Functions are nodes that perform operations on their input. Let's start with the simplest ones.

### Functions Without Arguments

#### `first()` - Get First Element

```
Node: first()
Type: Function
```

```
Input:    ['Sarah', 'Jane', 'SJ']
Context:  {initial}
     ↓
  first()
     ↓
Output:   ['Sarah']
Context:  {initial} (unchanged)
```

Functions propagate empty input into empty output.

#### `count()` - Count Elements

```
name.count()

Input:    [Name{official}, Name{nickname}]
Output:   [2]
Type:     Integer
```

### Functions With Arguments

#### `substring()` - Extract Text

```
Node: substring(start [, length])
Type: Function
```

Example:
```
name.family.substring(0, 2)

Input:    ['Smith']
Process:  substring from position 0, length 2
Output:   ['Sm']
```

```
substring(0, 2) orchestration:
1. Evaluate arg1: 0 → [0]
2. Evaluate arg2: 2 → [2]
3. Apply substring using [0] and [2]
```

How substring orchestrates its arguments:
1. **Evaluates arguments once** with parent $this as input (TODO: think more about this!!!!)
2. **Uses results** to perform substring operation

Can use expressions as arguments:
```fhirpath
name.family.substring(1, name.family.length() - 2)
// Orchestration:
// 1. Evaluate arg1: 1 → [1]
// 2. Evaluate arg2: name.family.length() - 2 → [3]
// 3. Apply substring(1, 3) to input
//or
```

For example, this expression is probably not what you want:

```fhirpath
Patient.name.family.substring(1, length() - 2)
//or even this expression in Patient context:
'123456'.substring(1, length() - 2)
```

Because `length()` will be evaluated with %context as input, which is Patient in our case
and this expression is equivalent to `Patient.name.family.substring(1, Patient.length() - 2)`.
or even `'123456'.substring(1, Patient.length() - 2)`.

You probably need something like this:

```fhirpath
name.family.select(substring(1, length() - 2))
// which means:
name.family.select($this.substring(1, $this.length() - 2))
```
Here, `select` will set `$this` to each family string.

See [discussion](https://chat.fhir.org/#narrow/channel/179266-fhirpath/topic/what.20should.20it.20do.3F/with/529563311)

## Literal and Operator Nodes

### Literal Nodes

Literals are constant values that ignore their input:

```
Node: 'official'
Type: String literal
```

Processing:
```
Input:    [anything]      // ignored!
Context:  {any context}   // passed through
     ↓
 'official'
     ↓  
Output:   ['official']
Context:  {any context}   // unchanged
```

Types of literals:
```fhirpath
'official'     // String
42             // Integer  
3.14           // Decimal
true           // Boolean
@2023-01-15    // Date
```

### Operator Nodes: Parallel Evaluation

Unlike the dot operator, most operators evaluate their arguments in parallel with the same input/context.

#### Equality Operator

```
Node: =
Type: Binary operator
```

How `given.first() = family` works:

```
                    Input: [Name{given:['Sarah','Jane'], family:'Smith'}]
                    Context: {initial}
                         ↓
                    ┌────┴────┐
                    │    =    │
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
        given.first()             family
              ↓                     ↓
         ['Sarah']              ['Smith']
              └──────────┬──────────┘
                         │
                         = (comparison)
                         ↓
                     [false]
```

Key insight: Both sides get the SAME input (the Name object) and context!

### Operator Examples

With our Patient's official name:
```fhirpath
// Input: [Name{use:'official', family:'Smith', given:['Sarah','Jane']}]

// Both sides of = get the same Name input
given.first() = family     → [false]  // 'Sarah' != 'Smith'
given.last() = family      → [false]  // 'Jane' != 'Smith'

// More examples
use = 'official'           → [true]
use != 'nickname'          → [true]
given.count() > 1          → [true]
family = 'Smith'           → [true]

// Complex: still parallel evaluation
given.first() = given.last()    → [false]  // 'Sarah' != 'Jane'
                                // Both sides evaluated with same input!
```

### Operator Precedence

FHIRPath has 13 precedence levels (highest to lowest):

1. `.` (navigation)
2. `[]` (indexing) 
3. unary `+` and `-`
4. `*`, `/`, `div`, `mod`
5. `+`, `-`, `&` (string concatenation)
6. `is`, `as` (type operations)
7. `|` (union)
8. `>`, `<`, `>=`, `<=`
9. `=`, `~`, `!=`, `!~`
10. `in`, `contains`
11. `and`
12. `xor`, `or`
13. `implies`

Example showing precedence:
```fhirpath
// Parentheses show default grouping
name.use = 'official' and name.given.count() > 1
// Evaluates as:
((name.use) = 'official') and ((name.given.count()) > 1)
```

## Iterator Function Nodes: Working with Collections

Iterator functions are special - they process each item in a collection individually while temporarily modifying context.

### The `where()` Function

`where()` filters a collection based on a condition:

```
Node: where(condition)
Type: Iterator function
```

How `name.where(use = 'official')` works:

```
Input: [Name{use:'official'...}, Name{use:'nickname'...}]
Context: {initial}

The where node orchestrates its argument (use = 'official'):
- Evaluates it MULTIPLE times (once per input item)
- With DIFFERENT context each time (adds $this, $index)
- Controls the evaluation loop

For each item:
  Item 1: Name{use:'official'...}
    where creates context: {initial + $this: Name{official}, $index: 0}
    where evaluates argument: use = 'official'
    Result: [true] → Include this item
    
  Item 2: Name{use:'nickname'...}  
    where creates context: {initial + $this: Name{nickname}, $index: 1}
    where evaluates argument: use = 'official'
    Result: [false] → Exclude this item

Output: [Name{use:'official'...}]
Context: {initial}  // Original context restored!
```

Key insights:
- **where controls the loop** - the argument doesn't know it's in a loop
- **where modifies context** before each evaluation
- `$this` refers to the current item being processed
- `$index` is the current position (0-based)
- Original context is restored after processing
- Only items where condition returns true are included

### Using `$this` in where()

```fhirpath
// Find names with more than one given name
name.where($this.given.count() > 1)
// Result: [Name{given:['Sarah','Jane']...}]

// Find names where family starts with 'S'
name.where(family.substring(0,1) = 'S')
// Result: [Name{family:'Smith'...}]

// Complex condition
name.where(use = 'official' and given.exists())
// Result: [Name{use:'official', given:['Sarah','Jane']...}]
```

### The `select()` Function

`select()` transforms each item in a collection:

```
Node: select(expression)
Type: Iterator function
```

Example: `name.select(given.first() + ' ' + family)`

```
Input: [Name{given:['Sarah','Jane'], family:'Smith'}, 
        Name{given:['SJ'], family:{ }}]

For each item:
  Item 1: Name{official}
    Temporary context: {initial + $this: Name{official}}
    Evaluate: given.first() + ' ' + family
    Result: ['Sarah Smith']
    
  Item 2: Name{nickname}
    Temporary context: {initial + $this: Name{nickname}}
    Evaluate: given.first() + ' ' + family
    Result: ['SJ']  // + with empty gives 'SJ'

Output: ['Sarah Smith', 'SJ']
Context: {initial}  // Restored
```

### More Iterator Functions

#### `exists()` - Check if any match

```fhirpath
name.exists(use = 'official')
// Process each name, return true if ANY match
// Result: [true]
```

#### `all()` - Check if all match

```fhirpath
name.all(given.exists())
// Process each name, return true only if ALL have given names
// Result: [false]  // nickname has no given
```

#### `distinct()` - Remove duplicates

```fhirpath
name.use.distinct()
// Input: ['official', 'nickname']
// Output: ['official', 'nickname']  // already unique
```

### Boolean Logic and Empty Collections

FHIRPath uses three-valued logic where empty represents "unknown":

```fhirpath
// With our Patient
active and gender.exists()     → [true] (true and true)
active and deceased            → { }    (true and empty = unknown)
active or deceased             → [true] (true or empty = true)

// Truth tables
true and { }   → { }     // unknown
false and { }  → [false] // definitely false
{ } and { }    → { }     // unknown

true or { }    → [true]  // definitely true  
false or { }   → { }     // unknown
{ } or { }     → { }     // unknown

not(true)      → [false]
not(false)     → [true]
not({ })       → { }     // unknown
```

## Control Flow Nodes

### The `iif()` Function: Conditional Logic

`iif()` evaluates conditions and returns different values:

```
Node: iif(condition, trueResult, falseResult)
Type: Conditional function
```

Key behavior: **iif orchestrates conditional evaluation!**

Example:
```fhirpath
iif(name.count() > 1, 'Multiple names', 'Single name')

How iif orchestrates its three arguments:
1. ALWAYS evaluates first argument (condition): name.count() > 1 → [true]
2. Decides which branch to evaluate based on result
3. Since true, evaluates ONLY second argument: 'Multiple names'
4. NEVER evaluates third argument!
5. Returns: ['Multiple names']
```

This orchestration is different from operators:
```fhirpath
// Operator: evaluates BOTH sides
true and defineVariable('x', 5)  // Both sides evaluated!

// iif: evaluates only needed branch  
iif(true, defineVariable('x', 5), defineVariable('x', 10))  // Only first branch!
```

This lazy evaluation is crucial for:
```fhirpath
// Safe division - avoids division by zero
iif(count() > 0, total / count(), 0)

// Conditional context modification  
iif(gender = 'female', 
    defineVariable('title', 'Ms.'),
    defineVariable('title', 'Mr.'))
```

Context propagation with iif:
```fhirpath
Patient
  .iif(gender = 'female',
    defineVariable('prefix', 'Ms.'),
    defineVariable('prefix', 'Mr.'))
  .name  // The dot here receives the modified context!
  .select(%prefix + ' ' + given.first() + ' ' + family)

// The context flows: iif → dot → name → dot → select
// Result: ['Ms. Sarah Smith']
```

Chaining iif - input becomes $this:
```fhirpath
Patient.name
  .where(use = 'official')
  .iif(given.count() > 1,        // $this is the official Name
    given.join(' '),              // Multiple given names
    given.first())                // Single given name
  
// Step by step:
// 1. Patient.name → [Name{official}, Name{nickname}]
// 2. where(...) → [Name{official}]
// 3. iif gets Name{official} as input
// 4. Inside iif, $this = Name{official}
// 5. Evaluates: given.count() > 1 → true
// 6. Returns: given.join(' ') → ['Sarah Jane']
```

### The `defineVariable()` Function

`defineVariable()` permanently adds a variable to the context:

```
Node: defineVariable(name, value)
Type: Context modifier
```

Example flow:
```fhirpath
Patient
  .defineVariable('patientName', name.where(use='official').given.first())
  .address
  .select(%patientName + ' lives in ' + city)
```

Step by step:
```
1. Start with Patient
   Context: {initial}
   
2. defineVariable('patientName', ...)
   Evaluate expression: name.where(use='official').given.first() → ['Sarah']
   Context becomes: {initial + %patientName: ['Sarah']}
   Output: [Patient] (passes through input)
   
3. The dot before address is crucial!
   - Left (defineVariable) output: [Patient]
   - Left context: {initial + %patientName: ['Sarah']}
   - The dot passes BOTH to the right side
   
4. address
   Input: [Patient] (from dot)
   Context: {initial + %patientName: ['Sarah']} (from dot!)
   Output: [Address{city:'Boston'...}]
   
5. select(...)
   Context still has %patientName thanks to dot propagation!
   Result: ['Sarah lives in Boston']
```

**Key insight**: The dot operator is what allows variables defined on the left to be available on the right. Without the dot, context wouldn't propagate!

Key points:
- Variable name must start with `%`
- Variable is available to all subsequent nodes
- Context modification is permanent
- Input passes through unchanged

Chaining defineVariable - input becomes $this:
```fhirpath
Patient.name
  .where(use = 'official')
  .defineVariable('fullName', given.join(' ') + ' ' + family)
  .given  // Still operating on the Name, not Patient!

// Step by step:
// 1. Patient.name → [Name{official}, Name{nickname}]
// 2. where(...) → [Name{official}]
// 3. defineVariable gets Name{official} as input
// 4. Inside defineVariable expression, $this = Name{official}
// 5. Evaluates: given.join(' ') + ' ' + family → ['Sarah Jane Smith']
// 6. Context: adds %fullName: ['Sarah Jane Smith']
// 7. Output: [Name{official}] (passes through!)
// 8. given operates on Name{official} → ['Sarah', 'Jane']
```

Using both together:
```fhirpath
Patient
  .defineVariable('patientId', id)
  .name
  .where(use = 'official')
  .iif(exists(),
    defineVariable('hasOfficial', true),
    defineVariable('hasOfficial', false))
  .select(%patientId + ': ' + iif(%hasOfficial, given.join(' '), 'No official name'))

// Shows how:
// - defineVariable modifies context permanently
// - iif receives whatever was piped to it
// - Both can access $this from their position in the chain
```

### Combining Control Flow

Complex example using both:
```fhirpath
Patient
  .defineVariable('ageInYears', 
    today().year - birthDate.substring(0,4).toInteger())
  .defineVariable('ageGroup',
    iif(%ageInYears >= 65, 'Senior',
      iif(%ageInYears >= 18, 'Adult', 'Minor')))
  .name
  .select(given.first() + ' is ' + %ageGroup)

// Result: ['Sarah is Adult']
```

## Putting It All Together

Now let's see how all these concepts work in real scenarios.

### Example 1: Finding Contact Information

Task: "Find the home phone number for our patient's official name"

```fhirpath
Patient
  .defineVariable('officialName', 
    name.where(use = 'official').select(given.first() + ' ' + family).first())
  .telecom
  .where(system = 'phone' and use = 'home')
  .select(%officialName + ': ' + value)

// Result: ['Sarah Smith: 555-1234']
```

Breaking it down:
1. Start with Patient
2. Store the official name for later use
3. Navigate to telecom array
4. Filter for home phone
5. Combine with stored name

### Example 2: Age-Based Logic

Task: "Determine if patient needs pediatric or adult care"

```fhirpath
Patient
  .defineVariable('age', today().year - birthDate.substring(0,4).toInteger())
  .iif(%age < 18,
    'Pediatric patient: ' + name.given.first(),
    'Adult patient: ' + name.given.first() + ' (Age: ' + %age.toString() + ')')

// Result: ['Adult patient: Sarah (Age: 39)']
```

### Example 3: Complex Clinical Query

Task: "Find all official names with their cities, but only for active patients"

```fhirpath
Patient
  .where(active = true)
  .defineVariable('patient', $this)
  .name
  .where(use = 'official')
  .select(
    given.join(' ') + ' ' + family + 
    ' from ' + %patient.address.where(use = 'home').city.first()
  )

// Result: ['Sarah Jane Smith from Boston']
```

### Common Patterns

#### Pattern 1: Safe Navigation
```fhirpath
// Handle missing data gracefully
name.where(use = 'official').given.first()
  .iif(exists(), $this, 'Unknown')
```

#### Pattern 2: Aggregation
```fhirpath
// Count specific items
name.where(given.count() > 1).count()
```

#### Pattern 3: Complex Filtering
```fhirpath
// Multi-condition filtering
address.where(
  state = 'MA' and 
  city.exists() and
  postalCode.matches('^021')
)
```

#### Pattern 4: Data Transformation
```fhirpath
// Build new structures
select({
  fullName: given.join(' ') + ' ' + family,
  isOfficial: use = 'official'
})
```

## Summary: The Mental Model

1. **Everything is a node** that processes collections AND orchestrates evaluation
2. **Nodes control their arguments**:
   - Simple functions: evaluate arguments once
   - Iterators: evaluate arguments multiple times with modified context
   - Conditionals: evaluate only needed arguments
   - Operators: evaluate all arguments in parallel
3. **Context flows** through the expression tree via dots
4. **Dots create pipelines** for both data AND context
5. **Iterator functions** temporarily modify context with `$this`
6. **Empty collections** represent unknown/missing values
7. **Control flow nodes** enable complex logic through orchestration

### Evaluation Patterns Summary

| Node Type | Evaluation Strategy | Context Behavior |
|-----------|-------------------|------------------|
| **Literals** | No arguments | Pass through |
| **Identifiers** | No arguments | Pass through |
| **Operators** | All arguments in parallel | Pass through |
| **Simple Functions** | Arguments once | Pass through |
| **Iterators** | Arguments multiple times | Temporary $this/$index |
| **Conditionals** | Selected arguments only | From evaluated branch |
| **Context Modifiers** | Arguments once | Permanently modified |

With this mental model, you can:
- Read any FHIRPath expression by tracing data flow
- Understand HOW nodes control evaluation
- Debug by following input→output transformations
- Build complex queries by composing simple nodes
- Predict which code executes and when

Remember: FHIRPath nodes don't just transform data—they orchestrate the entire evaluation process. Master these concepts, and you've mastered FHIRPath!
