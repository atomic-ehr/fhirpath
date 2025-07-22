# ADR-007: Unified Operations Registry

## Status

Proposed

## Context

Currently, operators, functions, and literals are handled separately across the FHIRPath implementation, but they are fundamentally related - they all produce typed values in the expression tree:

1. **Functions** have a partial registry (`FunctionRegistry`) with signature definitions
2. **Operators** are scattered across multiple files:
   - Parser has precedence table (`PRECEDENCE`)
   - Interpreter uses `Operators` class with switch statements
   - Analyzer has separate operator signature lookups
   - Compiler will need to duplicate this logic
3. **Literals** are handled inline in the parser/interpreter with no central type definitions:
   - Boolean literals: `true`, `false`
   - Numeric literals: integers, decimals with parsing logic scattered
   - String literals: with escape sequence handling
   - DateTime/Time/Date literals: with format parsing
   - Quantity literals: with unit parsing

This separation leads to:
- Code duplication
- Inconsistent handling of operations
- Difficulty adding new operators
- Multiple sources of truth for operator behavior

## Decision

Unify operators, functions, and literals into a single registry. All are operations that produce typed values in the expression tree.

### Hierarchical Operation Structure

```typescript
// Base interface for all operations
interface BaseOperation {
  name: string;
  
  // Common lifecycle methods
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]) => TypeInfo;
  evaluate: (interpreter: Interpreter, context: Context, input: any[], ...args: any[]) => EvaluationResult;
  compile: (compiler: Compiler, input: CompiledExpression, args: CompiledExpression[]) => CompiledExpression;
}

// Operator-specific interface
interface Operator extends BaseOperation {
  kind: 'operator';
  
  syntax: {
    form: 'prefix' | 'infix' | 'postfix';
    token: TokenType;
    precedence: number;
    associativity?: 'left' | 'right';  // For infix operators
    notation: string;  // e.g., "a + b", "not a"
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
interface Function extends BaseOperation {
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
interface Literal extends BaseOperation {
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
type Operation = Operator | Function | Literal;

// Specialized parameter types
interface OperatorParameter {
  name: 'left' | 'right' | 'operand';
  types?: TypeConstraint;
  cardinality?: 'singleton' | 'collection' | 'any';  // Required cardinality for this parameter
}

interface FunctionParameter {
  name: string;
  kind: 'value' | 'expression' | 'type-specifier';
  types?: TypeConstraint;
  cardinality?: 'singleton' | 'collection' | 'any';
  optional?: boolean;
  default?: any;
}

interface TypeConstraint {
  kind: 'primitive' | 'class' | 'union' | 'any';
  types?: string[];  // ['Integer', 'Decimal'] for numeric, ['Resource'] for FHIR types
}

type TypeInferenceRule = 
  | string  // Fixed type like 'Boolean'
  | 'preserve-input'  // Returns input type
  | 'promote-numeric'  // Integer + Decimal = Decimal
  | ((input: TypeRef, args: TypeRef[], provider: ModelProvider) => TypeRef);

type CardinalityInferenceRule = 
  | 'singleton' | 'collection'
  | 'preserve-input'  // Same as input
  | 'all-singleton'  // Singleton only if all inputs are singleton
  | ((input: boolean, args: boolean[]) => boolean);

// Closure-based compiled expression
interface CompiledExpression {
  // The compiled function
  fn: (context: RuntimeContext) => any[];
  
  // Type information for optimization
  type: TypeRef;
  isSingleton: boolean;
  
  // For debugging/tracing
  source?: string;
}

interface RuntimeContext {
  input: any[];
  env: Record<string, any>;
  focus?: any;
}
```

### Implementation Approach

