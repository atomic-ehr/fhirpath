# Runtime Context Management

## Overview

The RuntimeContext is a unified context structure that works with both interpreter and compiler. It uses JavaScript's prototype chain for efficient context copying, providing O(1) context creation without deep copying. The RuntimeContextManager provides static methods for all context operations.

## Architecture

### Core RuntimeContext Interface
**Location**: [`/src/runtime/context.ts`](../../src/runtime/context.ts)

```typescript
export interface RuntimeContext {
  input: any[];
  focus: any[];
  env: {
    $this?: any[];
    $index?: number;
    $total?: any[];
    $context?: any[];
    $resource?: any[];
    $rootResource?: any[];
    [key: string]: any;
  };
  variables?: Record<string, any[]>;
}
```

The context structure contains:
- **input**: The original input collection
- **focus**: The current focus collection (often same as input)
- **env**: Environment variables including special FHIRPath variables
- **variables**: User-defined variables

## RuntimeContextManager

### Static Context Operations
**Location**: [`context.ts:RuntimeContextManager`](../../src/runtime/context.ts)

All context operations are provided as static methods:

```typescript
export class RuntimeContextManager {
  /**
   * Create a new runtime context
   */
  static create(input: any[], initialEnv?: Record<string, any>): RuntimeContext {
    const context = Object.create(null) as RuntimeContext;
    
    context.input = input;
    context.focus = input;
    
    // Create env with null prototype to avoid pollution
    context.env = Object.create(null);
    if (initialEnv) {
      Object.assign(context.env, initialEnv);
    }
    
    // Set root context variables
    context.env.$context = input;
    context.env.$resource = input;
    context.env.$rootResource = input;
    
    // Create variables object
    context.variables = Object.create(null);
    
    return context;
  }
  
  /**
   * Get a variable from context (handles special variables too)
   */
  static getVariable(context: RuntimeContext, name: string): any[] | undefined {
    // Remove % prefix if present
    const varName = name.startsWith('%') ? name.substring(1) : name;
    
    // Check special variables first
    switch (varName) {
      case 'context':
        return context.env.$context || context.input;
      case 'resource':
        return context.env.$resource || context.input;
      case 'rootResource':
        return context.env.$rootResource || context.input;
      default:
        // Check user-defined variables
        return context.variables?.[varName];
    }
  }
}
```

### Efficient Context Creation
**Location**: [`context.ts:copy()`](../../src/runtime/context.ts)

Uses prototype inheritance for O(1) context creation:

```typescript
/**
 * Create a child context using prototype inheritance
 * O(1) operation - no copying needed
 */
static copy(context: RuntimeContext): RuntimeContext {
  // Create child context with parent as prototype
  const newContext = Object.create(context) as RuntimeContext;
  
  // Create child env that inherits from parent's env
  newContext.env = Object.create(context.env);
  
  // Create child variables that inherit from parent's variables
  if (context.variables) {
    newContext.variables = Object.create(context.variables);
  }
  
  // input and focus are inherited through prototype chain
  // Only set them if they need to change
  
  return newContext;
}

/**
 * Create a new context with updated input/focus
 */
static withInput(context: RuntimeContext, input: any[], focus?: any[]): RuntimeContext {
  const newContext = this.copy(context);
  newContext.input = input;
  newContext.focus = focus ?? input;
  return newContext;
}

/**
 * Set a variable in the context
 */
static setVariable(context: RuntimeContext, name: string, value: any[]): RuntimeContext {
  const newContext = this.copy(context);
  if (!newContext.variables) {
    newContext.variables = Object.create(null);
  }
  newContext.variables![name] = value;
  return newContext;
}
```

### Special Variables

FHIRPath defines several special variables stored in the `env` object:

- **$this**: The current item being processed (in collections)
- **$index**: Current index in collection (0-based)
- **$total**: Total number of items in collection
- **$context**: The parent context in nested evaluations
- **$resource**: The root resource being evaluated
- **$rootResource**: The absolute root resource

