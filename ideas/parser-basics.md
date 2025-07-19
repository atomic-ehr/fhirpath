## Page 1: Introduction to Recursive Descent Parsers in TypeScript

### What is a Recursive Descent Parser?
A recursive descent parser in TypeScript involves creating a class with methods for each non-terminal in the grammar. These methods recursively call each other to parse tokens, building an Abstract Syntax Tree (AST).

### Key Setup
Define interfaces for tokens and AST nodes:

```typescript
enum TokenType {
    ID = 'ID',
    EQUALS = '=',
    NUMBER = 'NUMBER',
    EOF = 'EOF'
}

interface Token {
    type: TokenType;
    value: string;
}

interface ASTNode {
    // Base interface for all nodes
    toString(): string;
}

class AssignmentNode implements ASTNode {
    constructor(public left: ASTNode, public right: ASTNode) {}
    toString() { return `${this.left.toString()} = ${this.right.toString()}`; }
}

class IdNode implements ASTNode {
    constructor(public value: string) {}
    toString() { return this.value; }
}

class NumberNode implements ASTNode {
    constructor(public value: number) {}
    toString() { return this.value.toString(); }
}
```

### Simple Parser Example: Basic Assignments (No Operators)
Grammar: `program → stmt`, `stmt → ID '=' number`, `number → NUMBER`

```typescript
class Parser {
    private pos: number = 0;
    constructor(private tokens: Token[]) {}

    private current(): Token {
        return this.pos < this.tokens.length ? this.tokens[this.pos] : { type: TokenType.EOF, value: '' };
    }

    private consume(expected: TokenType): Token {
        const token = this.current();
        if (token.type === expected) {
            this.pos++;
            return token;
        }
        throw new Error(`Expected ${expected}, got ${token.type}`);
    }

    parseProgram(): ASTNode {
        return this.parseStmt();
    }

    parseStmt(): ASTNode {
        const id = this.consume(TokenType.ID);
        this.consume(TokenType.EQUALS);
        const num = this.parseNumber();
        return new AssignmentNode(new IdNode(id.value), num);
    }

    parseNumber(): ASTNode {
        const num = this.consume(TokenType.NUMBER);
        return new NumberNode(parseInt(num.value, 10));
    }
}
```

**Usage Example**:
```typescript
const tokens: Token[] = [
    { type: TokenType.ID, value: 'x' },
    { type: TokenType.EQUALS, value: '=' },
    { type: TokenType.NUMBER, value: '5' }
];
const parser = new Parser(tokens);
const ast = parser.parseProgram();
console.log(ast.toString());  // Output: "x = 5"
```

This demonstrates basic recursive descent. For expressions with operators, we need to handle precedence.

(End of Page 1)

---

## Page 2: Challenges with Expressions and Operator Precedence in TypeScript

### Extending for Expressions
Add more token types and nodes:

```typescript
enum TokenType {
    // ... previous
    PLUS = '+', MINUS = '-', STAR = '*', SLASH = '/',
    LPAREN = '(', RPAREN = ')'
}

class BinaryNode implements ASTNode {
    constructor(public left: ASTNode, public op: string, public right: ASTNode) {}
    toString() { return `(${this.left.toString()} ${this.op} ${this.right.toString()})`; }
}
```

### Naive Implementation for Expressions
Grammar (refactored to avoid left-recursion):
- `expr → term (('+'|'-') term)*`
- `term → factor (('*'|'/') factor)*`
- `factor → NUMBER | '(' expr ')'`

```typescript
// Add to Parser class
parseExpr(): ASTNode {
    let left = this.parseTerm();
    while ([TokenType.PLUS, TokenType.MINUS].includes(this.current().type)) {
        const op = this.consume(this.current().type).value;
        const right = this.parseTerm();
        left = new BinaryNode(left, op, right);
    }
    return left;
}

parseTerm(): ASTNode {
    let left = this.parseFactor();
    while ([TokenType.STAR, TokenType.SLASH].includes(this.current().type)) {
        const op = this.consume(this.current().type).value;
        const right = this.parseFactor();
        left = new BinaryNode(left, op, right);
    }
    return left;
}

parseFactor(): ASTNode {
    if (this.current().type === TokenType.NUMBER) {
        return new NumberNode(parseInt(this.consume(TokenType.NUMBER).value, 10));
    } else if (this.current().type === TokenType.LPAREN) {
        this.consume(TokenType.LPAREN);
        const expr = this.parseExpr();
        this.consume(TokenType.RPAREN);
        return expr;
    }
    throw new Error('Invalid factor');
}
```

