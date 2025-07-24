# FHIRPath Implementation Architecture

## Overview

This FHIRPath implementation follows a modular, layered architecture designed for performance, maintainability, and extensibility. The system processes FHIRPath expressions through distinct phases: lexical analysis, parsing, type analysis, and execution (either interpreted or compiled).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Public API Layer                        │
│                    (/src/api/index.ts)                      │
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
        ┌─────────▼─────────┐       ┌─────────▼─────────┐
        │   Type Analyzer   │       │   Expression API   │
        │ (/src/analyzer/)  │       │  (/src/api/)      │
        └─────────┬─────────┘       └───────────────────┘
                  │
        ┌─────────▼─────────┐
        │      Parser       │
        │  (/src/parser/)   │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │      Lexer        │
        │  (/src/lexer/)    │
        └───────────────────┘

              Execution Layer
        ┌─────────────────────────┐
        │                         │
┌───────▼────────┐      ┌─────────▼─────────┐
│  Interpreter   │      │     Compiler      │
│(/src/interpreter/)    │  (/src/compiler/)  │
└───────┬────────┘      └─────────┬─────────┘
        │                         │
        └───────────┬─────────────┘
                    │
        ┌───────────▼────────────┐
        │   Runtime Context      │
        │  (/src/runtime/)       │
        └────────────────────────┘
                    │
        ┌───────────▼────────────┐
        │   Operation Registry   │
        │   (/src/registry/)     │
        └────────────────────────┘
```

## Core Design Principles

### 1. Stream Processing Model
Every operation in FHIRPath processes collections. The implementation treats all values as collections (single values are just collections of size 1), enabling uniform processing throughout the system.

### 2. Three-Valued Logic
Boolean operations implement proper three-valued logic where `null` or empty collections represent "unknown" rather than false, following the FHIRPath specification precisely.

### 3. Dual Execution Modes
The system supports both:
- **Interpreted execution**: Direct AST traversal, better for debugging and dynamic expressions
- **Compiled execution**: Transforms AST to JavaScript closures, optimized for repeated execution

### 4. Performance Optimizations
- Object pooling in lexer to reduce garbage collection pressure
- String interning for common tokens
- Prototype-based context copying for efficient variable management
- Object dispatch instead of switch statements in hot paths

### 5. Type Safety
Comprehensive TypeScript types throughout the codebase ensure compile-time safety and enable better IDE support.

## Component Layers

### Lexical Analysis Layer
**Location**: [`/src/lexer/`](../src/lexer/)

The lexer converts raw FHIRPath expressions into a stream of tokens. It employs several optimizations:
- Character classification tables for O(1) character type lookups
- Object pooling to reuse token objects
- String interning for common identifiers

Key files:
- [`lexer.ts`](../src/lexer/lexer.ts): Main tokenizer implementation
- [`token.ts`](../src/lexer/token.ts): Token type definitions
- [`char-tables.ts`](../src/lexer/char-tables.ts): Character classification tables

### Parsing Layer
**Location**: [`/src/parser/`](../src/parser/)

The parser implements a recursive descent parser that builds Abstract Syntax Trees (AST) from token streams. It handles operator precedence through 13 distinct levels and supports all FHIRPath syntax forms.

Key files:
- [`parser.ts`](../src/parser/parser.ts): Recursive descent parser
- [`ast.ts`](../src/parser/ast.ts): AST node definitions
- [`pprint.ts`](../src/parser/pprint.ts): AST pretty-printing utilities

### Registry Layer
**Location**: [`/src/registry/`](../src/registry/)

The registry system provides a centralized location for all FHIRPath operations (operators, functions, and literals). Each operation includes metadata about its behavior, type signatures, and implementation.

Key components:
- [`registry.ts`](../src/registry/registry.ts): Core registry class
- [`operations/`](../src/registry/operations/): Operation definitions organized by category
- [`utils/`](../src/registry/utils/): Helper utilities for evaluation

### Analysis Layer
**Location**: [`/src/analyzer/`](../src/analyzer/)

The analyzer performs static type checking and validation of FHIRPath expressions before execution. It can integrate with external model providers to validate against specific FHIR profiles.

Key files:
- [`analyzer.ts`](../src/analyzer/analyzer.ts): Main type analyzer
- [`types.ts`](../src/analyzer/types.ts): Type system definitions
- [`model-provider.ts`](../src/analyzer/model-provider.ts): External type information interface

### Execution Layers

#### Interpreter
**Location**: [`/src/interpreter/`](../src/interpreter/)

The interpreter uses a tree-walking approach with object dispatch for performance. It directly evaluates AST nodes following the stream-processing model.

Key files:
- [`interpreter.ts`](../src/interpreter/interpreter.ts): Main interpreter implementation
- [`types.ts`](../src/interpreter/types.ts): Runtime evaluation types

#### Compiler
**Location**: [`/src/compiler/`](../src/compiler/)

The compiler transforms AST into JavaScript closures that maintain FHIRPath semantics while leveraging JavaScript's JIT optimization.

Key files:
- [`compiler.ts`](../src/compiler/compiler.ts): AST to JavaScript transformation
- [`prototype-context-adapter.ts`](../src/compiler/prototype-context-adapter.ts): Context adaptation for compiled code

### Runtime Support
**Location**: [`/src/runtime/`](../src/runtime/)

The runtime layer provides context management using prototype-based inheritance for efficient variable scoping and environment tracking.

Key file:
- [`context.ts`](../src/runtime/context.ts): RuntimeContext implementation

### Public API Layer
**Location**: [`/src/api/`](../src/api/)

The API layer provides clean, user-friendly interfaces for parsing, evaluating, and compiling FHIRPath expressions.

Key files:
- [`index.ts`](../src/api/index.ts): Main entry points
- [`expression.ts`](../src/api/expression.ts): FHIRPathExpression class
- [`builder.ts`](../src/api/builder.ts): Fluent API for building expressions

## Extension Points

### Custom Functions
Users can register custom functions through the registry system, enabling domain-specific operations while maintaining FHIRPath semantics.

### Model Providers
The analyzer supports pluggable model providers for validating expressions against specific FHIR profiles or custom data models.

### Environment Variables
The runtime context supports custom environment variables accessible through the `%` prefix in expressions.

## Performance Considerations

1. **Lexer Optimizations**: Object pooling and string interning reduce memory allocation overhead
2. **Parser Efficiency**: Single-pass parsing with minimal backtracking
3. **Compiled Execution**: Transforms expressions to native JavaScript for JIT optimization
4. **Context Management**: Prototype-based copying avoids deep cloning overhead
5. **Object Dispatch**: Faster than switch statements for operation lookup

## Thread Safety

The implementation is designed to be thread-safe for read operations. Compiled expressions can be safely shared across threads/contexts, while runtime contexts should be created per execution.