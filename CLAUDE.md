# CLAUDE.md

When you are generating code prefer to be concise and to the point.
Make comments only if needed.

This is a design project for a new unit library in typescript.
Please be concise and to the point.

## FHIRPath Implementation Overview

This is a TypeScript implementation of FHIRPath - a path-based navigation and extraction language for FHIR resources.

### Core Architecture

- **Parser** (`parser.ts`): Converts FHIRPath expressions to AST using precedence climbing
- **Lexer** (`lexer.ts`): Tokenizes input strings, recognizing operators, literals, identifiers
- **Interpreter** (`interpreter.ts`): Evaluates AST nodes using visitor pattern
- **Registry** (`registry.ts`): Manages operator/function definitions with precedence and type signatures
- **Operations** (`operations/`): Individual implementations for ~50 operators and functions

### Key Features

- Expression evaluation: `evaluate("Patient.name.given", {input: resource})`
- Context management: Efficient prototype-based context with variables ($this, $index, %user-defined)
- Type system: Supports FHIRPath types (String, Integer, Decimal, Boolean, Date, DateTime, etc.)
- Extensible: Registry pattern allows adding custom operators/functions

### Example Usage

```typescript
import { evaluate } from './src/index';

const result = evaluate("Patient.name.where(use = 'official').given", {
  input: { resourceType: 'Patient', name: [{use: 'official', given: ['John']}] }
});
// Returns: ['John']
```

* ./spec is official spec of FHIRPath
* ./spec/FHIRPath.g4 - official FHIRPath grammar
* ./adr is a folder for Architecture Decision Records. (read ./adr/README.md for more details)
* ./concepts is a wiki like knowledge base for the project.
* ./tasks is a folder for task management (read ./tasks/README.md for more details)
   Task file name convention is [00<X>-<task-name>].md
   When creating new tasks, create them in ./tasks/todo/<filename>.md
   When working on tasks move files to ./tasks/in-progress/<filename>.md
   When task finished move files to ./tasks/done/<filename>.md and write what was done in this file.
* ./test is a folder for tests - tests should be named as ./test/<filename>.test.ts by convention.
* ./tmp use this folder for temporary scripts and files during debugging and development.

## Architecture Decisions

* Before making significant architectural changes, check existing ADRs in ./adr
* Create new ADRs for important design decisions using ./adr/template.md
* Document alternatives considered and rationale for choices

## Coding

* For fhirpath strings prefer `'` instead of `"`
* Follow the Google TypeScript Style Guide located at `./guides/tsguide.md` for all TypeScript code
* Key style points from the guide:
  - Use 2 spaces for indentation (not tabs)
  - Use single quotes for strings unless escaping
  - Always use `const` or `let`, never `var`
  - Prefer `const` for values that don't change
  - Use `import type` for type-only imports
  - Use trailing commas in multi-line structures
  - Prefer interfaces over type aliases for object types
  - Use PascalCase for types/interfaces, camelCase for variables/functions
  - Avoid `any` type - use `unknown` if type is truly unknown

* **Imports and Exports**:
  - Use ES6 module syntax (`import`/`export`), NEVER use `require()` or `module.exports`
  - Prefer relative imports for files in same project: `./foo` not `path/to/foo`
  - Use named exports, avoid default exports
  - Export visibility: minimize exported API surface
  - Never use `namespace`, use separate files instead
  - Group imports: external deps first, then internal by path depth

