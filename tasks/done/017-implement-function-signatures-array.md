# Task 017: Implement Function Signatures Array (ADR-014)

## Objective

Implement ADR-014 to support union types in function signatures by converting from single `signature` to `signatures` array, matching the pattern already used by operators.

**Note**: We are doing a clean breaking change - no backward compatibility needed. Clean code is the priority.

## Background

- Functions like `abs()` should accept `Integer | Decimal | Quantity` per FHIRPath spec
- Currently using `Any` type as workaround, which is too permissive
- Operators already use `signatures: OperatorSignature[]` array pattern
- This inconsistency makes completions less accurate and code harder to maintain

## Implementation Steps

### 1. Update Type Definitions (`src/types.ts`)

- [ ] Create `FunctionSignature` interface:
  ```typescript
  export interface FunctionSignature {
    name: string;
    input: TypeInfo;
    parameters: Array<{
      name: string;
      optional?: boolean;
      type: TypeInfo;
      expression?: boolean;
    }>;
    result: TypeInfo | 'inputType' | 'inputTypeSingleton' | 'parameterType';
  }
  ```

- [ ] Update `FunctionDefinition` interface:
  ```typescript
  export interface FunctionDefinition {
    name: string;
    category: string[];
    description: string;
    examples: string[];
    signatures: FunctionSignature[];  // Changed from signature to signatures
    evaluate: FunctionEvaluator;
  }
  ```

### 2. Update Registry (`src/registry.ts`)

- [ ] Update `registerFunction()` to handle signatures array
- [ ] Update `isFunctionApplicableToType()` to check all signatures:
  - Return true if ANY signature matches the input type
  - Handle singleton constraints properly
  - Check each signature's input type

### 3. Update All Function Definitions (`src/operations/*.ts`)

Functions to update (approximately 37 files):

#### High Priority - Union Types (per FHIRPath spec):

- [ ] **`abs-function.ts`** - `abs() : Integer | Decimal | Quantity`
  ```typescript
  signatures: [
    { name: 'abs-integer', input: { type: 'Integer', singleton: true }, parameters: [], result: { type: 'Integer', singleton: true } },
    { name: 'abs-decimal', input: { type: 'Decimal', singleton: true }, parameters: [], result: { type: 'Decimal', singleton: true } },
    { name: 'abs-quantity', input: { type: 'Quantity', singleton: true }, parameters: [], result: { type: 'Quantity', singleton: true } }
  ]
  ```

- [ ] **`toInteger-function.ts`** - `toInteger() : Integer`
  - Spec: accepts Integer, String (convertible), Boolean
  ```typescript
  signatures: [
    { name: 'toInteger-integer', input: { type: 'Integer', singleton: true }, parameters: [], result: { type: 'Integer', singleton: true } },
    { name: 'toInteger-string', input: { type: 'String', singleton: true }, parameters: [], result: { type: 'Integer', singleton: true } },
    { name: 'toInteger-boolean', input: { type: 'Boolean', singleton: true }, parameters: [], result: { type: 'Integer', singleton: true } }
  ]
  ```

- [ ] **`toString-function.ts`** - `toString() : String`
  - Spec: accepts String, Integer, Decimal, Boolean, Date, DateTime, Time, Quantity
  ```typescript
  signatures: [
    { name: 'toString-string', input: { type: 'String', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-integer', input: { type: 'Integer', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-decimal', input: { type: 'Decimal', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-boolean', input: { type: 'Boolean', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-date', input: { type: 'Date', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-datetime', input: { type: 'DateTime', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-time', input: { type: 'Time', singleton: true }, parameters: [], result: { type: 'String', singleton: true } },
    { name: 'toString-quantity', input: { type: 'Quantity', singleton: true }, parameters: [], result: { type: 'String', singleton: true } }
  ]
  ```

- [ ] **`toDecimal-function.ts`** - `toDecimal() : Decimal`
  - Similar to toInteger, accepts multiple types

- [ ] **`toBoolean-function.ts`** - `toBoolean() : Boolean`
  - Accepts Boolean, Integer (0/1), Decimal (0.0/1.0), String ('true'/'false' variants)

