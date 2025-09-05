# CRITICAL: AFTER EACH CONTEXT RESET/COMPACT

## MUST READ THESE FILES IMMEDIATELY:

1. **CLAUDE.md** - Project instructions and coding standards
2. **./adr/ADR-008-test-organization.md** - Testing strategy and structure
3. **./tasks/in-progress/001-port-xml-tests.md** - Current XML porting task with CRITICAL RULES

## CRITICAL RULES TO REMEMBER:

### FROM TEST PORTING:
- **ALWAYS CHECK FOR DUPLICATES BEFORE ADDING ANY TEST**
- Use: `grep -r 'expression' test-cases/` BEFORE adding
- XML tests are the HOLY GRAIL - never modify their expectations
- If our tests conflict with XML, FIX OUR TESTS

### FROM CLAUDE.md:
- Use `bun run test` (NOT `bun test`) - it filters output
- Use `bun tools/testcase.ts` for running specific tests
- Follow Google TypeScript Style Guide
- Never use `require()` - always use `import`
- Create tests for all new functionality

### PROJECT STRUCTURE:
- `/test-cases/` - JSON test files organized by operation type
- `/spec/fhirpathlab-tests/` - Source XML tests (authoritative)
- `/src/operations/` - Operation implementations
- `/tools/` - Development tools (interpreter, testcase, etc.)

## CURRENT STATE (UPDATE AFTER EACH SESSION):
- Tests ported: 394/1025 (~38%)
- Pending tests: 35
- Failing tests: 0
- Last worked on: String operations (replaceMatches, substring)

## REMEMBER:
**CHECK FOR DUPLICATES OR YOUR MOM DIES**