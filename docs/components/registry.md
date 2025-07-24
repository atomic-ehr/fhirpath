# Registry System

## Overview

The registry system provides a centralized repository for all FHIRPath operations including operators, functions, and literals. It serves as the single source of truth for operation metadata, type signatures, and implementations, enabling both the interpreter and compiler to execute operations consistently.

## Architecture

### Core Registry Class
**Location**: [`/src/registry/registry.ts`](../../src/registry/registry.ts)

The `Registry` class manages all registered operations using static methods:

```typescript
export class Registry {
  private static operations = new Map<string, Operation>();
  private static tokenToOperation = new Map<TokenType, Operation>();
  private static prefixOperators = new Map<TokenType, Operator>();
  private static infixOperators = new Map<TokenType, Operator>();
  private static postfixOperators = new Map<TokenType, Operator>();
  private static precedenceTable = new Map<TokenType, number>();
  private static literals: Literal[] = [];
  private static keywords = new Set<string>();
  
  static register(op: Operation) {
    this.operations.set(op.name, op);
    
    // Type-based registration
    switch (op.kind) {
      case 'operator':
        // Register by form to handle operators with same token but different forms
        if (op.syntax.form === 'prefix') {
          this.prefixOperators.set(op.syntax.token, op);
        } else if (op.syntax.form === 'infix') {
          this.infixOperators.set(op.syntax.token, op);
        } else if (op.syntax.form === 'postfix') {
          this.postfixOperators.set(op.syntax.token, op);
        }
        
        // Register keyword operators (and, or, not, etc.)
        if (/^[a-z]+$/.test(op.name)) {
          this.keywords.add(op.name);
        }
        break;
        
      case 'literal':
        this.literals.push(op);
        // Register keyword literals
        if (op.syntax.keywords) {
          op.syntax.keywords.forEach(kw => this.keywords.add(kw));
        }
        break;
        
      case 'function':
        // Functions don't need special registration
        break;
    }
  }
  
  static get(name: string): Operation | undefined {
    return this.operations.get(name);
  }
  
  static getByToken(token: TokenType, form?: 'prefix' | 'infix' | 'postfix'): Operation | undefined {
    if (form === 'prefix') {
      return this.prefixOperators.get(token);
    } else if (form === 'infix') {
      return this.infixOperators.get(token);
    } else if (form === 'postfix') {
      return this.postfixOperators.get(token);
    }
    // Default fallback
    return this.tokenToOperation.get(token);
  }
}
```

### Operation Metadata Types
**Location**: [`/src/registry/types.ts`](../../src/registry/types.ts)

Each operation type has specific metadata:

```typescript
// Base interface for all operations
export interface BaseOperation {
  name: string;
  
  // Common lifecycle methods
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]) => TypeInfo;
  evaluate: (interpreter: Interpreter, context: RuntimeContext, input: any[], ...args: any[]) => EvaluationResult;
  compile: (compiler: Compiler, input: CompiledExpression, args: CompiledExpression[]) => CompiledExpression;
}

// Operator-specific interface
export interface Operator extends BaseOperation {
  kind: 'operator';
  
  syntax: {
    form: 'prefix' | 'infix' | 'postfix';
    token: TokenType;
    precedence: number;
    associativity?: 'left' | 'right';  // For infix operators
    notation: string;  // e.g., "a + b", "not a"
    special?: boolean;  // For special forms like . and []
    endToken?: TokenType;  // For bracketed operators like []
  };
  
  signature: {
    parameters: [OperatorParameter] | [OperatorParameter, OperatorParameter];  // Unary or binary
    output: {
      type: TypeInferenceRule;
      cardinality: CardinalityInferenceRule;
    };
    propagatesEmpty?: boolean;
  };
}

// Function-specific interface
export interface Function extends BaseOperation {
  kind: 'function';
  
  syntax: {
    notation: string;  // e.g., "substring(start [, length])"
  };
  
  signature: {
    input?: {
      types?: TypeConstraint;
      cardinality?: 'singleton' | 'collection' | 'any';
    };
    parameters: FunctionParameter[];
    output: {
      type: TypeInferenceRule;
      cardinality: CardinalityInferenceRule;
    };
    propagatesEmpty?: boolean;
    deterministic?: boolean;
  };
}

// Literal-specific interface
export interface Literal extends BaseOperation {
  kind: 'literal';
  
  syntax: {
    pattern?: RegExp;      // For complex literals like dates
    keywords?: string[];   // For keyword literals like 'true', 'false'
    notation: string;      // Example: "123", "@2023-01-01"
  };
  
  // Literals have fixed output type
  signature: {
    output: {
      type: string;  // Always a specific type
      cardinality: 'singleton';  // Literals are always singleton
    };
  };
  
  // Parse the literal value from source text
  parse: (value: string) => any;
}

// Union type for registry
export type Operation = Operator | Function | Literal;
```