Special root variables accessed without $ prefix:
- **context**: Same as $context
- **resource**: Same as $resource
- **rootResource**: Same as $rootResource

### Variable Access

Variables can be accessed with or without the `%` prefix:

```typescript
static getVariable(context: RuntimeContext, name: string): any[] | undefined {
  // Remove % prefix if present
  const varName = name.startsWith('%') ? name.substring(1) : name;
  
  // Check special variables first
  switch (varName) {
    case 'context':
      return context.env.$context || context.input;
    case 'resource':
      return context.env.$resource || context.input;
    case 'rootResource':
      return context.env.$rootResource || context.input;
    default:
      // Check user-defined variables
      return context.variables?.[varName];
  }
}
```

## Context Patterns

### 1. Iteration Context
Used by functions like `where()` and `select()`:

```typescript
/**
 * Set iterator context ($this, $index)
 */
static withIterator(
  context: RuntimeContext, 
  item: any, 
  index: number
): RuntimeContext {
  const newContext = this.copy(context);
  newContext.env.$this = [item];
  newContext.env.$index = index;
  newContext.input = [item];
  newContext.focus = [item];
  return newContext;
}

// Usage in where() implementation
for (let i = 0; i < collection.length; i++) {
  const itemContext = RuntimeContextManager.withIterator(context, collection[i], i);
  // Evaluate criteria in this context
  const result = evaluate(criteria, itemContext);
}
```

### 2. Context Conversion
Convert between interpreter and runtime contexts:

```typescript
/**
 * Convert from interpreter Context to RuntimeContext
 */
static fromContext(context: Context, input: any[]): RuntimeContext {
  const rtContext = this.create(input);
  
  // Copy variables
  if (context.variables) {
    rtContext.variables = Object.create(context.variables);
  }
  
  // Copy environment
  Object.assign(rtContext.env, context.env);
  
  // Copy root variables
  if ((context as any).$context) rtContext.env.$context = (context as any).$context;
  if ((context as any).$resource) rtContext.env.$resource = (context as any).$resource;
  if ((context as any).$rootResource) rtContext.env.$rootResource = (context as any).$rootResource;
  
  return rtContext;
}

/**
 * Convert from RuntimeContext to interpreter Context
 */
static toContext(rtContext: RuntimeContext): Context {
  const context = Object.create(null) as Context;
  
  // Copy variables
  context.variables = rtContext.variables || Object.create(null);
  
  // Extract env variables
  context.env = {
    $this: rtContext.env.$this,
    $index: rtContext.env.$index,
    $total: rtContext.env.$total
  };
  
  // Extract root variables
  (context as any).$context = rtContext.env.$context;
  (context as any).$resource = rtContext.env.$resource;
  (context as any).$rootResource = rtContext.env.$rootResource;
  
  return context;
}
```

## Prototype-Based Optimization

The RuntimeContext uses JavaScript's prototype chain for efficient context copying:

1. **O(1) Context Creation**: `Object.create()` creates a new object with the parent as prototype
2. **Lazy Property Access**: Properties are only looked up when accessed
3. **No Deep Copying**: Parent context properties remain accessible through prototype chain
4. **Memory Efficient**: Child contexts only store their own modifications

```typescript
// Parent context has variables a=1, b=2
const parent = { env: { a: 1, b: 2 } };

// Child context created with Object.create
const child = Object.create(parent);
child.env = Object.create(parent.env);
child.env.c = 3; // Only c is stored in child

// Access: a and b from parent, c from child
console.log(child.env.a); // 1 (from parent)
console.log(child.env.b); // 2 (from parent)
console.log(child.env.c); // 3 (from child)
```

## Memory Management

The prototype-based approach provides automatic memory management benefits:

