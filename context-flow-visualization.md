# Context Flow Visualization: defineVariable and the Dot Operator

## Test Case: `a.defineVariable('x', 10).b.select(%x)`

Input: `[{a: {b: 10}}]`

### AST Structure
```
DOT
├── left: a
└── right: DOT
    ├── left: defineVariable('x', 10)
    └── right: DOT
        ├── left: b
        └── right: select(%x)
```

### Execution Flow - Before Fix (❌ Failed)

```mermaid
graph TD
    A["Initial Context<br/>input: [{a: {b: 10}}]<br/>env: {}"] --> B["Outer DOT creates mutableCtx1<br/>env: {} (new object)"]
    
    B --> C["Evaluate 'a' with mutableCtx1<br/>Result: [{b: 10}]<br/>env: {} (unchanged)"]
    
    C --> D["Inner DOT1 creates mutableCtx2<br/>input: [{b: 10}]<br/>env: {} (new object)"]
    
    D --> E["defineVariable('x', 10)<br/>modifies mutableCtx2.env<br/>env: {x: 10}<br/>Result: [{b: 10}]"]
    
    E --> F["Inner DOT2 creates mutableCtx3<br/>input: [{b: 10}]<br/>env: {} (new object - lost x!)"]
    
    F --> G["Evaluate 'b'<br/>Result: [10]<br/>env: {} (no x)"]
    
    G --> H["select(%x)<br/>Looks for x in env<br/>env: {} (x not found!)<br/>Result: []"]
    
    style E fill:#ffcccc
    style F fill:#ffcccc
    style H fill:#ff6666
```

**Problem**: Each DOT operator created a new `env` object, so the modification made by `defineVariable` was lost.

### Execution Flow - After Fix (✅ Passes)

```mermaid
graph TD
    A["Initial Context<br/>input: [{a: {b: 10}}]<br/>env: {}"] --> B["Outer DOT uses shared env<br/>env: {} (shared reference)"]
    
    B --> C["Evaluate 'a'<br/>Result: [{b: 10}]<br/>env: {} (shared)"]
    
    C --> D["Inner DOT1 uses shared env<br/>input: [{b: 10}]<br/>env: {} (shared reference)"]
    
    D --> E["defineVariable('x', 10)<br/>modifies shared env<br/>env: {x: 10}<br/>Result: [{b: 10}]"]
    
    E --> F["Inner DOT2 uses shared env<br/>input: [{b: 10}]<br/>env: {x: 10} (preserved!)"]
    
    F --> G["Evaluate 'b'<br/>Result: [10]<br/>env: {x: 10}"]
    
    G --> H["select(%x)<br/>Looks for x in env<br/>env: {x: 10} (found!)<br/>Result: [10]"]
    
    style E fill:#ccffcc
    style F fill:#ccffcc
    style H fill:#66ff66
```

**Solution**: All DOT operators share the same `env` object reference, allowing `defineVariable` modifications to persist.

## Key Concepts

### 1. Context Structure
```typescript
interface RuntimeContext {
  input: any[];      // Current data being processed
  focus: any[];      // Same as input (for $this)
  env: {            // Variable environment
    [key: string]: any;
    $this?: any;
    $index?: number;
    $total?: number;
  }
}
```

### 2. How defineVariable Works
```typescript
// defineVariable('x', 10) does:
ctx.env['x'] = 10;        // Modifies env in-place
return input;             // Passes input through unchanged
```

### 3. How DOT Operator Works
```typescript
// Before fix - Created new env:
const mutableCtx = {
  ...ctx,
  env: { ...ctx.env }  // NEW object - loses modifications!
};

// After fix - Shares env:
const mutableCtx = {
  ...ctx               // env is shared from parent context
};
```

## Other Test Cases

### Test 2: `defineVariable('x', 10).a.b.select(%x)`
```
Initial: env: {}
After defineVariable: env: {x: 10}
After .a: env: {x: 10} (preserved)
After .b: env: {x: 10} (preserved)
After select(%x): Returns [10]
```

### Test 3: Chained defineVariable
```
defineVariable('x', 5).defineVariable('y', %x + 5).select(%y)

env: {} → {x: 5} → {x: 5, y: 10} → Returns [10]
```

## Visual Summary

The fix ensures that the `env` object is shared across all operations in a DOT chain, allowing variables defined at any point to be accessible later in the expression:

```
Expression: a.defineVariable('x', 10).b.select(%x)
            ↓         ↓                ↓     ↓
env:       {} ────→ {x:10} ────────→ {x:10} → {x:10}
                    (shared across entire chain)
```

This matches the interpreter's behavior where context modifications flow through the entire expression chain.