**Parsing "1 + 2 * 3"**:
- Tokens: NUMBER(1), +, NUMBER(2), *, NUMBER(3)
- Builds: (1 + (2 * 3))

This works but scales poorly for many precedence levels. Pratt parsing fixes this.

(End of Page 2)

---

## Page 3: Introduction to Pratt Parsing in TypeScript

### Pratt Concepts in TS
Use parselets (functions) for prefix/infix operators, with a precedence map.

Add to enums/interfaces:
```typescript
enum Precedence {
    ASSIGN = 1,
    SUM = 3,
    PRODUCT = 4,
    UNARY = 5  // For prefix like -
}

// Parselet types
type PrefixParselet = (parser: Parser, token: Token) => ASTNode;
type InfixParselet = (parser: Parser, left: ASTNode, token: Token) => ASTNode;

// Maps in Parser class
private prefixParselets: Map<TokenType, PrefixParselet> = new Map();
private infixParselets: Map<TokenType, { parselet: InfixParselet, prec: Precedence }> = new Map();

// Example registration (in constructor or init method)
private initParselets() {
    // Prefix
    this.prefixParselets.set(TokenType.NUMBER, (p, t) => new NumberNode(parseInt(t.value, 10)));
    this.prefixParselets.set(TokenType.MINUS, (p, t) => {
        const right = p.parseExpression(Precedence.UNARY);
        return new BinaryNode(new NumberNode(0), '-', right);  // Unary as 0 - right
    });

    // Infix
    this.infixParselets.set(TokenType.PLUS, { parselet: this.infixSum, prec: Precedence.SUM });
    this.infixParselets.set(TokenType.MINUS, { parselet: this.infixSum, prec: Precedence.SUM });
    this.infixParselets.set(TokenType.STAR, { parselet: this.infixProduct, prec: Precedence.PRODUCT });
    // ... similarly for others
}

private infixSum(parser: Parser, left: ASTNode, token: Token): ASTNode {
    const right = parser.parseExpression(Precedence.SUM);  // Left-assoc: same prec
    return new BinaryNode(left, token.value, right);
}

private infixProduct(parser: Parser, left: ASTNode, token: Token): ASTNode {
    const right = parser.parseExpression(Precedence.PRODUCT);  // Left-assoc
    return new BinaryNode(left, token.value, right);
}
```

### Core Parse Function
```typescript
parseExpression(precedence: Precedence = 0): ASTNode {
    let token = this.consume(this.current().type);
    const prefix = this.prefixParselets.get(token.type);
    if (!prefix) throw new Error(`No prefix for ${token.type}`);
    let left = prefix(this, token);

    while (true) {
        token = this.current();
        const infix = this.infixParselets.get(token.type);
        if (!infix || infix.prec <= precedence) break;
        this.consume(token.type);
        left = infix.parselet(this, left, token);
    }
    return left;
}
```

Call `this.initParselets()` in the constructor. This handles precedence in one function.

(End of Page 3)

---

## Page 4: Implementing Pratt Parsing with Examples in TypeScript

### Adding Right-Associative Operator (e.g., =)
```typescript
// In initParselets
this.infixParselets.set(TokenType.EQUALS, { parselet: this.infixAssign, prec: Precedence.ASSIGN });

// Method
private infixAssign(parser: Parser, left: ASTNode, token: Token): ASTNode {
    const right = parser.parseExpression(Precedence.ASSIGN - 1);  // Right-assoc: prec -1
    return new AssignmentNode(left, right);  // Reuse AssignmentNode
}
```

