# Task 015: Use Registry in Completion Provider

## Status: COMPLETED

## What was done:
1. Refactored `getIdentifierCompletions()` to use `registry.listFunctions()`
2. Refactored `getOperatorCompletions()` to use `registry.listOperators()`
3. Added helper functions:
   - `isFunctionApplicable()` - checks if function works with current type
   - `isOperatorApplicable()` - checks operator signatures against type
   - `getSortTextForOperator()` - ensures common operators appear first
4. Now using registry metadata for descriptions
5. Type-aware filtering based on operator signatures

## Results:
- Functions increased from ~23 hardcoded to 55 from registry
- All operators now included with proper descriptions
- Tests still passing (18/19)
- Single source of truth - registry
- Automatically includes new operations added to registry

## Problem
The completion provider currently hardcodes function and operator names instead of using the registry. This means:
1. Completions might be out of sync with actual supported operations
2. We're not getting metadata like precedence, signatures, etc. from the registry
3. Duplication of information

## Current State
- Functions are hardcoded in `getIdentifierCompletions()` 
- Operators are hardcoded in `getOperatorCompletions()`
- The registry is imported but not used

## Solution
Refactor the completion provider to:
1. Get all functions from `registry.getFunctions()` or similar
2. Get all operators from `registry.getOperators()` or similar  
3. Use registry metadata for descriptions/documentation
4. Use type signatures from registry to filter by context

## Benefits
- Single source of truth for operations
- Automatically includes new operations added to registry
- Better descriptions from registry metadata
- Type-aware filtering based on registry signatures

## Implementation Notes
The registry has methods we can use:
- Check if registry has methods to list all operations
- Use operation metadata for better completion details
- Filter operations based on input/output types from signatures

## Example
```typescript
// Instead of:
const functions = [
  { name: 'where', detail: 'Filter collection by condition' },
  // ... hardcoded list
];

// Use:
const functions = registry.getFunctions().map(name => ({
  name,
  detail: registry.getMetadata(name)?.description,
  signature: registry.getSignature(name)
}));
```