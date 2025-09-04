# XML Test Porting Strategy

## Core Principles

1. **XML Tests are the Holy Grail**: Never modify XML test behavior. Always adapt our implementation to match.
2. **Use Actual Input Files**: Always use the exact input files specified in XML tests (e.g., patient-example.xml)
3. **Maintain Test Fidelity**: Port tests exactly as they appear in XML, including edge cases

## CRITICAL: Duplicate Prevention

### Before Adding ANY Test:
1. **Check for IDENTICAL expressions** - Run this check FIRST:
   ```bash
   grep -r "exact-expression" test-cases/ 
   ```
2. If an identical test exists (same expression, same expected result), **DO NOT ADD IT**
3. Document in comments if a test was skipped due to duplication

### Duplication Check Script
Use the find-duplicates.ts script in tmp/ to check for duplicates:
```bash
bun tmp/find-duplicates.ts
```

## Porting Process

1. **Sequential Processing**: Work through XML test groups in order
2. **Check Existing Coverage**: Before porting a group, check if tests already exist
3. **Organize by Function**: Place tests in appropriate subdirectories
4. **Preserve Metadata**: Always include `fromXML` field with original test name

## File Organization

- Type conversion tests → `operations/type-conversion/`
- Temporal tests → `operations/temporal/`
- Literal tests → `literals.json`
- Navigation tests → `navigation.json`

## Input File Paths

When creating test files in subdirectories, use relative paths:
- From `operations/type-conversion/`: `"inputFile": "../../input/patient-example.json"`
- From root `test-cases/`: `"inputFile": "input/patient-example.json"`

## Tracking Progress

- Total XML tests: 1026
- Currently ported: 127 (with duplicates)
- Identified duplicates: 92 (to be cleaned up later)

## Notes

- We have identified 92 duplicate test expressions in our existing suite
- These will be cleaned up in a separate task
- Going forward, NO NEW DUPLICATES should be added