* **Classes and Functions**:
  - Prefer function declarations for named functions: `function foo() {}` not `const foo = () => {}`
  - Arrow functions for callbacks and when `this` binding needed
  - Class members: use `readonly` for never-reassigned properties
  - Use parameter properties in constructors: `constructor(private readonly foo: Foo) {}`
  - Never use `#private` fields, use TypeScript's `private` keyword
  - Avoid `public` modifier (it's default), except for parameter properties
  - Getters must be pure functions (no side effects)

* **Error Handling**:
  - Always throw `Error` objects, never strings: `throw new Error('msg')`
  - Use `try-catch` with typed catch: `catch (e: unknown)`
  - Empty catch blocks must have explanatory comment
  - Custom errors should extend `Error` class

* **Type Safety**:
  - Use type annotations on object literals: `const foo: Foo = {...}` not `{...} as Foo`
  - Avoid type assertions (`as`) and non-null assertions (`!`) without clear justification
  - Use `===` and `!==` for equality (exception: `== null` to check null/undefined)
  - No implicit boolean coercion for enums
  - Arrays: use `[]` syntax not `Array()` constructor
  - Objects: use `{}` syntax not `Object()` constructor

* **Control Flow**:
  - Always use braces for control structures (if/for/while)
  - `switch` statements must have `default` case
  - Prefer `for-of` for arrays, `Object.entries()` for objects
  - No assignment in conditionals unless double-parenthesized

* **Best Practices**:
  - One variable per declaration
  - Initialize class fields at declaration when possible
  - Destructuring: provide defaults on left side: `{foo = 'default'}: Options = {}`
  - Template literals for complex string concatenation
  - Use `Number()` for parsing, check for `NaN`
  - Never use `parseInt()`/`parseFloat()` except for non-base-10
  - Never use `require()` - use `import`!!!

* Use `bun run <filename.ts>` to run files
* When you create or update typescript file, run `bun tsc --noEmit` to check for errors and fix them.
* Create tests for new functionality. Put test file as ./test/<filename>.test.ts by convention.
* Use `import {describe, it, expect} from 'bun:test'` for writing tests
* **IMPORTANT**: Always use `bun run test` to run tests - this automatically filters output to show only failures, making it easier to identify issues quickly. Use `bun run test:output` if you need full verbose output.
* Main test cases are located in ./test-cases folder as JSON files organized according to ADR-008:
  - ./test-cases/operations/ contains subdirectories for each operation category (arithmetic/, logical/, etc.)
  - Each operation has its own test file (e.g., plus.json, where.json)
  - Use `bun tools/testcase.ts <path-to-test-file>` to run tests


## Tasks

When working on tasks move files to ./tasks/in-progress/<filename>.md
When task finished move files to ./tasks/done/<filename>.md and write what was done in this file.

## Tools

### TypeScript MCP Tools

Use the TypeScript MCP tools for TypeScript-specific operations like finding symbols, renaming, refactoring, and analyzing code:

* `mcp__typescript__list_tools` - List all available TypeScript MCP tools
* `mcp__typescript__get_type_in_module` - Get detailed signature for a type/interface/class in a module
* `mcp__typescript__get_type_at_symbol` - Get type information for a symbol at specific location
* `mcp__typescript__find_references` - Find all references to a symbol across codebase
* `mcp__typescript__get_definitions` - Get definition(s) of a TypeScript symbol
* `mcp__typescript__rename_symbol` - Rename a symbol across the codebase
* `mcp__typescript__move_file` - Move a file and update all imports
* `mcp__typescript__move_directory` - Move a directory and update all imports
* `mcp__typescript__delete_symbol` - Delete a symbol and all its references
* `mcp__typescript__get_module_symbols` - Get all exported symbols from a module
* `mcp__typescript__get_symbols_in_scope` - Get all symbols visible at a location
* `mcp__typescript__get_diagnostics` - Get TypeScript errors/warnings for a file

### Project Tools

* **Parser Tool** (`./tools/parser.ts`) - Parse FHIRPath expressions and output AST as JSON
  ```bash
  bun tools/parser.ts "<fhirpath-expression>"
  ```
  Examples:
  - `bun tools/parser.ts "Patient.name.given"`
  - `bun tools/parser.ts "5 + 3"`
  - `bun tools/parser.ts "Patient.where(active = true)"`

* **Interpreter Tool** (`./tools/interpreter.ts`) - Evaluate FHIRPath expressions with optional input data
  ```bash
  bun tools/interpreter.ts "<fhirpath-expression>" [input-json]
  ```
  Examples:
  - `bun tools/interpreter.ts "5 + 3"`
  - `bun tools/interpreter.ts "name.given" '{"name": [{"given": ["John", "James"]}]}'`
  - `bun tools/interpreter.ts "name.where(use = 'official').given" '{"name": [{"use": "official", "given": ["John"]}]}'`
  - `bun tools/interpreter.ts "'Hello' + ' ' + 'World'"`

* **Analyzer Tool** (`./tools/analyzer.ts`) - Analyze FHIRPath expressions for type information and diagnostics
  ```bash
  bun tools/analyzer.ts "<fhirpath-expression>" [options]
  ```
  Options:
  - `--type, -t` - Input type (e.g., "Patient", "String", etc.)
  - `--vars, -v` - JSON object with variables
  - `--singleton` - Input is a singleton (single value)
  - `--ast` - Show AST structure

  Examples:
  - `bun tools/analyzer.ts "5 + 3"` - Analyze simple expression
  - `bun tools/analyzer.ts "name.given" --type Patient` - Analyze with typed input
  - `bun tools/analyzer.ts "%x + %y" --vars '{"x": 10, "y": 20}'` - With variables
  - `bun tools/analyzer.ts "property.defineVariable('x', $this.value).select(%x)"` - Complex expression

* **Inspect Tool** (`./tools/inspect.ts`) - Debug FHIRPath expressions with rich debugging information including traces, AST, and timing
  ```bash
  bun tools/inspect.ts "<fhirpath-expression>" [input-json] [options]
  ```
  Options:
  - `--vars, -v` - JSON object with variables (e.g., '{"x": 10}')
  - `--max-traces` - Maximum number of traces to collect
  - `--verbose` - Show full trace values (default: truncated)
  - `--ast` - Show only the AST
  - `--traces` - Show only traces
  - `--timing` - Show only timing information

  Examples:
  - `bun tools/inspect.ts "5 + 3"` - Simple expression
  - `bun tools/inspect.ts "name.trace('names').given.trace('given names')" '{"name": [{"given": ["John"]}]}'` - With traces
  - `bun tools/inspect.ts "Patient.name.given" @patient.json` - Input from file
  - `bun tools/inspect.ts "%x + %y" --vars '{"x": 10, "y": 20}'` - With variables
  - `bun tools/inspect.ts "complex.expression" @data.json --traces` - Show only traces
  - `bun tools/inspect.ts "expression" --ast` - Show AST structure

* **Registry Lookup Tool** (`./tools/registry-lookup.ts`) - Lookup operation metadata from the FHIRPath registry
  ```bash
  bun tools/registry-lookup.ts <operation-name|"list">
  ```
  Examples:
  - `bun tools/registry-lookup.ts "+"` - Get metadata for the + operator
  - `bun tools/registry-lookup.ts "where"` - Get metadata for the where function
  - `bun tools/registry-lookup.ts "list"` - List all operations
  - `bun tools/registry-lookup.ts "list functions"` - List all functions
  - `bun tools/registry-lookup.ts "list operators"` - List all operators

* **Test Case Runner** (`./tools/testcase.ts`) - Run test cases from JSON test files
  ```bash
  bun tools/testcase.ts <test-file> [test-name] [mode]
  bun tools/testcase.ts <test-file> --list
  bun tools/testcase.ts <test-file> --pending
  bun tools/testcase.ts <test-file> --toggle-pending <test-name> [reason]
  bun tools/testcase.ts --tags
  bun tools/testcase.ts --tag <tag-name>
  bun tools/testcase.ts --failing
  bun tools/testcase.ts --failing-commands
  bun tools/testcase.ts --pending
  bun tools/testcase.ts --watch
  ```
  Arguments:
  - `test-file` - Path to JSON test file (relative to test-cases/)
  - `test-name` - Optional: specific test name to run (if not provided, runs all tests)
  - `mode` - Optional: 'interpreter' | 'compiler' | 'both' (default: 'both')

  Commands:
  - `--list` - List all tests in a specific file
  - `--pending` - Show all pending tests (globally or for a specific file)
  - `--toggle-pending` - Toggle pending status on/off for a specific test
  - `--tags` - List all unique tags from all test files with usage counts
  - `--tag <tag-name>` - Show all test expressions for a specific tag
  - `--failing` - Show all failing tests with detailed information and debug commands
  - `--failing-commands` - Output only the commands to run failing tests (useful for scripting)
  - `--watch` - Watch for changes in failing tests and re-run them automatically

  Examples:
  - `bun tools/testcase.ts operators/arithmetic.json` - Run all tests in a file
  - `bun tools/testcase.ts operators/arithmetic.json "addition - integers"` - Run a specific test
  - `bun tools/testcase.ts operators/arithmetic.json "addition - integers" interpreter` - Run with interpreter only
  - `bun tools/testcase.ts operators/arithmetic.json --list` - List all tests in a file
  - `bun tools/testcase.ts operations/utility/defineVariable.json --pending` - Show pending tests in a specific file
  - `bun tools/testcase.ts variables.json --toggle-pending "test name" "Reason for pending"` - Disable a test
  - `bun tools/testcase.ts variables.json --toggle-pending "test name"` - Enable a test (removes pending)
  - `bun tools/testcase.ts --tags` - List all unique tags across all test cases
  - `bun tools/testcase.ts --tag arithmetic` - Show all expressions with the "arithmetic" tag
  - `bun tools/testcase.ts --failing` - Show all failing tests with commands to debug them
  - `bun tools/testcase.ts --failing-commands` - Get just the commands for failing tests
  - `bun tools/testcase.ts --pending` - Show all pending tests across all test files

  Scripting Examples:
  ```bash
  # Run all failing tests one by one
  bun tools/testcase.ts --failing-commands | while read cmd; do
    echo "Running: $cmd"
    $cmd
  done

  # Save failing test commands to a file
  bun tools/testcase.ts --failing-commands > failing-tests.sh

  # Run failing tests for a specific tag
  bun tools/testcase.ts --tag arithmetic | grep "Run:" | cut -d' ' -f2- | bash
  ```

* **Spec Search Tool** (`./tools/spec.ts`) - Search FHIRPath specifications by keywords and title
  ```bash
  bun tools/spec.ts <search-query> [options]
  ```
  Options:
  - `--content, -c` - Show full content of matching sections
  - `--limit, -l <n>` - Limit results to top N matches (default: 10)
  - `--all, -a` - Show all matching results (no limit)

  Examples:
  - `bun tools/spec.ts "where"` - Search for sections about 'where'
  - `bun tools/spec.ts "where function" -c` - Search and show content
  - `bun tools/spec.ts "arithmetic operator" -l 5` - Show top 5 matches
  - `bun tools/spec.ts "+" -c` - Search for plus operator with content
  - `bun tools/spec.ts "defineVariable" -c` - Get full specification for defineVariable

* **Build Spec Index** (`./scripts/build-spec-index.ts`) - Build cached index for faster spec searches
  ```bash
  bun scripts/build-spec-index.ts
  ```
  This script:
  - Reads all metadata files from `spec/sections-meta/`
  - Creates a single `.index.json` file containing all metadata
  - Improves spec.ts search performance by ~15%
  - Should be run after updating section metadata files

* **Research Tool** (`./tools/research.ts`) - Query multiple AI models and collect responses for research purposes
  ```bash
  bun tools/research.ts "<prompt>" [options]
  ```
  Options:
  - `-m, --models <model>` - Models to query (default: grok-heavy, o3, claude-3-opus). Can be specified multiple times
  - `-s, --summarize` - Generate a summary of responses (default: true)
  - `--no-summarize` - Disable summary generation
  - `-h, --help` - Show help message

  Environment Variables:
  - `XAI_API_KEY` - API key for X.AI (Grok)
  - `OPENAI_API_KEY` - API key for OpenAI
  - `ANTHROPIC_API_KEY` - API key for Anthropic (Claude)

  Examples:
  - `bun tools/research.ts "What are the key differences between interpreted and compiled languages?"`
  - `bun tools/research.ts "Explain quantum computing" -m gpt-4 -m claude`
  - `bun tools/research.ts "Compare React and Vue frameworks" --no-summarize`

  This tool:
  - Queries multiple AI models simultaneously with the same prompt
  - Saves individual responses to `llm/<date>-<prompt-slug>/` directory
  - Creates files: `prompt.md`, `grok.md`, `openai.md`, `anthropic.md`
  - Optionally generates a summary comparing responses and extracting common themes
  - Useful for getting diverse perspectives on technical questions during research

* **FHIRPath.js Test Runner** (`./tools/fhirpathjs-tests.ts`) - Run fhirpath.js test cases for compatibility reference
  ```bash
  bun tools/fhirpathjs-tests.ts [options] [test-file|pattern]
  ```

  **Note**: This is an auxiliary test suite from the fhirpath.js project, used as a reference for compatibility testing. Our primary test cases are in `./test-cases/`. We do not aim for 100% compliance with fhirpath.js - this tool helps identify areas where our implementation differs and whether those differences are intentional.

  Arguments:
  - `test-file` - Specific test file to run (e.g., `simple.yaml`)
  - `pattern` - Pattern to match test files (e.g., `"5.*.yaml"`)

  Options:
  - `--list` - List all available test files
  - `--verbose` - Show detailed output including passed tests
  - `--filter <expr>` - Filter tests by expression or description
  - `--summary` - Show only summary (default for all tests)

  Examples:
  - `bun tools/fhirpathjs-tests.ts simple.yaml` - Run a specific test file
  - `bun tools/fhirpathjs-tests.ts --list` - List available test files
  - `bun tools/fhirpathjs-tests.ts "5.*.yaml"` - Run all section 5 tests
  - `bun tools/fhirpathjs-tests.ts simple.yaml --filter "name"` - Run only tests containing "name"
  - `bun tools/fhirpathjs-tests.ts "*.yaml"` - Run all test files

  Test Convention:
  - Tests are loaded from `fhirpath.js/test/cases/` (git submodule)
  - Each YAML file may contain a `subject` field with the test resource
  - If `subject` contains only `resourceType` and `id`, the tool loads the full resource by convention:
    - Pattern: `fhirpath.js/test/resources/{model}/{resourceType}-{id}.json`
    - Example: `Patient` with id `example` → `patient-example.json`
  - Uses our FHIRModelProvider for R4/R5/STU3/DSTU2 model context

  Current Status (as of last run):
  - Overall pass rate: ~62% (1,668/2,675 tests)
  - FHIR R4 tests: ~56% passing
  - FHIR R5 tests: ~56% passing
  - Simple navigation: ~79% passing
  - Boolean logic: ~93% passing

  Known Differences:
  - Some functions like `getValue()`, `hasValue()` are fhirpath.js extensions
  - Quantity literal format differences (we parse to objects, they keep as strings)
  - Unicode escape handling differences
  - Some edge cases in type conversion and coercion
