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
4. **Track skipped duplicates** in the progress update (e.g., "21 unique, 3 duplicates skipped")

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
5. **UPDATE PROGRESS IMMEDIATELY**: After EACH group is ported, update 001-port-xml-tests.md with:
   - Mark the group as completed with ✅
   - Update the total test count
   - Update the completion percentage
   - Add to "Recent Progress" section
   - Update the date in "Current Status"

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
- Currently ported: 599 (as of 2025-09-12)
- Identified duplicates: 92 (to be cleaned up later)
- **MANDATORY**: Update 001-port-xml-tests.md after EACH group ported

## Notes

- We have identified 92 duplicate test expressions in our existing suite
- These will be cleaned up in a separate task
- Going forward, NO NEW DUPLICATES should be added

## Progress Update Checklist (AFTER EACH GROUP)

After porting each test group:
1. ✅ Run the tests to ensure they pass
2. ✅ Update the group's status in 001-port-xml-tests.md (mark with ✅)
3. ✅ Update the total test count at the top of the file
4. ✅ Update the "Current Status as of" date
5. ✅ Add the group to "Recent Progress" section
6. ✅ Note any duplicates skipped (e.g., "21 unique, 3 duplicates skipped")
7. ✅ Commit with message: "test: port <group-name> from XML (<n> tests)"