## Operation Categories

### Arithmetic Operations
**Location**: [`/src/registry/operations/arithmetic.ts`](../../src/registry/operations/arithmetic.ts)

Mathematical operators with type coercion:

```typescript
export const plusOperator: Operator = {
  name: '+',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.PLUS,
    precedence: 5,
    associativity: 'left',
    notation: 'a + b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal', 'String', 'Date', 'DateTime', 'Time'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal', 'String', 'Quantity'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'promote-numeric',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: function(analyzer, input, args) {
    // First run default validation
    const result = defaultOperatorAnalyze.call(this, analyzer, input, args);
    
    // Additional validation: both operands should be same "category" (numeric vs string)
    const leftType = args[0]?.type;
    const rightType = args[1]?.type;
    
    const isLeftString = leftTypeName === 'String';
    const isRightString = rightTypeName === 'String';
    const isLeftNumeric = ['Integer', 'Decimal'].includes(leftTypeName);
    const isRightNumeric = ['Integer', 'Decimal'].includes(rightTypeName);
    
    // If one is string and other is numeric, that's an error
    if ((isLeftString && isRightNumeric) || (isLeftNumeric && isRightString)) {
      analyzer.error(`Operator '+' cannot be applied to types ${leftTypeName} and ${rightTypeName}`);
    }
    
    return result;
  },
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    // String concatenation
    if (typeof l === 'string' || typeof r === 'string') {
      return { value: [String(l) + String(r)], context };
    }
    
    // Numeric addition
    return { value: [l + r], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0]?.fn(ctx) || [];
      const right = args[1]?.fn(ctx) || [];
      if (left.length === 0 || right.length === 0) return [];
      
      const l = toSingleton(left);
      const r = toSingleton(right);
      
      if (typeof l === 'string' || typeof r === 'string') {
        return [String(l) + String(r)];
      }
      
      return [l + r];
    },
    type: promoteNumericType(args[0]?.type, args[1]?.type),
    isSingleton: true
  })
};
```

Each operator defines:
- **syntax**: Token type, precedence, and notation
- **signature**: Parameter types and output type
- **analyze**: Type checking logic
- **evaluate**: Runtime evaluation
- **compile**: Compilation to closure

### Logical Operations
**Location**: [`/src/registry/operations/logical.ts`](../../src/registry/operations/logical.ts)

Three-valued logic implementation:

```typescript
export const andOperator: Operator = {
  name: 'and',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.AND,
    precedence: 3,
    associativity: 'left',
    notation: 'a and b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'any' }, cardinality: 'any' },
      { name: 'right', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false // Special three-valued logic
  },
  
  evaluate: (interpreter, context, input, left, right) => {
    // Three-valued logic for and:
    // true and true = true
    // true and false = false
    // true and empty = empty
    // false and anything = false
    // empty and true = empty
    // empty and false = false
    // empty and empty = empty
    
    const leftEmpty = left.length === 0;
    const rightEmpty = right.length === 0;
    
    if (!leftEmpty) {
      const leftBool = toBoolean(toSingleton(left));
      if (!leftBool) {
        // false and anything = false
        return { value: [false], context };
      }
      // left is true
      if (rightEmpty) {
        // true and empty = empty
        return { value: [], context };
      }
      // true and right
      const rightBool = toBoolean(toSingleton(right));
      return { value: [rightBool], context };
    }
    
    // left is empty
    if (rightEmpty) {
      // empty and empty = empty
      return { value: [], context };
    }
    
    const rightBool = toBoolean(toSingleton(right));
    if (!rightBool) {
      // empty and false = false
      return { value: [false], context };
    }
    // empty and true = empty
    return { value: [], context };
  }
};
```

The logical operators implement FHIRPath's three-valued logic where empty collections represent "unknown".

### Other Operation Categories