### Example 1: Parsing "1 + 2 * 3"
- Tokens: NUMBER(1), +, NUMBER(2), *, NUMBER(3)
- `parseExpression(0)`: Prefix NUMBER(1) → left=1
- Infix + (prec=3 >0): Parse right with prec=3 → Prefix NUMBER(2), Infix * (prec=4 >3): Parse right with prec=4 → NUMBER(3)
- Builds: (1 + (2 * 3))

### Example 2: Parsing "a = b = c"
- Tokens: ID(a), =, ID(b), =, ID(c)
- `parseExpression(0)`: Prefix ID(a) → left=a
- Infix = (prec=1 >0): Parse right with prec=0 → Prefix ID(b), Infix = (prec=1 >0): Parse right with prec=0 → ID(c)
- Builds: a = (b = c) — right-associative.

### Full Usage
```typescript
// Extend Parser with initParselets() call in constructor
const tokens: Token[] = [
    { type: TokenType.NUMBER, value: '1' },
    { type: TokenType.PLUS, value: '+' },
    { type: TokenType.NUMBER, value: '2' },
    { type: TokenType.STAR, value: '*' },
    { type: TokenType.NUMBER, value: '3' }
];
const parser = new Parser(tokens);
const ast = parser.parseExpression();
console.log(ast.toString());  // Output: "(1 + (2 * 3))"
```

### Benefits
- Scalable: Add parselets for new operators (e.g., postfix !).
- Typed: TypeScript ensures safety.
- Flexible: Handles unary, binary, etc., in one method.

For a complete repo or advanced features (e.g., postfix), check resources like the Pratt parsing article by less-bug.com.

(End of Page 4 / Tutorial)

### Step-by-Step Example: How Parselets Handle Operator Precedence in Pratt Parsing

In Pratt parsing (top-down operator precedence), **parselets** are small functions or handlers associated with specific tokens (like operators or literals). They encapsulate the logic for parsing that token, including how it binds to operands based on **precedence** (binding strength) and **associativity** (grouping direction, left or right).

- **Prefix parselets** handle the start of an expression (e.g., numbers, unary operators).
- **Infix parselets** handle operators between operands (e.g., +, *), and they use a precedence value to decide how tightly they bind.

Precedence is a numerical value: higher means tighter binding (e.g., * has precedence 4, + has 3, so * binds before +). The core `parseExpression(precedence)` function:
- Parses a prefix to get an initial left operand.
- Loops to apply infix parselets if their precedence is **higher** than the current level.
- Recurses for the right operand with a precedence based on the operator's associativity (same for left-assoc, -1 for right-assoc).

This avoids needing separate grammar rules for each precedence level, unlike naive recursive descent.

I'll use a simple example in pseudo-code (similar to TypeScript from our previous discussion) for an arithmetic expression parser. We'll parse "1 + 2 * 3", which should become `1 + (2 * 3)` due to * having higher precedence than +.

