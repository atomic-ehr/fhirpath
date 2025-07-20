# FHIRPath: A Node-Based Processing Model

## Introduction

FHIRPath is a path-based navigation and extraction language designed for FHIR resources. At first glance, expressions like `Patient.name.where(use = 'official').given` might seem like simple property access, but there's an elegant and powerful model underneath.

This guide will help you build an accurate mental model of how FHIRPath works by introducing one concept at a time, using a single Patient example throughout.

## The Core Mental Model: Everything is a Processing Node

The key insight that makes FHIRPath intuitive is this: **every part of a FHIRPath expression is a processing node with the same interface**.

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

FHIRPath expressions are trees of connected nodes. Data and context flow through these nodes:

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

## Collections: The Foundation

Before we dive into specific nodes, understand that **everything in FHIRPath is a collection**:

### Collection Properties
- **Ordered**: `[1, 2, 3]` is different from `[3, 2, 1]`
- **Non-unique**: `[1, 1, 2]` is valid
- **Typed**: Each element has a type
- **Can be empty**: `{ }` represents no value/unknown

### The Empty Collection

The empty collection `{ }` is special:
- Represents missing or unknown values
- Propagates through most operations
- Acts as "unknown" in three-valued logic

Examples:
```
{ }.first() → { }
{ } = 5 → { }
{ } and true → { }
```

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

## Context and Starting Points

### What is Context?

Context is the environment in which expressions evaluate. It contains:
- **Variables**: Named values available during evaluation
- **Special variables**: `$this`, `$index`, `$total`
- **Standard FHIR variables**: `%context`, `%resource`, `%rootResource`
- **Environment**: External data like terminology servers

### Initial Context Matters

The same expression can have different meanings depending on where it starts. The initial context always includes these standard variables:

- **`%context`**: The original input to the FHIRPath expression
- **`%resource`**: The resource containing the current focus (may change during evaluation)
- **`%rootResource`**: The root resource (for nested resources)

#### Starting with a Patient resource:
```
Expression: name.given
Input: [Patient Sarah Smith]
Initial Context: {
  %context: [Patient Sarah Smith],
  %resource: [Patient Sarah Smith],
  %rootResource: [Patient Sarah Smith]
}
Output: ['Sarah', 'Jane', 'SJ']
```

#### Starting with a Bundle containing Patients:
```
Expression: entry.resource.ofType(Patient).name.given
Input: [Bundle]
Initial Context: {
  %context: [Bundle],
  %resource: [Bundle],
  %rootResource: [Bundle]
}
Output: ['Sarah', 'Jane', 'SJ', 'John', 'Mary', ...]  // From all Patients
```

#### Using Standard Variables:
```fhirpath
// From anywhere in the expression, access original input
name.where(use = 'official').select(%context.id)

// When navigating into contained resources
Bundle.entry.resource.where(%resource.resourceType = 'Patient')
```

### The Ambiguity of `Patient`

When you see `Patient` in FHIRPath, it's ambiguous - the same syntax can mean different things depending on context:

```fhirpath
Patient.name  // What does "Patient" mean here?
```

This could be:
1. **Field navigation** - looking for a field named "Patient"
2. **Type filter** - filtering to only Patient resources

The interpretation depends on:
- Your input data structure
- The data model being used
- Implementation choices

Examples of the ambiguity:
```fhirpath
// Scenario 1: Input has a Patient field
// Input: {Patient: {name: [{given: ["John"]}]}}
Patient.name  → [{given: ["John"]}]  // Field navigation

// Scenario 2: Input is a collection of resources
// Input: [{resourceType: "Patient", name: [...]}, 
//         {resourceType: "Person", name: [...]}]
Patient.name  → names from Patient resources  // Type filter
              // Person resources filtered out

// Scenario 3: No Patient field or type
// Input: {id: "123", name: [...]}
Patient.name  → { }  // Empty - neither field nor type match
```

To avoid ambiguity:
```fhirpath
// Explicit type filtering (recommended)
ofType(Patient).name  // Clear intention: filter by type

// Explicit field navigation
$this.Patient.name    // Clear intention: access field
```

## Basic Navigation Nodes

