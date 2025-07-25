# CLAUDE.md

When you are generating code prefer to be concise and to the point.
Make comments only if needed.

This is a design project for a new unit library in typescript.
Please be concise and to the point.

* ./spec is official spec of FHIRPath
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

* While importing files, remember about import type for types.
* Use `bun run <filename.ts>` to run files
* When you create or update typescript file, run `bun tsc --noEmit` to check for errors and fix them.
* Create tests for new functionality. Put test file as ./test/<filename>.test.ts by convention.
* Use `import {describe, it, expect} from 'bun:test'` and `bun run test` to run tests.
* Main test cases are located in ./test-cases folder as JSON files organized according to ADR-008:
  - ./test-cases/operations/ contains subdirectories for each operation category (arithmetic/, logical/, etc.)
  - Each operation has its own test file (e.g., plus.json, where.json)
  - Use `bun tools/testcase.ts <path-to-test-file>` to run tests


## Tasks

When working on tasks move files to ./tasks/in-progress/<filename>.md
When task finished move files to ./tasks/done/<filename>.md and write what was done in this file.

## Tools

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

* **Compiler Tool** (`./tools/compiler.ts`) - Compile and evaluate FHIRPath expressions with optional input data
  ```bash
  bun tools/compiler.ts "<fhirpath-expression>" [input-json]
  ```
  Examples:
  - `bun tools/compiler.ts "5 + 3"`
  - `bun tools/compiler.ts "name.given" '{"name": [{"given": ["John", "James"]}]}'`
  - `bun tools/compiler.ts "name.where(use = 'official').given" '{"name": [{"use": "official", "given": ["John"]}]}'`
  - `bun tools/compiler.ts "'Hello' + ' ' + 'World'"`

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
  bun tools/testcase.ts --tags
  bun tools/testcase.ts --tag <tag-name>
  bun tools/testcase.ts --failing
  bun tools/testcase.ts --failing-commands
  bun tools/testcase.ts --pending
  ```
  Arguments:
  - `test-file` - Path to JSON test file (relative to test-cases/)
  - `test-name` - Optional: specific test name to run (if not provided, runs all tests)
  - `mode` - Optional: 'interpreter' | 'compiler' | 'both' (default: 'both')
  
  Commands:
  - `--tags` - List all unique tags from all test files with usage counts
  - `--tag <tag-name>` - Show all test expressions for a specific tag
  - `--failing` - Show all failing tests with detailed information and debug commands
  - `--failing-commands` - Output only the commands to run failing tests (useful for scripting)
  - `--pending` - Show all pending tests with reasons and commands to run them
  - `--list` - List all tests in a specific file
  
  Examples:
  - `bun tools/testcase.ts operators/arithmetic.json` - Run all tests in a file
  - `bun tools/testcase.ts operators/arithmetic.json "addition - integers"` - Run a specific test
  - `bun tools/testcase.ts operators/arithmetic.json "addition - integers" interpreter` - Run with interpreter only
  - `bun tools/testcase.ts operators/arithmetic.json --list` - List all tests in a file
  - `bun tools/testcase.ts --tags` - List all unique tags across all test cases
  - `bun tools/testcase.ts --tag arithmetic` - Show all expressions with the "arithmetic" tag
  - `bun tools/testcase.ts --failing` - Show all failing tests with commands to debug them
  - `bun tools/testcase.ts --failing-commands` - Get just the commands for failing tests
  
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
  - Reads all metadata files from `spec2/sections-meta/`
  - Creates a single `.index.json` file containing all metadata
  - Improves spec.ts search performance by ~15%
  - Should be run after updating section metadata files