1. **Create new unified registry** for all operations
2. **Define operations with proper types**:
   ```typescript
   // src/registry/operations/arithmetic.ts
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
         { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' },
         { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
       ],
       output: {
         type: 'promote-numeric',
         cardinality: 'singleton'  // Always returns singleton for arithmetic
       },
       propagatesEmpty: true
     },
     
     analyze: defaultOperatorAnalyze,  // Uses signature for validation
     
     evaluate: (interpreter, context, input, left, right) => {
       if (left.length === 0 || right.length === 0) return { value: [], context };
       const l = toSingleton(left);
       const r = toSingleton(right);
       return { value: [l + r], context };
     },
     
     compile: (compiler, input, args) => ({
       fn: (ctx) => {
         const left = args[0].fn(ctx);
         const right = args[1].fn(ctx);
         if (left.length === 0 || right.length === 0) return [];
         return [toSingleton(left) + toSingleton(right)];
       },
       type: promoteNumericType(args[0].type, args[1].type),
       isSingleton: args[0].isSingleton && args[1].isSingleton,
       source: `${args[0].source} + ${args[1].source}`
     })
   };
   
   // Function example
   export const substringFunction: Function = {
     name: 'substring',
     kind: 'function',
     
     syntax: {
       notation: 'substring(start [, length])'
     },
     
     signature: {
       input: {
         types: { kind: 'primitive', types: ['String'] },
         cardinality: 'singleton'
       },
       parameters: [
         { name: 'start', kind: 'value', types: { kind: 'primitive', types: ['Integer'] }, cardinality: 'singleton' },
         { name: 'length', kind: 'value', types: { kind: 'primitive', types: ['Integer'] }, cardinality: 'singleton', optional: true }
       ],
       output: {
         type: 'String',
         cardinality: 'singleton'
       },
       propagatesEmpty: true,
       deterministic: true
     },
     
     analyze: defaultFunctionAnalyze,
     
     evaluate: (interpreter, context, input, start, length) => {
       if (input.length === 0) return { value: [], context };
       const str = toSingleton(input);
       const result = length !== undefined 
         ? str.substring(start, start + length)
         : str.substring(start);
       return { value: [result], context };
     },
     
     compile: (compiler, input, args) => ({
       fn: (ctx) => {
         const str = input.fn(ctx);
         if (str.length === 0) return [];
         const s = toSingleton(str);
         const start = toSingleton(args[0].fn(ctx));
         const length = args[1] ? toSingleton(args[1].fn(ctx)) : undefined;
         return [length !== undefined ? s.substring(start, start + length) : s.substring(start)];
       },
       type: compiler.resolveType('String'),
       isSingleton: true,
       source: `${input.source}.substring(${args.map(a => a.source).join(', ')})`
     })
   };
   
   // Unary operator example
   export const notOperator: Operator = {
     name: 'not',
     kind: 'operator',
     
     syntax: {
       form: 'prefix',
       token: TokenType.NOT,
       precedence: 3,
       notation: 'not a'
     },
     
     signature: {
       parameters: [
         { name: 'operand', types: { kind: 'any' }, cardinality: 'any' }  // Accepts any cardinality
       ],
       output: {
         type: 'Boolean',
         cardinality: 'preserve-input'  // Output cardinality matches input
       },
       propagatesEmpty: false  // not empty = true
     },
     
     analyze: defaultOperatorAnalyze,
     evaluate: /* implementation */,
     compile: /* implementation */
   };
   
   // Collection operator example
   export const unionOperator: Operator = {
     name: '|',
     kind: 'operator',
     
     syntax: {
       form: 'infix',
       token: TokenType.PIPE,
       precedence: 7,
       associativity: 'left',
       notation: 'a | b'
     },
     
     signature: {
       parameters: [
         { name: 'left', types: { kind: 'any' }, cardinality: 'any' },  // Any cardinality
         { name: 'right', types: { kind: 'any' }, cardinality: 'any' }  // Any cardinality
       ],
       output: {
         type: 'preserve-input',  // Union preserves element types
         cardinality: 'collection'  // Always returns collection
       },
       propagatesEmpty: false  // Union of empty collections is empty collection
     },
     
     analyze: defaultOperatorAnalyze,
     evaluate: /* implementation */,
     compile: /* implementation */
   };
   
   // Literal examples
   export const integerLiteral: Literal = {
     name: 'integer-literal',
     kind: 'literal',
     
     syntax: {
       pattern: /^-?\d+$/,
       notation: '123'
     },
     
     signature: {
       output: {
         type: 'Integer',
         cardinality: 'singleton'
       }
     },
     
     parse: (value: string) => parseInt(value, 10),
     
     analyze: (analyzer, input, args) => ({
       type: analyzer.resolveType('Integer'),
       isSingleton: true
     }),
     
     evaluate: (interpreter, context, input, value) => ({
       value: [value],  // value comes from parse()
       context
     }),
     
     compile: (compiler, input, args) => {
       // Note: 'value' is captured in closure from parse()
       const value = this.parse(/* raw text from AST */);
       return {
         fn: (ctx) => [value],
         type: compiler.resolveType('Integer'),
         isSingleton: true,
         source: value.toString()
       };
     }
   };
   
   export const trueLiteral: Literal = {
     name: 'true',
     kind: 'literal',
     
     syntax: {
       keywords: ['true'],
       notation: 'true'
     },
     
     signature: {
       output: { 
         type: 'Boolean', 
         cardinality: 'singleton' 
       }
     },
     
     parse: () => true,
     analyze: (analyzer) => ({ type: analyzer.resolveType('Boolean'), isSingleton: true }),
     evaluate: (interpreter, context) => ({ value: [true], context }),
     compile: (compiler) => ({
       fn: (ctx) => [true],
       type: compiler.resolveType('Boolean'),
       isSingleton: true,
       source: 'true'
     })
   };
   // Similar for falseLiteral
   
   export const dateTimeLiteral: Literal = {
     name: 'datetime-literal',
     kind: 'literal',
     
     syntax: {
       pattern: /@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/,
       notation: '@2023-01-01T12:00:00Z'
     },
     
     signature: {
       output: { 
         type: 'DateTime', 
         cardinality: 'singleton' 
       }
     },
     
     parse: (value: string) => {
       // Remove @ prefix and parse ISO date
       return new Date(value.substring(1));
     },
     
     analyze: defaultLiteralAnalyze,
     evaluate: (interpreter, context, input, value) => ({ value: [value], context }),
     compile: (compiler, input, args) => {
       const value = this.parse(/* raw text from AST */);
       return {
         fn: (ctx) => [value],
         type: compiler.resolveType('DateTime'),
         isSingleton: true,
         source: `@${value.toISOString()}`
       };
     }
   };
   ```

