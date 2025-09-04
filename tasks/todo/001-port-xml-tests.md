# Task: Port XML Test Cases to JSON

## Overview
Porting FHIRPath test cases from XML format (spec/fhirpathlab-tests/fhirpathlab-tests.xml) to JSON format.

**Source:** 1751 lines, 101 test groups, 1025 tests parsed (1027 test tags found - 2 missing in parse)
**Current Coverage:** 52 groups have some coverage, 49 groups have no coverage

## Coverage Summary
- ✅ **Complete Coverage:** 37 groups (complete or over-coverage)
- ⚠️ **Partial Coverage:** 15 groups (need additional tests)  
- ❌ **No Coverage:** 49 groups (need to be fully ported)

## Priority 1: Groups with No Coverage (49 groups, ~425 tests)

### High Priority - Core Functionality
- [ ] **testLiterals** (82 tests) - Basic literal parsing and handling
- [ ] **testTypes** (99 tests) - Type system tests
- [ ] **testEquality** (28 tests) - Equality operator tests
- [ ] **testNEquality** (24 tests) - Not-equal operator tests
- [ ] **testEquivalent** (24 tests) - Equivalence operator tests  
- [ ] **testNotEquivalent** (22 tests) - Not-equivalent operator tests

### Comparison Operators (120 tests total)
- [ ] **testLessThan** (30 tests)
- [ ] **testLessOrEqual** (30 tests)
- [ ] **testGreatorOrEqual** (30 tests)
- [ ] **testGreaterThan** (30 tests)

### Boundaries & Precision
- [ ] **LowBoundary** (28 tests) - Low boundary value tests
- [ ] **HighBoundary** (24 tests) - High boundary value tests
- [ ] **Precision** (6 tests) - Precision handling tests

### String Operations
- [ ] **testMatches** (16 tests) - Regular expression matching
- [ ] **testReplaceMatches** (7 tests) - Replace with regex
- [ ] **testEncodeDecode** (8 tests) - String encoding/decoding
- [ ] **testEscapeUnescape** (4 tests) - Escape character handling
- [ ] **testCase** (4 tests) - Case conversion
- [ ] **testToChars** (1 test) - Convert string to characters

### Collections & Sorting
- [ ] **testSort** (10 tests) - Sorting operations
- [ ] **testCombine()** (3 tests) - Combine collections
- [ ] **testExclude** (4 tests) - Exclude from collections
- [ ] **testRepeat** (5 tests) - Repeat operation

### Math Operations
- [ ] **testExp** (3 tests) - Exponential function
- [ ] **testLn** (3 tests) - Natural logarithm
- [ ] **testLog** (5 tests) - Logarithm
- [ ] **testPower** (6 tests) - Power operation
- [ ] **testConcatenate** (4 tests) - String/collection concatenation

### Other Core Features
- [ ] **testQuantity** (11 tests) - Quantity handling
- [ ] **testObservations** (10 tests) - FHIR Observation tests
- [ ] **testBasics** (7 tests) - Basic functionality
- [ ] **testCollectionBoolean** (6 tests) - Boolean collection operations
- [ ] **testDollar** (5 tests) - $ variable tests
- [ ] **testIndexer** (2 tests) - Index operations
- [ ] **testPrecedence** (6 tests) - Operator precedence

### Advanced Features
- [ ] **testType** (30 tests) - Type testing operations
- [ ] **testInheritance** (24 tests) - Type inheritance tests  
- [ ] **testVariables** (4 tests) - Variable handling
- [ ] **testExtension** (3 tests) - Extension handling
- [ ] **testConformsTo** (3 tests) - ConformsTo operation
- [ ] **comments** (9 tests) - Comment parsing
- [ ] **testMiscellaneousAccessorTests** (3 tests)
- [ ] **Comparable** (3 tests) - Comparable type tests
- [ ] **from-Zulip** (2 tests) - Edge cases from Zulip discussions
- [ ] **polymorphics** (2 tests) - Polymorphic operations
- [ ] **index-part** (1 test) - Index part functionality
- [ ] **period** (2 tests) - Period handling
- [ ] **miscEngineTests** (2 tests) - Engine-specific tests
- [ ] **cdaTests** (3 tests) - CDA document tests
- [ ] **testDollarResource** (not found in groups list)

## Priority 2: Groups with Partial Coverage (15 groups, need ~150 more tests)

- [ ] **testPlus** - Has 3/34 tests (need 31 more)
- [ ] **testMinus** - Has 2/11 tests (need 9 more)
- [ ] **testMultiply** - Has 2/6 tests (need 4 more)
- [ ] **testDivide** - Has 2/9 tests (need 7 more)
- [ ] **testDiv** - Has 4/8 tests (need 4 more)
- [ ] **testMod** - Has 2/8 tests (need 6 more)
- [ ] **testUnion** - Has 8/12 tests (need 4 more)
- [ ] **testContainsString** - Has 7/11 tests (need 4 more)
- [ ] **testContainsCollection** - Has 7/9 tests (need 2 more)
- [ ] **testBooleanLogicAnd** - Has 8/9 tests (need 1 more)
- [ ] **testBooleanLogicXOr** - Has 4/9 tests (need 5 more)
- [ ] **testBooleanImplies** - Has 4/9 tests (need 5 more)
- [ ] **testExists** - Has 4/5 tests (need 1 more)
- [ ] **testDistinct** - Has 1/6 tests (need 5 more)
- [ ] **testCount** - Has 2/4 tests (need 2 more)

## Completed Groups (37 groups) ✅
Already have complete or over-coverage for: defineVariable, testAll, testSubSetOf, testSuperSetOf, testWhere, testSelect, testAggregate, testSingle, testFirstLast, testTail, testSkip, testTake, testIif, testToInteger, testToDecimal, testToString, testIndexOf, testSubstring, testStartsWith, testEndsWith, testReplace, testLength, testTrim, testSplit, testJoin, testTrace, testToday, testNow, testIntersect, testIn, testBooleanLogicOr, testRound, testSqrt, testAbs, testCeiling, testFloor, testTruncate

## Porting Strategy

1. **Start with high-priority core functionality** (literals, types, equality)
2. **Port in batches of 10 tests** to allow for validation
3. **Run tests immediately after porting** to catch issues early
4. **Create checkpoints** after each successful batch

## Validation Metrics
- Total XML test tags: 1027
- Successfully parsed: 1025 
- Missing in parse: 2 (need investigation)
- Target: Port all missing and partial coverage tests

## Files
- Source: `spec/fhirpathlab-tests/fhirpathlab-tests.xml`
- Manifest: `tmp/test-manifest.json`
- Target directory: `test-cases/operations/`