#### Step 1: Define the Setup
- **Tokens**: NUMBER(1), PLUS(+), NUMBER(2), STAR(*), NUMBER(3)
- **Precedence Levels** (higher number = tighter binding):
  - SUM = 3 (for + and - , left-associative)
  - PRODUCT = 4 (for * and / , left-associative)
  - (We'll ignore unary for now; assume all are infix.)
- **Parselets**:
  - **Prefix for NUMBER**: Simply returns a NumberNode with the value.
  - **Infix for +**: Precedence = 3. Parses right operand with precedence 3 (left-assoc), builds BinaryNode(left, "+", right).
  - **Infix for *** : Precedence = 4. Parses right operand with precedence 4 (left-assoc), builds BinaryNode(left, "*", right).
- **Core Function** (pseudo-code):
  ```
  function parseExpression(currentPrec = 0):
      // Parse prefix
      token = consumeNextToken()
      if token is NUMBER:
          left = NumberNode(token.value)
      // ... (handle other prefixes)

      // Loop for infix
      while true:
          nextToken = peekNextToken()
          infix = getInfixParselet(nextToken)
          if not infix or infix.precedence <= currentPrec:
              break  // Stop if operator has equal or lower precedence
          consumeNextToken()
          // Recurse for right with infix's precedence (adjusted for assoc)
          right = parseExpression(infix.precedence)  // For left-assoc
          left = BinaryNode(left, nextToken.value, right)
      return left
  ```

#### Step 2: Start Parsing "1 + 2 * 3" (Initial Call: parseExpression(0))
- **Parse Prefix**:
  - Consume "1" (NUMBER).
  - Prefix parselet for NUMBER: Create `left = NumberNode(1)`.
  - Current AST: `1`

- **Enter Infix Loop** (currentPrec = 0):
  - Peek next: "+" (PLUS).
  - Infix for +: Exists, precedence = 3.
  - Is 3 > 0? Yes → Proceed.
  - Consume "+" .
  - Now parse right operand: Recurse with `parseExpression(3)` (since + is left-assoc, use same precedence=3).
  - Current AST (partial): Waiting to build `1 + [right]`

#### Step 3: Recursive Call - parseExpression(3) for the Right Side of "+"
- **Parse Prefix**:
  - Consume "2" (NUMBER).
  - Prefix parselet: `left = NumberNode(2)` (this is the "left" for this recursive level).
  - Current AST (this level): `2`

- **Enter Infix Loop** (currentPrec = 3):
  - Peek next: "*" (STAR).
  - Infix for *: Exists, precedence = 4.
  - Is 4 > 3? Yes → Proceed.
  - Consume "*" .
  - Parse right operand: Recurse with `parseExpression(4)` ( * is left-assoc, use same=4).
  - Current AST (this level, partial): `2 * [right]`

#### Step 4: Inner Recursive Call - parseExpression(4) for the Right Side of "*"
- **Parse Prefix**:
  - Consume "3" (NUMBER).
  - Prefix parselet: `left = NumberNode(3)`.
  - Current AST (this level): `3`

- **Enter Infix Loop** (currentPrec = 4):
  - Peek next: End of input (no more tokens).
  - No infix → Break loop.
  - Return `3` from this call.

- **Back to Previous Level** (parseExpression(3)):
  - Right = `3` (from recursion).
  - Build `left = BinaryNode(2, "*", 3)` → `(2 * 3)`
  - Infix loop again (still at currentPrec=3):
    - Peek next: End of input.
    - No infix → Break.
  - Return `(2 * 3)` from this call.

#### Step 5: Back to Outer Level - parseExpression(0)
- Right = `(2 * 3)` (from recursion).
- Build `left = BinaryNode(1, "+", (2 * 3))` → `(1 + (2 * 3))`
- Infix loop again (currentPrec=0):
  - Peek next: End of input.
  - No infix → Break.
- Return final AST: `(1 + (2 * 3))`

#### Step 6: Why Precedence Mattered
- The key decision points were the comparisons:
  - For + (outer): 3 > 0 → Allowed it to bind.
  - For * (inner): 4 > 3 → Allowed * to bind tighter inside the right side of +.
  - If we had peeked another + after * (e.g., "1 + 2 * 3 + 4"), the inner loop at prec=3 would see + (prec=3 <= 3? For left-assoc, we could continue if exactly equal, but in standard Pratt, for left-assoc we use > for the loop condition to handle equality via recursion—wait, actually in my pseudo-code it's <= to stop, but implementations vary slightly for assoc).
- Contrast with "1 * 2 + 3":
  - Outer: Parse "1" , then * (4 > 0) → Recurse parseExpression(4) for right: Parse "2" , no higher infix → Build (1 * 2)
  - Then infix + (3 > 0) → Recurse parseExpression(3) for right: Parse "3" , no infix.
  - Result: ((1 * 2) + 3)
  - Here, * bound first because its precedence allowed it to "steal" the binding before + could.

#### Step 7: Handling Associativity Briefly
- For left-assoc (like +): Recurse with same precedence → Allows chaining like 1 + 2 + 3 as (1 + 2) + 3 via the loop.
- For right-assoc (e.g., ^ for exponentiation, prec=5): Recurse with prec-1 → Groups right like 2 ^ 3 ^ 4 as 2 ^ (3 ^ 4).

This step-by-step shows how parselets delegate parsing while using precedence checks to build the correct tree without explicit grammar levels. If you'd like code in TypeScript or another example (e.g., with right-assoc or unary), let me know!