3. **Registry manages all operations uniformly**:
   ```typescript
   // src/registry/index.ts
   export class Registry {
     private static operations = new Map<string, Operation>();
     private static tokenToOperation = new Map<TokenType, Operation>();
     private static precedenceTable = new Map<TokenType, number>();
     private static literals: Operation[] = [];
     private static keywords = new Set<string>();
     
     static register(op: Operation) {
       this.operations.set(op.name, op);
       
       // Type-based registration
       switch (op.kind) {
         case 'operator':
           this.tokenToOperation.set(op.syntax.token, op);
           this.precedenceTable.set(op.syntax.token, op.syntax.precedence);
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
     
     static getByToken(token: TokenType): Operation | undefined {
       return this.tokenToOperation.get(token);
     }
     
     static getPrecedence(token: TokenType): number {
       return this.precedenceTable.get(token) ?? 0;
     }
     
     static isKeyword(word: string): boolean {
       return this.keywords.has(word);
     }
     
     static getLiterals(): Operation[] {
       return this.literals;
     }
     
     static matchLiteral(text: string): { operation: Operation; value: any } | null {
       for (const literal of this.literals) {
         if (literal.syntax.pattern && literal.syntax.pattern.test(text)) {
           return {
             operation: literal,
             value: literal.parse!(text)
           };
         }
       }
       return null;
     }
   }
   ```

4. **Auto-registration on module load**:
   ```typescript
   // src/registry/operations/index.ts
   import { arithmeticOperators } from './arithmetic';
   import { logicalOperators } from './logical';
   import { stringFunctions } from './string';
   
   // Register all operations on module load
   [...arithmeticOperators, ...logicalOperators, ...stringFunctions]
     .forEach(op => OperationRegistry.register(op));
   ```

