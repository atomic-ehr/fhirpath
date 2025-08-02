# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the FHIRPath TypeScript implementation project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences.

## ADR Structure

Each ADR is a markdown file following the naming convention: `NNN-title-with-dashes.md`

Where NNN is a sequential number (001, 002, etc.).

## ADR Sections

1. **Title**: Short noun phrase
2. **Status**: Proposed, Accepted, Deprecated, or Superseded
3. **Context**: The issue motivating this decision
4. **Decision**: The change we're proposing or have agreed to implement
5. **Consequences**: What becomes easier or harder as a result
6. **Alternatives**: Other options considered

## Creating a New ADR

1. Copy `template.md` to a new file with the next number
2. Fill in all sections
3. Set status to "Proposed"
4. After team discussion, update status to "Accepted"

## Index

- [001 - Public Interface](001-public-interface.md) - Evaluate vs parse/compile/interpret API design
- [002 - Unified AST Node](002-unified-ast-node.md) - Single AST node type vs multiple specific types
- [003 - Type Enriched AST](003-type-enriched-ast.md) - Adding type information to AST nodes
- [004 - Model Provider](004-model-provider.md) - Interface for accessing model type information
- [005 - FHIRPath Type System](005-fhirpath-type-system.md) - Type system implementation for FHIRPath
- [006 - FHIR Model Provider](006-fhir-model-provider.md) - FHIR-specific model provider implementation
- [007 - UCUM Quantity Support](007-ucum-quantity-support.md) - Integration of UCUM library for quantity literals and operations