#### String Functions (Single Type - per spec):

- [ ] **`length-function.ts`** - `length() : Integer` (String input)
- [ ] **`substring-function.ts`** - `substring(start : Integer [, length : Integer]) : String`
- [ ] **`upper-function.ts`** - `upper() : String` (String input)
- [ ] **`lower-function.ts`** - `lower() : String` (String input)
- [ ] **`trim-function.ts`** - `trim() : String` (String input)
- [ ] **`split-function.ts`** - `split(separator : String) : List<String>`
- [ ] **`replace-function.ts`** - `replace(pattern : String, substitution : String) : String`
- [ ] **`contains-function.ts`** - `contains(substring : String) : Boolean`
- [ ] **`startsWith-function.ts`** - `startsWith(prefix : String) : Boolean`
- [ ] **`endsWith-function.ts`** - `endsWith(suffix : String) : Boolean`
- [ ] **`indexOf-function.ts`** - `indexOf(substring : String) : Integer`
- [ ] **`matches-function.ts`** - `matches(regex : String) : Boolean`
- [ ] **`join-function.ts`** - `join([separator : String]) : String` (String collection input)

#### Math Functions (per spec):

- [ ] **`ceiling-function.ts`** - `ceiling() : Integer` (Input: Decimal/Integer)
- [ ] **`floor-function.ts`** - `floor() : Integer` (Input: Decimal/Integer)
- [ ] **`round-function.ts`** - `round([precision : Integer]) : Decimal` (Input: Decimal)
- [ ] **`sqrt-function.ts`** - `sqrt() : Decimal` (Input: Decimal/Integer)
- [ ] **`ln-function.ts`** - `ln() : Decimal` (Input: Decimal/Integer)
- [ ] **`exp-function.ts`** - `exp() : Decimal` (Input: Decimal/Integer)
- [ ] **`power-function.ts`** - `power(exponent : Integer | Decimal) : Integer | Decimal`
- [ ] **`truncate-function.ts`** - `truncate() : Integer` (Input: Decimal)

#### Collection Functions (Accept Collections - singleton: false):

- [ ] **`where-function.ts`** - `where(criteria : expression) : collection`
  - Input: Any type, **collection** (singleton: false)
  ```typescript
  signatures: [
    { name: 'where', input: { type: 'Any', singleton: false }, parameters: [{ name: 'criteria', type: { type: 'Any' }, expression: true }], result: 'inputType' }
  ]
  ```

- [ ] **`select-function.ts`** - `select(projection : expression) : collection`
  - Input: Any type, **collection** (singleton: false)
  
- [ ] **`first-function.ts`** - `first() : T`
  - Input: Any type, **collection** (singleton: false)
  - Result: singleton (extracts first item)
  
- [ ] **`last-function.ts`** - `last() : T`
  - Input: Any type, **collection** (singleton: false)
  - Result: singleton (extracts last item)
  
- [ ] **`tail-function.ts`** - `tail() : collection`
  - Input: Any type, **collection** (singleton: false)
  - Result: collection (all but first)
  
- [ ] **`take-function.ts`** - `take(num : Integer) : collection`
  - Input: Any type, **collection** (singleton: false)
  
- [ ] **`skip-function.ts`** - `skip(num : Integer) : collection`
  - Input: Any type, **collection** (singleton: false)
  
- [ ] **`count-function.ts`** - `count() : Integer`
  - Input: Any type, **collection** (singleton: false)
  - Result: Integer singleton
  
- [ ] **`distinct-function.ts`** - `distinct() : collection`
  - Input: Any type, **collection** (singleton: false)
  
- [ ] **`empty-function.ts`** - `empty() : Boolean`
  - Input: Any type, **collection** (singleton: false)
  - Result: Boolean singleton
  
- [ ] **`exists-function.ts`** - `exists([criteria : expression]) : Boolean`
  - Input: Any type, **collection** (singleton: false)
  - Result: Boolean singleton
  