5. **Component usage patterns**:

   **Lexer** - uses registry for keywords and literals:
   ```typescript
   class Lexer {
     private scanToken(): Token {
       // Try to match literals first
       const literalMatch = Registry.matchLiteral(this.remaining());
       if (literalMatch) {
         return {
           type: TokenType.LITERAL,
           value: literalMatch.value,
           operation: literalMatch.operation,
           // ...
         };
       }
       
       // For identifiers, check if it's a keyword
       if (this.isIdentifierStart()) {
         const word = this.scanIdentifier();
         if (Registry.isKeyword(word)) {
           // It's a keyword operator or literal
           const op = Registry.get(word);
           return {
             type: op?.syntax.token || TokenType.KEYWORD,
             value: word,
             operation: op,
             // ...
           };
         }
         return { type: TokenType.IDENTIFIER, value: word, /* ... */ };
       }
       
       // Regular operator tokens...
     }
   }
   ```

   **Parser** - uses registry for precedence and special forms:
   ```typescript
   class Parser {
     private getPrecedence(token: Token): number {
       return Registry.getPrecedence(token.type);
     }
     
     private isSpecialForm(token: Token): boolean {
       const op = Registry.getByToken(token.type);
       return op?.syntax.special || false;
     }
   }
   ```

   **Analyzer** - unified handling for all operations:
   ```typescript
   class Analyzer {
     private analyzeOperation(op: Operation, input: TypeInfo, args: TypeInfo[]): TypeInfo {
       return op.analyze(this, input, args);
     }
     
     private analyzeBinary(node: BinaryNode, input: TypeInfo): TypeInfo {
       const op = Registry.getByToken(node.operator);
       if (!op) throw new Error(`Unknown operator: ${node.operator}`);
       
       const left = this.analyze(node.left, input);
       const right = this.analyze(node.right, left);
       
       return this.analyzeOperation(op, input, [left, right]);
     }
     
     private analyzeFunction(node: FunctionNode, input: TypeInfo): TypeInfo {
       const op = Registry.get(node.name);
       if (!op) throw new Error(`Unknown function: ${node.name}`);
       
       const args = node.args.map(arg => this.analyze(arg, input));
       return this.analyzeOperation(op, input, args);
     }
   }
   ```

   **Interpreter** - same unified approach:
   ```typescript
   class Interpreter {
     private evaluateOperation(op: Operation, input: any[], context: Context, args: any[]): EvaluationResult {
       return op.evaluate(this, context, input, ...args);
     }
     
     evaluateBinary(node: BinaryNode, input: any[], context: Context): EvaluationResult {
       const op = Registry.getByToken(node.operator);
       if (!op) throw new Error(`Unknown operator: ${node.operator}`);
       
       const left = this.evaluate(node.left, input, context);
       const right = this.evaluate(node.right, left.value, left.context);
       
       return this.evaluateOperation(op, input, right.context, [left.value, right.value]);
     }
     
     evaluateFunction(node: FunctionNode, input: any[], context: Context): EvaluationResult {
       const op = Registry.get(node.name);
       if (!op) throw new Error(`Unknown function: ${node.name}`);
       
       // Evaluate arguments based on parameter kinds
       const evalArgs = /* evaluate based on op.signature.parameters */;
       
       return this.evaluateOperation(op, input, context, evalArgs);
     }
   }
   ```

   **Compiler** - generates closures instead of strings:
   ```typescript
   class Compiler {
     compileBinary(node: BinaryNode, input: CompiledExpression): CompiledExpression {
       const op = Registry.getByToken(node.operator);
       if (!op) throw new Error(`Unknown operator: ${node.operator}`);
       
       const left = this.compile(node.left, input);
       const right = this.compile(node.right, input);
       
       return op.compile(this, input, [left, right]);
     }
     
     compileLiteral(node: LiteralNode): CompiledExpression {
       const literal = Registry.matchLiteral(node.value);
       if (!literal) throw new Error(`Unknown literal: ${node.value}`);
       
       return literal.operation.compile(this, { fn: () => [], type: null, isSingleton: false }, []);
     }
     
     // Execute compiled expression
     execute(compiled: CompiledExpression, context: RuntimeContext): any[] {
       return compiled.fn(context);
     }
   }
   ```

