# FHIRPath Mental Model

Stream processing mental model is a way to understand how FHIRpath expressions are evaluated.

FHIRpath expression consists of connected  nodes.
There are several types of nodes:

* identifiers (e.g. `name` or `Patient`)
* operators (including `.` with defined precedence)
* functions (e.g. `where()`, `first()`, `iif()`, `defineVariable()`)
* literals (e.g. `'official'` or `18`)
* variables (e.g. `$this` or `$index` or `%var-name` )

Every node is a stream processor, which gets input and context and other nodes (expressions) 
and produce output and new context.

The whole evaluation process is a sequence of nodes evaluation passing input and context between them.

```
           arguments (other nodes)
                 │
                 ▼
           ┌─────────────────┐
input   ──►│     node        │──► output
context ──►│                 │──► new context
           └─────────────────┘
```

## Input and context

Input is a collection of items, which are being processed.
Context is a set of variables and services, which are available to the nodes.

## Semantics of nodes

### Identifier nodes

Identifier nodes like `name` gets input and produce output as `flatMap` with filtering out empty values on identifier key and pass context unchaged.

### Dot operator

`.` (dot) operator evaluates left expression with original input and context,
and pass left output as input, and left context to right expression and return 
result of the right as [right output, right context]

### Operators

Most of other operators are evaluate left and right expressions with original input and context
merge outputs and propogate original context.

`given | family` operator evaluates left and right expressions with original input and context,
and combine outputs with deduplication.

### High order functions

High order functions (like where, select, iif, defineVariable) are evaluating argument expressions
within specific context and calculate output and new context based on results of expressions.

`where(use='official')` iterates over input and filter it based on output of `use='official'` expression, evaluating it with input item as input. Context is passed unchaged.

`select(name)` iterates over input and evaluate `name` expression with input item as input collecting output as flatMap with filtered out empty values. Context is passed unchaged.

`iif(condition, then, else)` evaluates `condition` node within context of the input item and depending on result 
evaluate `then` or `else` expression with original input returning result of the expression. Context is passed unchaged.

`defineVariable(name, value)` evaluates `value` expression with input item as input and update context with new variable. Output
is passed unchaged.

### Literals

literals are evaluated with original input and context (which is usually ignored) and produce output as is. Context is passed unchaged.

### Variables

variables `%var-name` are evaluated with original input and context, taking variable value from context and return it as output. Context is passed unchaged.

variable `$this` essentially just normal variable, but some funcitons set it into input or one item from input.

variable `$index` is just taken from context as any other variable, but available only in iterative functions. I.e. iterative functions 
set it in a context before iteration and pass it to the expression.