Now let's explore how individual nodes work, starting with the simplest: navigation.

### Identifier Nodes

An identifier node extracts a named field from its input:

```
Node: name
Type: Identifier
```

Processing our Patient:
```
Input:    [Patient Sarah Smith]
Context:  {initial context}
     ↓
   name
     ↓
Output:   [Name{use:'official'...}, Name{use:'nickname'...}]
Context:  {initial context} (unchanged)
```

Key points:
- Takes each item in input collection
- Extracts the 'name' field
- Flattens results into single collection
- Context passes through unchanged

### The Dot Operator: Sequential Processing and Context Threading

The dot (`.`) is special - it connects nodes sequentially AND threads context:

```
Node: .
Type: Binary operator (highest precedence)
```

How `name.family` works:

```
Input:    [Name{use:'official', family:'Smith', given:['Sarah','Jane']}]
Context:  {initial}
     ↓
  name ──► [Name{...}] ──► family ──► ['Smith']
     ↓                                    ↓
   (left)                              (right)
     ↓                                    ↓
Output:   ['Smith']
Context:  {initial} (unchanged in this case)
```

The dot operator does TWO critical jobs:
1. **Data Pipeline**: Takes left's output as right's input
2. **Context Pipeline**: Passes left's context to right

This dual role is why:
```fhirpath
// Variables propagate through dots
defineVariable('x', 5).name.select(%x + 1)  // Works!

// Without dots, context doesn't flow
defineVariable('x', 5) name select(%x + 1)  // Syntax error!
```

The dot operator:
1. Evaluates left side with original input/context
2. Takes left's output as right's input
3. **Passes left's output context to right** (crucial for variables!)
4. Returns right's output and context

### Building Navigation Chains

Let's trace `name.family` (starting from a Patient resource):

```
Step 1: name
Input:  [Patient Sarah Smith]
Output: [Name{official}, Name{nickname}]

Step 2: family (with dot)
Input:  [Name{official}, Name{nickname}]     // from step 1
Process each Name:
  - Name{official}.family → ['Smith']
  - Name{nickname}.family → { }  // no family field
Output: ['Smith']    // empty filtered out
```

For deeper navigation, tracing `address.city`:
```
Input:  [Patient Sarah Smith]
Step 1: address → [Address{city:'Boston', state:'MA'}]
Step 2: city → ['Boston']
```

Key insight: Navigation automatically:
- Processes each item in the collection
- Extracts the requested field
- Flattens nested collections
- Filters out empty results

### Navigation Examples with Our Patient

```fhirpath
// Starting from Patient resource
name           → [Name{official}, Name{nickname}]
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

Example with our Patient:
```
Input:    ['Sarah', 'Jane', 'SJ']
Context:  {initial}
     ↓
  first()
     ↓
Output:   ['Sarah']
Context:  {initial} (unchanged)
```

With empty input:
```
Input:    { }
Output:   { }  // Empty propagates
```

#### `last()` - Get Last Element

```
name.given.last()

Input:    ['Sarah', 'Jane', 'SJ']
Output:   ['SJ']
```

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

How substring orchestrates its arguments:
1. **Evaluates arguments once** with original input/context
2. **Waits for results** before processing
3. **Uses results** to perform substring operation

```
substring(0, 2) orchestration:
1. Evaluate arg1: 0 → [0]
2. Evaluate arg2: 2 → [2]
3. Apply substring using [0] and [2]
```

Can use expressions as arguments:
```fhirpath
family.substring(1, family.length() - 2)
// Orchestration:
// 1. Evaluate arg1: 1 → [1]
// 2. Evaluate arg2: family.length() - 2 → [3]
// 3. Apply substring(1, 3) to input
```

### More Simple Functions

```fhirpath
// String functions
name.family.upper()        → ['SMITH']
name.family.lower()        → ['smith']
name.family.length()       → [5]

// Collection functions
name.given.distinct()      → ['Sarah', 'Jane', 'SJ']  // no duplicates here
name.use.exists()          → [true]  // at least one exists
name.middle.empty()        → [true]  // none exist

// Type checking
active.type()              → ['System.Boolean']
birthDate.type()           → ['System.Date']
```

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
