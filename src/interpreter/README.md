# FHIRPath Interpreter

A stream-processing based FHIRPath interpreter implementation following the mental model described in `ideas/fhirpath-mental-model-3.md`.

## Architecture

The interpreter follows the core principle that **everything is a processing node** with a uniform interface:
- **Input**: Always a collection (even single values are collections of one)
- **Context**: Variables and environment data flowing parallel to data
- **Output**: The resulting collection
- **New Context**: Potentially modified context

## Implementation Status

### ✅ Phase 1: Core Infrastructure
- `types.ts` - Core interfaces (EvaluationResult, Context, TypeInfo)
- `context.ts` - Context management (variables, environment)
- `interpreter.ts` - Base interpreter class with node dispatch

### ✅ Phase 2: Simple Nodes
- **Literals**: Numbers, strings, booleans, null, collections
- **Identifiers**: Property navigation with flattening
- **Variables**: $this, $index, $total, %user-variables, %context
- **Dot Operator**: Pipeline semantics (left output → right input)

### ✅ Phase 3: Operators
- **Arithmetic**: +, -, *, /, div, mod with singleton conversion
- **Comparison**: =, !=, <, >, <=, >= with three-valued logic
- **Logical**: and, or, not, xor, implies with three-valued logic
- **Unary**: +, -, not

### 🚧 Phase 4: Basic Functions (Next)
- Function dispatch mechanism
- Simple value functions (first, last, count, etc.)
- Iterator functions (where, select, exists, all)

### 📋 Phase 5: Type System (Planned)
- Type hierarchy and checking
- is/as operators
- Type conversions

### 📋 Phase 6: Advanced Features (Planned)
- Context modification (defineVariable)
- Conditional evaluation (iif)
- Collection operations (union, intersect)
- Index operations

## Key Design Decisions

1. **Two-Phase Evaluation**: Control flow (top-down) and data flow (bottom-up)
2. **Collection Semantics**: Everything is a collection, empty represents null/missing
3. **Context Threading**: Context flows through expressions, modified by some operations
4. **Three-Valued Logic**: Empty collections represent "unknown" in boolean operations
5. **Singleton Rules**: Automatic conversion from single-item collections when needed

## Usage

```typescript
import { evaluateFHIRPath } from './interpreter/interpreter';
import { ContextManager } from './interpreter/context';

// Simple evaluation
const result = evaluateFHIRPath('Patient.name.given', patient);

// With context
const context = ContextManager.create();
const ctxWithVar = ContextManager.setVariable(context, 'threshold', [10]);
const result2 = evaluateFHIRPath('value > %threshold', data, ctxWithVar);
```

## Testing

Tests are organized by implementation phase in `test/interpreter.test.ts`:
- Phase 2: Simple nodes (literals, identifiers, variables, dot)
- Phase 3: Operators (arithmetic, comparison, logical)
- Phase 4: Functions (coming soon)

Run tests with: `bun test test/interpreter.test.ts`