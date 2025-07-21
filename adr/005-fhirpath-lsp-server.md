# ADR-005: FHIRPath Language Server Protocol (LSP) Implementation

## Language Server Protocol Background

The Language Server Protocol (LSP) is a standardized protocol created by Microsoft that defines how development tools (editors/IDEs) communicate with language servers. Language servers provide programming language-specific features like auto-completion, go-to-definition, hover information, and diagnostics.

Before LSP, each editor needed custom integrations for each programming language, creating an M×N complexity problem (M editors × N languages). LSP reduces this to M+N by allowing any LSP-compatible editor to work with any LSP-compatible language server. The protocol uses JSON-RPC for communication, enabling language servers to run as separate processes and serve multiple clients.

## Status

Proposed

## Context

FHIRPath expressions are commonly written in various contexts (FHIR profiles, implementation guides, clinical decision support rules, etc.). Currently, developers lack IDE support when writing these expressions, leading to:

- Syntax errors discovered only at runtime
- Difficulty understanding available functions and their signatures  
- No type checking or validation during development
- Manual lookup of function documentation
- No code completion or navigation features

With our existing parser, interpreter, and type analyzer, we have the foundation to provide rich IDE support through the Language Server Protocol.

## Decision

We will implement a FHIRPath Language Server that provides:

1. **Core Features**:
   - Syntax validation with error recovery
   - Type checking using our existing analyzer
   - Diagnostics with clear error messages

2. **Enhanced Features**:
   - Code completion for functions, properties, and variables
   - Hover information showing types and documentation
   - Function signature help
   - Go to definition for variables
   - Document symbols outline

3. **Architecture**:
   - Use vscode-languageserver for LSP implementation
   - Service-based architecture with clear separation of concerns
   - AST caching for performance
   - Pluggable ModelProvider for different FHIR versions

4. **Implementation Strategy**:
   - Build on existing parser/analyzer infrastructure
   - Add position mapping utilities to AST
   - Enhance parser error recovery for partial expressions
   - Create completion context analyzer

## Consequences

### Positive

- **Developer Experience**: Rich IDE support for FHIRPath expressions
- **Error Prevention**: Catch syntax and type errors during development
- **Productivity**: Code completion and documentation at fingertips
- **Reusability**: LSP works with any LSP-compatible editor (VSCode, Vim, Emacs, etc.)
- **Leverages Existing Work**: Builds on parser/analyzer foundation
- **Standards-Based**: Uses industry-standard protocol

### Negative

- **Complexity**: Adds significant complexity to the project
- **Maintenance**: LSP server needs ongoing maintenance and feature updates
- **Performance**: Must carefully manage caching and incremental updates
- **Testing**: Requires new testing infrastructure for LSP features
- **Documentation**: Need to document LSP features and configuration

## Alternatives Considered

### 1. VSCode Extension Only
Create a VSCode-specific extension without LSP.

**Pros**:
- Simpler implementation
- Direct VSCode API access
- No protocol overhead

**Cons**:
- Limited to VSCode only
- Would need to reimplement for other editors
- Goes against industry best practices

**Decision**: Rejected - LSP provides better long-term value

### 2. Web-based Editor Component
Build a web component with built-in FHIRPath support.

**Pros**:
- Works in any web browser
- Full control over UI/UX
- Could embed in web applications

**Cons**:
- Doesn't integrate with developer's preferred editor
- Significant UI development effort
- Limited to web contexts

**Decision**: Rejected - Developers prefer their own editors

### 3. CLI-based Validation Only
Extend current implementation with CLI validation commands.

**Pros**:
- Simple to implement
- No IDE integration needed
- Can be used in CI/CD pipelines

**Cons**:
- No real-time feedback
- No code completion or hover help
- Poor developer experience

**Decision**: Rejected - Insufficient for development needs

### 4. Simple TextMate Grammar
Provide only syntax highlighting via TextMate grammar.

**Pros**:
- Very simple to implement
- Works with many editors
- No server process needed

**Cons**:
- No semantic features (type checking, completion)
- No error detection beyond basic syntax
- Very limited functionality

**Decision**: Rejected - Doesn't leverage our analyzer capabilities

## Implementation Plan

### First Version (MVP) Features

The initial LSP implementation should focus on core features that provide immediate value:

1. **Syntax Validation**
   - Real-time parsing of FHIRPath expressions
   - Clear error messages with exact positions
   - Error recovery to continue parsing after errors
   - Example: `Patient.name.given[0.` → "Expected ']' after index expression"

2. **Type Checking Diagnostics**
   - Integration with existing type analyzer
   - Show type mismatches as error squiggles
   - Validate function parameter types
   - Example: `Patient.name.given.length()` → "Error: length() not available on collection"

3. **Basic Code Completion**
   - FHIRPath built-in functions (where, select, first, etc.)
   - Context-aware property suggestions based on current type
   - Variable completion ($this, $index, %context)
   - Example: `Patient.` → suggests: name, birthDate, gender, etc.

4. **Hover Information**
   - Show expression type on hover
   - Display function signatures
   - Show property cardinality (0..1, 0..*, 1..1)
   - Example: Hovering over `Patient.name` shows "Type: HumanName[]"

These features provide the most essential IDE support while building on our existing parser and analyzer infrastructure.

### Future Versions

1. **Phase 2 - Enhanced Completion**:
   - Smart completion with type filtering
   - Snippet support for complex expressions
   - Parameter hints while typing

2. **Phase 3 - Navigation**:
   - Go to definition for variables
   - Find all references
   - Document symbols outline

3. **Phase 4 - Advanced Features**:
   - Code formatting
   - Refactoring support
   - Quick fixes for common errors