The registry contains many more operation categories:

- **Comparison Operations** ([`/src/registry/operations/comparison.ts`](../../src/registry/operations/comparison.ts)): Equality and ordering operators with proper type handling
- **Collection Operations** ([`/src/registry/operations/collection.ts`](../../src/registry/operations/collection.ts)): Functions like `first()`, `last()`, `tail()`, `take()`, `skip()`
- **Filtering Operations** ([`/src/registry/operations/filtering.ts`](../../src/registry/operations/filtering.ts)): `where()` and `select()` for filtering and projection
- **String Operations** ([`/src/registry/operations/string.ts`](../../src/registry/operations/string.ts)): String manipulation like `startsWith()`, `contains()`, `replace()`
- **Type Operations** ([`/src/registry/operations/type-checking.ts`](../../src/registry/operations/type-checking.ts)): `is` and `as` operators for type checking
- **Math Operations** ([`/src/registry/operations/math.ts`](../../src/registry/operations/math.ts)): Mathematical functions like `abs()`, `ceiling()`, `floor()`
- **Existence Operations** ([`/src/registry/operations/existence.ts`](../../src/registry/operations/existence.ts)): `exists()`, `empty()`, `count()`
- **Utility Operations** ([`/src/registry/operations/utility.ts`](../../src/registry/operations/utility.ts)): `trace()`, `defineVariable()`

## Utility Functions
**Location**: [`/src/registry/utils/`](../../src/registry/utils/)

### Evaluation Helper Utilities
**Location**: [`/src/registry/utils/evaluation-helpers.ts`](../../src/registry/utils/evaluation-helpers.ts)

```typescript
/**
 * Convert collection to singleton value
 */
export function toSingleton(collection: any[]): any {
  return CollectionUtils.toSingleton(collection);
}

/**
 * Convert value to boolean according to FHIRPath rules
 */
export function toBoolean(value: any): boolean {
  // Handle direct boolean
  if (typeof value === 'boolean') {
    return value;
  }
  
  // Handle null/undefined as false
  if (value == null) {
    return false;
  }
  
  // Handle empty string as false
  if (value === '') {
    return false;
  }
  
  // Handle zero as false
  if (value === 0) {
    return false;
  }
  
  // Everything else is true
  return true;
}

/**
 * Determines if a value is truthy according to FHIRPath rules
 */
export function isTruthy(value: any[]): boolean {
  if (value.length === 0) {
    return false;
  }
  
  // Convert to singleton
  const singleton = toSingleton(value);
  
  // Rule: true if singleton is true, false if singleton is false
  if (typeof singleton === 'boolean') {
    return singleton;
  }
  
  // Rule: singleton exists and is not false = true
  return singleton !== undefined;
}

/**
 * Checks if two values are equivalent for FHIRPath comparison
 */
export function isEquivalent(a: any, b: any): boolean {
  // Handle null/undefined
  if (a === b) return true;
  if (a == null || b == null) return false;
  
  // Handle different types
  if (typeof a !== typeof b) return false;
  
  // Handle primitives
  if (typeof a !== 'object') return a === b;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEquivalent(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects (deep comparison)
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isEquivalent(a[key], b[key])) return false;
  }
  
  return true;
}
```

### Type System Utilities
**Location**: [`/src/registry/utils/type-system.ts`](../../src/registry/utils/type-system.ts)

The TypeSystem provides type checking and casting functionality:

```typescript
export enum PrimitiveType {
  Boolean = 'Boolean',
  String = 'String',
  Integer = 'Integer',
  Decimal = 'Decimal',  
  Date = 'Date',
  DateTime = 'DateTime',
  Time = 'Time',
  Quantity = 'Quantity'
}

export class TypeSystem {
  /**
   * Check if a value is of a specific type
   */
  static isType(value: any, typeName: string): boolean {
    // Handle primitive types
    if (this.primitiveTypes.has(typeName)) {
      return this.isPrimitiveType(value, typeName as PrimitiveType);
    }
    
    // Handle FHIR resource types
    if (typeof value === 'object' && value !== null) {
      return value.resourceType === typeName;
    }
    
    return false;
  }
  
  /**
   * Cast a value to a specific type (returns null if cast fails)
   */
  static cast(value: any, typeName: string): any | null {
    // If already the correct type, return as-is
    if (this.isType(value, typeName)) {
      return value;
    }
    
    // Handle FHIR resource casting
    if (!this.primitiveTypes.has(typeName)) {
      // Can't cast between different resource types
      return null;
    }
    
    // Handle primitive type casting
    return this.castToPrimitive(value, typeName as PrimitiveType);
  }
  
  /**
   * Get type information for a value
   */
  static getType(value: any): TypeInfo {
    // Check primitive types
    if (typeof value === 'boolean') {
      return { name: PrimitiveType.Boolean, isPrimitive: true };
    }
    if (typeof value === 'string') {
      // Check for specific string formats
      if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) {
        return { name: PrimitiveType.Date, isPrimitive: true };
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return { name: PrimitiveType.DateTime, isPrimitive: true };
      }
      if (/^\d{2}:\d{2}:\d{2}/.test(value)) {
        return { name: PrimitiveType.Time, isPrimitive: true };
      }
      return { name: PrimitiveType.String, isPrimitive: true };
    }
    if (typeof value === 'number') {
      return { 
        name: Number.isInteger(value) ? PrimitiveType.Integer : PrimitiveType.Decimal, 
        isPrimitive: true 
      };
    }
    
    // Check for FHIR resources
    if (typeof value === 'object' && value !== null) {
      if (value.resourceType) {
        return { name: value.resourceType, isPrimitive: false, isResource: true };
      }
      if (typeof value.value === 'number' && (value.unit || value.code)) {
        return { name: PrimitiveType.Quantity, isPrimitive: true };
      }
    }
    
    return { name: 'Unknown', isPrimitive: false };
  }
}
```

## Registration Process

### Default Registry Initialization
**Location**: [`/src/registry/index.ts`](../../src/registry/index.ts)

The registry is populated automatically when the module loads:

```typescript
// Register all operations on module load
[
  ...arithmeticOperators,
  ...logicalOperators,
  ...comparisonOperators,
  ...membershipOperators,
  ...typeOperators,
  ...collectionOperators,
  ...literals,
  ...existenceFunctions,
  aggregateFunction,
  childrenFunction,
  descendantsFunction,
  iifFunction,
  defineVariableFunction,
  traceFunction,
  checkFunction,
  typeFunction,
  isFunction,
  asFunction,
  absFunction,
  roundFunction,
  sqrtFunction,
  whereFunction,
  selectFunction,
  ofTypeFunction,
  repeatFunction,
  containsFunction,
  lengthFunction,
  substringFunction,
  startsWithFunction,
  endsWithFunction,
  upperFunction,
  lowerFunction,
  indexOfFunction,
  replaceFunction,
  splitFunction,
  joinFunction,
  trimFunction,
  toCharsFunction,
  toStringFunction,
  toIntegerFunction,
  toDecimalFunction,
  toBooleanFunction,
  toQuantityFunction,
  tailFunction,
  skipFunction,
  takeFunction,
  unionFunction,
  combineFunction,
  intersectFunction,
  excludeFunction
].forEach(op => Registry.register(op));
```

All operations are automatically registered when the module is imported, providing a complete FHIRPath implementation out of the box.

## Usage Example

```typescript
import { Registry } from './registry/registry';

// Registry is populated automatically when imported
// Look up an operator by name
const plusOp = Registry.get('+');
console.log(plusOp?.name); // "+"

// Look up an operator by token and form
const prefixMinusOp = Registry.getByToken(TokenType.MINUS, 'prefix');
console.log(prefixMinusOp?.name); // "unary-"

// Check if a word is a keyword
console.log(Registry.isKeyword('and')); // true
console.log(Registry.isKeyword('foo')); // false

// Get precedence for a token
console.log(Registry.getPrecedence(TokenType.STAR)); // 6

// Match a literal
const literal = Registry.matchLiteral('true');
console.log(literal?.value); // true

// Get all functions
const functions = Registry.getAllFunctions();
console.log(functions.map(f => f.name)); // ['where', 'select', 'contains', ...]

// Clear registry (useful for testing)
Registry.clear();

// Re-register specific operations
Registry.register(plusOperator);
Registry.register(whereFunction);
```

## Integration Points

The registry integrates with:
- **Analyzer**: Provides type signatures for validation
- **Interpreter**: Supplies evaluate functions for execution
- **Compiler**: Provides compile functions for code generation
- **API**: Exposes registry for custom extensions