6. **Default analyzer implementation**:
   ```typescript
   // src/registry/default-analyzer.ts
   export function defaultAnalyze(
     analyzer: Analyzer, 
     input: TypeInfo, 
     args: TypeInfo[]
   ): TypeInfo {
     const def = this as OperationDefinition;
     const { typeInfo } = def;
     
     // Check input type constraints
     if (typeInfo.inputTypes && !matchesConstraint(input.type, typeInfo.inputTypes)) {
       analyzer.error(`${def.name} expects ${formatConstraint(typeInfo.inputTypes)} but got ${input.type}`);
     }
     
     // Check singleton requirements
     if (typeInfo.requiresInputSingleton && !input.isSingleton) {
       analyzer.error(`${def.name} requires singleton input`);
     }
     
     // Validate parameters
     if (typeInfo.parameters) {
       validateParameters(analyzer, args, typeInfo.parameters);
     }
     
     // Determine return type
     const returnType = resolveReturnType(typeInfo.returnType, input, args, analyzer);
     const isSingleton = resolveSingleton(typeInfo.returnsSingleton, input, args);
     
     return { type: returnType, isSingleton };
   }
   ```

7. **Benefits of this approach**:
   - **Single import**: Components only need to import the registry
   - **Type-safe**: TypeScript ensures all operations implement required methods
   - **Declarative type info**: Most operations can use standard signatures
   - **Centralized parsing**: Literal parsing logic in one place
   - **Consistent lexing**: Lexer doesn't need hardcoded literal patterns
   - **Type information**: Every literal has explicit type information
   - **Discoverable**: Can list all available operations programmatically
   - **Extensible**: New literal types can be added to registry
   - **Hot-reloadable**: Operations can be re-registered during development

8. **Closure-based compilation benefits**:
   - **No eval()**: Safer, no code injection risks
   - **Direct execution**: No parsing overhead at runtime
   - **Captured variables**: Can close over constants and helper functions
   - **Optimizable**: JavaScript engines can optimize closures
   - **Debuggable**: Can set breakpoints in compiled code
   - **Type preservation**: TypeScript types flow through compilation

## Consequences

### Positive

- **Better type safety**: Separate interfaces ensure correct properties for each operation type
- **Clearer semantics**: Each operation kind has only the fields it needs
- **Single source of truth**: All type information and behavior in one place
- **Consistent handling**: Unified base interface for common operations
- **Centralized parsing**: Literal parsing logic co-located with type info
- **Easier extensibility**: Add new operations with proper typing
- **Better maintainability**: Clear separation of concerns
- **IDE support**: Better autocomplete and type checking
- **Self-contained**: Each operation fully defines its behavior
- **Reduced errors**: Can't accidentally mix operator/function/literal properties

### Negative

- **Migration effort**: Complete refactor of existing system
- **Larger definitions**: Each operation now contains more code
- **Circular dependencies**: Need careful module organization to avoid cycles

## Alternatives Considered

### 1. Keep Separate Systems
- **Pros**: No migration needed, simpler individual components
- **Cons**: Continued duplication, harder to maintain consistency

### 2. Functions-Only Registry with Operator Wrapper
- **Pros**: Minimal changes to function registry
- **Cons**: Operators become second-class citizens, awkward API

### 3. Complete Rewrite
- **Pros**: Could design ideal system from scratch
- **Cons**: High risk, breaks existing code, time consuming

The unified registry provides the best balance of maintainability, extensibility, and implementation effort.

## Component Requirements Checklist

### Lexer Requirements
- ✅ **Keyword identification**: `Registry.isKeyword(word)`
- ✅ **Literal pattern matching**: `Registry.matchLiteral(text)` 
- ✅ **Literal parsing**: Each literal has `parse()` method
- ✅ **Token type mapping**: Operations store their `token` in `syntax`
- ❓ **Symbol operators**: Need to ensure registry handles `+`, `-`, `*`, etc.
- ❓ **Composite operators**: Need to handle `<=`, `>=`, `!=`, etc.

