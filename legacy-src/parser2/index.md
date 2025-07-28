# FHIRPath Parser2 - Recursive Descent with Pratt Parsing

This parser implements a recursive-descent parser with Pratt operator precedence parsing for FHIRPath expressions. It's designed to be simple, efficient, and self-contained.

## Architecture Overview

The parser consists of:
- **Lexical Analysis**: Uses `lexer2` to tokenize the input
- **Recursive Descent**: Top-down parsing for primary expressions
- **Pratt Parsing**: Handles operator precedence and associativity
- **AST Construction**: Builds a typed Abstract Syntax Tree

## Parser Flow

### 1. Initialization

```typescript
const parser = new Parser(input);
// 1. Creates a Lexer instance
// 2. Tokenizes entire input upfront
// 3. Stores tokens in array for random access
```

### 2. Main Entry Point

```typescript
parse(): ASTNode
```
- Calls `expression()` to parse the entire input
- Ensures all tokens are consumed (no trailing tokens)
- Returns the root AST node

### 3. Expression Parsing (Pratt Algorithm)

```typescript
parseExpressionWithPrecedence(minPrecedence): ASTNode
```

The core of the parser uses Pratt parsing:

1. **Parse Primary Expression** - Get the left-hand side
2. **Parse Operators Loop** - While we have operators with precedence >= minPrecedence:
   - Consume the operator
   - Parse right-hand side with appropriate precedence
   - Create binary/special nodes

#### Operator Precedence (highest to lowest):

| Precedence | Operators | Associativity |
|------------|-----------|---------------|
| 100 | `.` (member), `[` (index), `(` (call) | Left |
| 90 | `is`, `as` | Left |
| 80 | `*`, `/`, `div`, `mod` | Left |
| 70 | `+`, `-` | Left |
| 60 | `&` | Left |
| 50 | `<`, `>`, `<=`, `>=` | Left |
| 40 | `=`, `!=`, `~`, `!~` | Left |
| 35 | `in`, `contains` | Left |
| 30 | `and` | Left |
| 20 | `or`, `xor` | Left |
| 10 | `implies` | Right |
| 5 | `|` (union) | Left |

### 4. Primary Expression Parsing

```typescript
parsePrimary(): ASTNode
```

Handles atomic expressions:
- **Literals**: Numbers, strings, booleans, null, datetime, time
- **Variables**: `$this`, `$index`, `$total`, `%env`
- **Identifiers**: Simple or delimited (backtick) identifiers
- **Parentheses**: `(expression)`
- **Collections**: `{element1, element2, ...}`
- **Unary Operators**: `+expr`, `-expr`

### 5. Special Constructs

#### Member Access and Function Calls

After parsing `.identifier`, the parser checks if it's followed by `(` to distinguish between:
- Property access: `Patient.name`
- Method call: `Patient.name.where(...)`

```typescript
parseInvocation(): ASTNode
// 1. Parse identifier after dot
// 2. Check for '(' to determine if it's a function call
// 3. Return appropriate node type
```

#### Type Operations

- **Type Test**: `expression is TypeName`
- **Type Cast**: `expression as TypeName`

Both create special node types rather than generic binary operators.

#### Union Operator

The `|` operator is special - it creates/extends a UnionNode with multiple operands:
```typescript
a | b | c  =>  UnionNode { operands: [a, b, c] }
```

### 6. AST Node Types

All AST nodes implement the base `ASTNode` interface:
```typescript
interface ASTNode {
  type: NodeType;
  position: Position;
}
```

Node types include:
- **Identifier**: Simple identifiers like `name`
- **TypeOrIdentifier**: Uppercase identifiers like `Patient`
- **Literal**: Values with type information
- **Binary**: Binary operators with left/right operands
- **Unary**: Unary operators with single operand
- **Function**: Function calls with name and arguments
- **Variable**: Special variables (`$this`, `%env`)
- **Index**: Array/collection indexing
- **Union**: Multiple operands joined by `|`
- **MembershipTest**: `is` operator
- **TypeCast**: `as` operator
- **Collection**: `{}` expressions

## Example Parse Flow

For expression: `Patient.name.where(use = 'official').given`

1. **Primary**: Parse `Patient` → TypeOrIdentifierNode
2. **Dot operator** (precedence 100):
   - Parse `name` → IdentifierNode
   - Create BinaryNode(DOT, Patient, name)
3. **Dot operator**:
   - Parse `where` → IdentifierNode
   - Check for `(` → It's a function call!
   - Parse arguments: `use = 'official'`
   - Create FunctionNode(where, [BinaryNode(EQ, use, 'official')])
   - Create BinaryNode(DOT, Patient.name, where(...))
4. **Dot operator**:
   - Parse `given` → IdentifierNode
   - Create BinaryNode(DOT, Patient.name.where(...), given)

## Key Design Decisions

1. **Tokenize Upfront**: All tokens are generated before parsing begins, allowing lookahead and backtracking if needed.

2. **Pratt Parsing**: Eliminates the need for separate grammar rules for each precedence level, making the parser more maintainable.

3. **Special Node Types**: Instead of generic nodes, specific types like `MembershipTest` and `TypeCast` preserve semantic information.

4. **Self-Contained**: All types are defined within the module, making it independent and easy to understand.

5. **Position Tracking**: Every node includes position information for error reporting and tooling support.

## Usage

```typescript
import { parse } from './parser2';

const ast = parse('Patient.name.given');
console.log(JSON.stringify(ast, null, 2));
```

## Error Handling

The parser throws descriptive errors for:
- Unexpected tokens
- Missing closing delimiters
- Invalid syntax constructs

Errors include the problematic token value for debugging.