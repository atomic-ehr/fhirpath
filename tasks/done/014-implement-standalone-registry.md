# Task 001: Implement Standalone Registry with Operation Hierarchy

## Objective
Implement the unified operation registry as designed in ADR-007 with separate interfaces for operators, functions, and literals.

## Requirements

1. **Create base types and interfaces**:
   - `BaseOperation` interface with common lifecycle methods
   - `Operator`, `Function`, and `Literal` interfaces extending base
   - Supporting types: `TypeConstraint`, `CompiledExpression`, etc.

2. **Implement Registry class**:
   - Registration methods for all operation types
   - Lookup methods by name and token
   - Special methods for lexer (keyword detection, literal matching)
   - Precedence table management

3. **Create default analyzers**:
   - `defaultOperatorAnalyze` for operators
   - `defaultFunctionAnalyze` for functions  
   - `defaultLiteralAnalyze` for literals

4. **Define initial operations**:
   - Basic arithmetic operators: `+`, `-`, `*`, `/`
   - Basic logical operators: `and`, `or`, `not`
   - Basic literals: integer, boolean (`true`/`false`), string
   - Basic functions: `exists()`, `empty()`, `count()`

## Deliverables

- `/src/registry/types.ts` - All interfaces and types
- `/src/registry/registry.ts` - Registry implementation
- `/src/registry/operations/arithmetic.ts` - Arithmetic operators
- `/src/registry/operations/logical.ts` - Logical operators
- `/src/registry/operations/literals.ts` - Literal definitions
- `/src/registry/operations/existence.ts` - Existence functions
- `/src/registry/index.ts` - Auto-registration of all operations

## Tests

- Registry registration and lookup tests
- Type constraint matching tests
- Default analyzer tests
- Literal parsing tests

## What was done

1. Created the full type system in `/src/registry/types.ts`:
   - `BaseOperation` interface with common lifecycle methods
   - `Operator`, `Function`, and `Literal` interfaces extending base
   - Supporting types: `TypeConstraint`, `TypeInferenceRule`, `CardinalityInferenceRule`
   - `CompiledExpression` interface for closure-based compilation
   - Component interfaces: `Analyzer`, `Interpreter`, `Compiler`

2. Implemented Registry class in `/src/registry/registry.ts`:
   - Registration methods for all operation types
   - Lookup methods by name and token
   - Keyword detection and literal matching
   - Precedence table management
   - Helper methods for lexer/parser

3. Created default analyzers in `/src/registry/default-analyzers.ts`:
   - `defaultOperatorAnalyze` with parameter validation
   - `defaultFunctionAnalyze` with input/parameter checking
   - `defaultLiteralAnalyze` for fixed type/cardinality
   - Helper functions for type constraint matching

4. Implemented operation definitions:
   - Arithmetic operators: `+`, `-`, `*`, `/`, `mod`, `div` in `/src/registry/operations/arithmetic.ts`
   - Logical operators: `and`, `or`, `not`, `xor`, `implies` in `/src/registry/operations/logical.ts`
   - Literals: integer, decimal, boolean, string, datetime, time, quantity in `/src/registry/operations/literals.ts`
   - Existence functions: `exists()`, `empty()`, `count()`, `first()`, `last()`, `single()` in `/src/registry/operations/existence.ts`

5. Created auto-registration in `/src/registry/index.ts`:
   - All operations are registered on module load
   - Exports registry and all types

6. Added helper functions in `/src/interpreter/helpers.ts`:
   - `toSingleton()` - convert collection to single value
   - `toBoolean()` - convert value to boolean
   - `isTruthy()` - check if collection is truthy

7. Comprehensive test suite in `/test/registry/registry.test.ts`:
   - All tests passing (17 tests)
   - Validates registration, lookup, keywords, literals, precedence

The registry is now ready to be used by lexer, parser, analyzer, interpreter, and compiler components.