### Parser Requirements  
- ✅ **Operator precedence**: `Registry.getPrecedence(token)`
- ✅ **Operator associativity**: Stored in `syntax.associativity`
- ✅ **Operator arity**: Can infer from `syntax.form` (prefix/infix/postfix)
- ✅ **Function identification**: `Registry.get(name)` for function calls
- ❓ **Special forms**: Need to handle indexing `[]`, member access `.`
- ❓ **Type specifiers**: Need to handle `is Type` and `as Type`

### Analyzer Requirements
- ✅ **Type signatures**: All operations have `signature` with type info
- ✅ **Parameter types**: `signature.parameters` with type constraints
- ✅ **Input constraints**: `signature.input` for collection operations  
- ✅ **Return type inference**: `signature.output.type` rules
- ✅ **Cardinality inference**: `signature.output.cardinality` rules
- ✅ **Empty propagation**: `signature.propagatesEmpty` flag
- ✅ **Custom analysis**: Each operation has `analyze()` method
- ❓ **Type casting rules**: Need type compatibility/casting information
- ❓ **Polymorphic operations**: Need to handle operations that work on multiple types

### Key Design Decisions

1. **Operator Cardinality Requirements**: Operators specify cardinality constraints on their parameters because:
   - Some operators require singletons (e.g., arithmetic: `+`, `-`, `*`, `/`)
   - Some work with any cardinality (e.g., logical: `and`, `or`, `not`)
   - Some are specifically for collections (e.g., `|` union, `in` membership)
   - The analyzer can validate cardinality before runtime
   - Better error messages: "Operator '+' requires singleton operands"

### Missing Pieces and Solutions

1. **Special syntactic forms** that aren't regular operators:
   ```typescript
   // These can be registered as special operations
   export const memberAccessOp: Operation = {
     name: '.',
     syntax: {
       form: 'infix',
       token: TokenType.DOT,
       precedence: 1,  // Highest
       associativity: 'left',
       special: true  // Flag for parser to handle specially
     },
     // ... rest of definition
   };
   
   export const indexingOp: Operation = {
     name: '[]',
     syntax: {
       form: 'postfix',
       token: TokenType.LBRACKET,  // Start token
       precedence: 2,
       special: true,
       endToken: TokenType.RBRACKET  // End token for parser
     },
     // ... rest of definition
   };
   ```

2. **Composite operators** - Registry can handle multi-character tokens:
   ```typescript
   export const lessThanOrEqualOp: Operation = {
     name: '<=',
     syntax: {
       form: 'infix',
       token: TokenType.LTE,  // Lexer produces this for '<='
       precedence: 8,
       associativity: 'left'
     },
     // ... rest of definition
   };
   ```

3. **Type system integration** - Add to Operation interface:
   ```typescript
   interface Operation {
     // ... existing fields ...
     
     // Type system integration
     typeSystem?: {
       // For polymorphic operations
       polymorphic?: boolean;
       typeResolution?: (types: TypeRef[]) => TypeRef;
       
       // For type cast/test operations
       acceptsTypeSpecifier?: boolean;
       
       // Implicit conversions this operation supports
       implicitConversions?: Array<{
         from: string;
         to: string;
         cost: number;  // For choosing best conversion
       }>;
     };
   }
   ```

4. **Complete Registry API**:
   ```typescript
   export class Registry {
     // ... existing methods ...
     
     // For special forms
     static getSpecialForms(): Operation[] {
       return Array.from(this.operations.values())
         .filter(op => op.syntax.special);
     }
     
     // For type system
     static getPolymorphicOperations(): Operation[] {
       return Array.from(this.operations.values())
         .filter(op => op.typeSystem?.polymorphic);
     }
     
     // Check if token starts a composite operator
     static isCompositeOperatorStart(token: TokenType): boolean {
       // Used by lexer to know when to look ahead
       return [TokenType.LT, TokenType.GT, TokenType.BANG, TokenType.TILDE]
         .includes(token);
     }
   }
   ```