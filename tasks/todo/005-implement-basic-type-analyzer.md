# Task 005: Implement Basic Type Analyzer

## Overview
Implement a basic version of the FHIRPath type analyzer following the design outlined in ADR-004.

## References
- ADR: `/adr/004-semantic-analysis-and-type-system.md`
- Parser AST: `/src/parser/ast.ts`
- Function Registry: `/src/interpreter/functions/registry.ts`

## Objectives
1. Create the core type analysis infrastructure
2. Implement a simple model provider for testing
3. Build the type analyzer that can process AST nodes
4. Add type signatures to existing functions
5. Create comprehensive tests

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Extend AST nodes** with optional type fields:
   - Add `resultType?: unknown` field to ASTNode interface
   - Add `isSingleton?: boolean` field to ASTNode interface

2. **Create type system interfaces**:
   - `ModelProvider` interface with opaque TypeRef
   - `PropertyInfo` interface
   - `FunctionSignature` interface

3. **Implement MockModelProvider** for testing:
   - Support basic FHIR types (Patient, Observation, etc.)
   - Handle primitive types (String, Integer, Boolean)
   - Simple property navigation

### Phase 2: Function Registry Enhancement
1. **Add signature field** to function definitions
2. **Define signatures** for core functions:
   - exists(), count(), first(), where(), select()
   - toString(), empty(), not()
3. **Create operator signatures** for:
   - Arithmetic operators (+, -, *, /)
   - Comparison operators (=, !=, <, >)
   - Logical operators (and, or, not)
   - Navigation operator (.)

### Phase 3: Type Analyzer Implementation
1. **Create TypeAnalyzer class** with visitor pattern
2. **Implement node handlers**:
   - Literal nodes (determine type from value)
   - Identifier nodes (property navigation)
   - Binary operators (especially dot operator)
   - Function calls (use signatures)
   - Variables ($this, $index, etc.)

3. **Handle special cases**:
   - Union types for polymorphic properties
   - Any type propagation
   - Collection vs singleton tracking

### Phase 4: Testing
1. **Unit tests** for each node type
2. **Integration tests** with complex expressions
3. **Error case tests** (type mismatches, unknown properties)
4. **Examples from ADR** as test cases

## Success Criteria
- [ ] Can analyze simple expressions like `Patient.name`
- [ ] Correctly tracks singleton vs collection through operations
- [ ] Handles function calls with type inference
- [ ] Processes the example from ADR: `Patient.name.where(use = 'official').given.first()`
- [ ] All tests pass
- [ ] Type information is correctly propagated through AST

## Technical Considerations
- Keep TypeRef completely opaque as per ADR
- Ensure analyzer follows same traversal pattern as interpreter
- Model provider should be easily replaceable
- Don't modify the interpreter - this is purely additive

## Files to Create/Modify
- `src/analyzer/types.ts` - Type system interfaces
- `src/analyzer/model-provider.ts` - Model provider interface and mock
- `src/analyzer/analyzer.ts` - Main type analyzer
- `src/analyzer/function-signatures.ts` - Function type signatures
- `test/analyzer.test.ts` - Comprehensive tests
- Update `src/parser/ast.ts` - Add optional type fields

## Estimated Effort
- Core infrastructure: 2-3 hours
- Function signatures: 2-3 hours
- Analyzer implementation: 4-6 hours
- Testing: 3-4 hours
- Total: ~2-3 days

## Notes
- Start with a minimal implementation that works for basic cases
- Focus on correctness over completeness
- The model provider can be very simple initially
- Prioritize the most common FHIRPath patterns