- [ ] **`all-function.ts`** - `all(criteria : expression) : Boolean`
  - Input: Any type, **collection** (singleton: false)
  
- [ ] **`allTrue-function.ts`** - `allTrue() : Boolean`
  - Input: Boolean, **collection** (singleton: false)
  
- [ ] **`allFalse-function.ts`** - `allFalse() : Boolean`
  - Input: Boolean, **collection** (singleton: false)
  
- [ ] **`anyTrue-function.ts`** - `anyTrue() : Boolean`
  - Input: Boolean, **collection** (singleton: false)
  
- [ ] **`anyFalse-function.ts`** - `anyFalse() : Boolean`
  - Input: Boolean, **collection** (singleton: false)

#### Mixed Functions (Some accept Any singleton status):

- [ ] **`combine-function.ts`** - `combine(other : collection) : collection`
  - Input: Any type, any singleton status
  
- [ ] **`union-function.ts`** - `union(other : collection) : collection`
  - Input: Any type, any singleton status
  
- [ ] **`intersect-function.ts`** - `intersect(other : collection) : collection`
  - Input: Any type, any singleton status
  
- [ ] **`exclude-function.ts`** - `exclude(other : collection) : collection`
  - Input: Any type, any singleton status

#### Type Checking Functions:

- [ ] **`ofType-function.ts`** - `ofType(type : TypeSpecifier) : collection`
  - Input: Any type, **collection** (singleton: false)
  
- [ ] **`is-function.ts`** - `is(type : TypeSpecifier) : Boolean`
  - Input: Any type, **singleton** (singleton: true)
  
- [ ] **`as-function.ts`** - `as(type : TypeSpecifier) : T`
  - Input: Any type, **singleton** (singleton: true)

### 4. Update Components Using Function Signatures

- [ ] **Completion Provider** (`src/completion-provider.ts`):
  - Update `isFunctionApplicable()` to check signatures array
  - Update code accessing `func.signature.parameters` to use first signature or merge
  - Handle `hasParams` check with signatures array

- [ ] **Analyzer** (`src/analyzer.ts`):
  - Update any code that accesses function signatures
  - Check type inference code

- [ ] **Interpreter** (`src/interpreter.ts`):
  - Verify function evaluation still works
  - No changes expected as it uses `evaluate` function

### 5. Update Tests

- [ ] Update `test/registry.test.ts` - test signature array handling
- [ ] Update `test/registry-type-aware.test.ts` - verify union type checking
- [ ] Update `test/completion-provider.test.ts` - ensure completions still work
- [ ] Update `test/completion-singleton-collection.test.ts` - verify type filtering
- [ ] Add new test cases for union type functions:
  - `abs()` appears for Integer, Decimal, Quantity
  - `abs()` does NOT appear for String, Boolean
  - `toString()` appears for multiple types

### 6. Documentation

- [ ] Update code comments in modified files
- [ ] Update CLAUDE.md if needed
- [ ] Mark ADR-014 as "Accepted" once implemented

## Testing Strategy

1. Run TypeScript compilation after each major change: `bun tsc --noEmit`
2. Run tests frequently: `bun test`
3. Test completions manually:
   ```bash
   bun tools/completions.ts "5." 2  # Should show abs
   bun tools/completions.ts '"hello".' 8  # Should NOT show abs
   bun tools/completions.ts "(5.5 'mg')." 10  # Should show abs for Quantity
   ```

## Success Criteria

- [ ] All functions use `signatures` array (no more `signature` singular)
- [ ] TypeScript compiles without errors
- [ ] All existing tests pass
- [ ] New tests for union types pass
- [ ] Completions are more accurate:
  - `abs()` only appears for numeric types
  - String functions only appear for strings
  - Type-specific functions filtered correctly
- [ ] Registry correctly checks all signatures for applicability

## Notes

- This is a breaking change - all functions must be updated
- No backward compatibility needed - clean code is priority
- Consider creating a simple script to help with mechanical conversion of single signatures to arrays
- Pay special attention to functions that genuinely accept multiple types (union types)
- Ensure singleton constraints are preserved in the migration