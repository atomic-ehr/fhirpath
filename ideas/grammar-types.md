# Grammar Types Summary

## Understanding the Notation

Grammar classes use notation like **LL(1)**, **LR(k)**, where:
- **First letter**: Input reading direction (always **L** for Left-to-right)
- **Second letter**: Derivation type
  - **L** = Leftmost derivation (top-down)
  - **R** = Rightmost derivation (bottom-up)
- **Number/Symbol**: Lookahead tokens
  - **(k)** = Fixed k tokens
  - **(*)** = Unlimited adaptive lookahead

## Top-Down Grammars (LL Family)

### LL(1) - Most Common for Hand-Written Parsers
```javascript
// Can decide what to parse by looking at ONE next token
if (peek() === 'if') return parseIfStatement();
if (peek() === 'while') return parseWhileStatement();
```

**Characteristics:**
- ✅ Easy to write by hand (recursive descent)
- ✅ Intuitive to understand
- ❌ Cannot handle left recursion
- ❌ Limited grammar expressiveness

**Use when:** Writing parsers manually, simple languages

### LL(k) - Fixed Multiple Lookahead
```javascript
// Need to look at k tokens to decide
if (peek(0) === 'int' && peek(1) === '[') {
    // It's an array type: int[]
}
```

**Characteristics:**
- ✅ More powerful than LL(1)
- ❌ Still no left recursion
- ❌ Parse time grows with k

**Use when:** LL(1) isn't enough but you know the exact lookahead needed

### LL(*) - Adaptive Unlimited Lookahead
```antlr
// ANTLR can look ahead as far as needed
method : type ID '(' params ')' '{' body '}'
field  : type ID ';'
// Looks ahead to find '(' or ';'
```

**Characteristics:**
- ✅ Very flexible
- ✅ Handles complex grammars
- ❌ No left recursion (but ANTLR auto-rewrites it)
- ⚡ Used by ANTLR parser generator

**Use when:** Using ANTLR, complex grammars

## Bottom-Up Grammars (LR Family)

### LR(0) - No Lookahead for Reduce Decisions
**Characteristics:**
- ❌ Very limited
- ❌ Many conflicts
- 📚 Mainly theoretical interest

### SLR(1) - Simple LR
**Characteristics:**
- ✅ Better than LR(0)
- ❌ Still has conflicts with many grammars
- 📚 Educational stepping stone

### LALR(1) - Lookahead LR
```yacc
expression: expression '+' term    { $$ = $1 + $3; }
         | term                   
         ;
```

**Characteristics:**
- ✅ Handles left recursion naturally
- ✅ Good balance of power and efficiency
- ✅ Smaller parse tables than LR(1)
- ⚡ Used by yacc/bison

**Use when:** Using yacc/bison, need left recursion

### LR(1) - Canonical LR
**Characteristics:**
- ✅ Most powerful deterministic parsing
- ✅ Can parse any unambiguous CFG
- ❌ Large parse tables
- 🔧 Rarely used in practice

## Quick Comparison Chart

| Grammar | Power | Ease of Implementation | Left Recursion | Used By |
|---------|-------|----------------------|----------------|---------|
| LL(1)   | ⭐⭐    | ⭐⭐⭐⭐⭐ (hand-written) | ❌ | Recursive descent |
| LL(k)   | ⭐⭐⭐   | ⭐⭐⭐⭐ | ❌ | Some hand parsers |
| LL(*)   | ⭐⭐⭐⭐  | ⭐⭐⭐ (with ANTLR) | ❌* | ANTLR |
| LALR(1) | ⭐⭐⭐⭐  | ⭐⭐ (generated) | ✅ | yacc, bison |
| LR(1)   | ⭐⭐⭐⭐⭐ | ⭐ | ✅ | Few tools |

*ANTLR automatically rewrites left recursion

## Practical Decision Guide

### Choose LL(1) when:
- Writing a parser by hand
- Grammar is simple
- Want readable parser code
- Building a teaching example

### Choose LL(*)/ANTLR when:
- Grammar is complex
- Want to focus on grammar, not parser code
- Need good error messages
- Building DSLs or languages

### Choose LALR(1)/yacc when:
- Have existing yacc/bison grammar
- Need left recursion
- Working with C/C++
- Building traditional compilers

## Common Grammar Problems and Solutions

### Left Recursion (LL can't handle)
```
// Problem for LL:
expr → expr '+' term

// Solution: rewrite with iteration
expr → term ('+' term)*
```

### First/First Conflicts (need more lookahead)
```
// Problem for LL(1):
statement → ID '=' expr
         | ID '(' args ')'

// Need LL(2) to see past ID
```

### Ambiguity (problem for all)
```
// Classic dangling else
if E then if E then S else S
// Which 'if' does 'else' belong to?
```

## Real-World Examples

- **LL(1)**: Most hand-written parsers, simple config files
- **LL(*)**: ANTLR grammars (Java, C#, many DSLs)
- **LALR(1)**: C (gcc), C++ (g++), many programming languages
- **LL(k)**: FHIRPath, some SQL dialects

The key takeaway: **LL grammars** are natural for hand-writing and top-down thinking, while **LR grammars** are more powerful but require parser generators. Modern tools like ANTLR blur the lines by making powerful parsing accessible.