1. **No Explicit Cleanup**: Contexts are garbage collected when no longer referenced
2. **Shared Parent Data**: Parent context data is shared, not duplicated
3. **Minimal Allocations**: Only modified properties allocate new memory
4. **Natural GC Integration**: Works with JavaScript's garbage collector

## Integration Examples

### With Interpreter
**Location**: [`/src/interpreter/interpreter.ts`](../../src/interpreter/interpreter.ts)

The interpreter uses RuntimeContext directly:

```typescript
// Variables are handled through RuntimeContextManager
private evaluateVariable(node: VariableNode, input: any[], context: RuntimeContext): EvaluationResult {
  let value: any[] = [];
  
  if (node.name.startsWith('$')) {
    // Special environment variables
    switch (node.name) {
      case '$this':
        return { value: context.env.$this || [], context };
      case '$index':
        return { value: context.env.$index !== undefined ? [context.env.$index] : [], context };
      // ...
    }
  } else {
    // User-defined variables
    value = RuntimeContextManager.getVariable(context, node.name) || [];
    return { value, context };
  }
}
```

### With Compiler
**Location**: [`/src/compiler/compiler.ts`](../../src/compiler/compiler.ts)

Compiled functions manipulate RuntimeContext:

```typescript
// Dot operator compilation
if (operator === TokenType.DOT) {
  const left = this.compileNode(node.left);
  const right = this.compileNode(node.right);
  
  return {
    fn: (ctx: RuntimeContext) => {
      // Execute left side with the original context
      const leftResult = left.fn(ctx);
      
      // Execute right side with left's result as input
      const rightCtx = RuntimeContextManager.withInput(ctx, leftResult);
      return right.fn(rightCtx);
    },
    type: right.type,
    isSingleton: right.isSingleton
  };
}
```

## Usage Examples

### Basic Usage
```typescript
import { RuntimeContextManager } from './runtime/context';

// Create root context
const context = RuntimeContextManager.create(
  [patient],  // input
  {           // initial environment
    customVar: 'value'
  }
);

// Create child context with new variable
const childContext = RuntimeContextManager.setVariable(
  context,
  'encounter',
  [latestEncounter]
);

// Create iteration context
const itemContext = RuntimeContextManager.withIterator(
  context,
  patient.name[0],  // item
  0                 // index
);

// Access variables
console.log(RuntimeContextManager.getVariable(context, 'resource'));    // [patient]
console.log(RuntimeContextManager.getVariable(childContext, 'encounter')); // [latestEncounter]
console.log(itemContext.env.$index);                                    // 0
```

### Direct Context Manipulation
```typescript
// The context structure can be manipulated directly
const ctx: RuntimeContext = {
  input: [patient],
  focus: [patient],
  env: {
    $this: [patient],
    $resource: [patient],
    $rootResource: [patient]
  },
  variables: {
    customVar: ['value']
  }
};

// Compiled functions work directly with the context
const compiledFn = (ctx: RuntimeContext) => {
  return ctx.env.$this || [];
};

const result = compiledFn(ctx); // [patient]
```

## Performance Considerations

1. **Prototype Chain**: Leverages JavaScript's prototype lookup for efficient variable access
2. **O(1) Context Creation**: No deep copying needed - just `Object.create()`
3. **Memory Sharing**: Parent context data is shared through prototype chain
4. **Direct Property Access**: Compiled code accesses `ctx.env.$this` directly without function calls
5. **Null Prototype**: Uses `Object.create(null)` to avoid prototype pollution

## Key Design Decisions

1. **Unified Context**: Single structure works for both interpreter and compiler
2. **Static Manager**: All operations through `RuntimeContextManager` static methods
3. **Prototype Inheritance**: Efficient context chaining without copying
4. **Separate env and variables**: Special variables in `env`, user variables in `variables`
5. **Type Safety**: TypeScript interfaces ensure correct context structure

The RuntimeContext design provides efficient context management for FHIRPath evaluation, supporting deep nesting and complex variable scoping with minimal performance overhead.