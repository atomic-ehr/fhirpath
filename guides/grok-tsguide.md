# Google TypeScript Style Guide (Compact Version)

This is a condensed version of the Google TypeScript Style Guide, focusing on key rules for consistency, readability, and maintainability. Use it to ensure code adheres to best practices. Rules are prescriptive; examples are minimal.

## Introduction

- Use RFC 2119 terminology: *must*, *must not*, *should*, *should not*, *may*.
- Examples are non-normative; do not enforce optional formatting as rules.

## Source File Basics

### File Encoding
- Encode in UTF-8.
- Use only ASCII horizontal space (0x20) for whitespace; escape others in strings.
- Use special escape sequences (\', \", \\, \b, \f, \n, \r, \t, \v) over numeric escapes.
- Use Unicode characters directly; escape non-printable ones with comments.

### Source File Structure
- Order: Copyright (if present), @fileoverview JSDoc (if present), imports, implementation.
- Separate sections with exactly one blank line.
- Add copyright in top JSDoc if needed.
- @fileoverview provides file description; no indented wrapped lines.

## Imports

- Use module imports: `import * as foo from '...';` (namespace), `import {SomeThing} from '...';` (named), `import SomeThing from '...';` (default, only for external code), `import '...';` (side-effect).
- Prefer relative paths (`./foo`) over absolute for same-project files.
- Limit parent steps (`../../../`).
- Use named imports for frequent/clear symbols; namespace for large APIs.
- For Apps JSPB protos, use named imports even if lines are long.
- Fix collisions with namespace imports or renaming (`import {SomeThing as Other}`).
- Use `import type {Foo} from '...';` for type-only imports.
- Do not use namespaces; use modules with ES6 syntax. Avoid `require`.

## Exports

- Use named exports: `export class Foo { ... }`.
- Avoid default exports for uniform imports.
- Minimize exported API surface; export only used symbols.
- Avoid mutable exports (`export let`); use getters if needed.
- Export final values; conditionally export after checks.
- Avoid container classes for namespacing; export constants/functions directly.
- Use `export type {Foo} from '...';` for type re-exports.

## Language Features

### Local Variable Declarations
- Use `const` (default) or `let`; never `var`.
- Declare one variable per statement.
- Do not use before declaration.

### Array Literals
- Avoid `Array` constructor; use `[]` or `Array.from`.
- Do not define non-numeric properties on arrays; use Map/Object.
- Use spread `[...foo]` for copying/concatenating; match types (spread iterables into arrays).
- Use destructuring: `const [a, b, ...rest] = arr;`; omit unused with commas.
- For parameters: `function f([a=4, b=2]=[]) {};`; prefer object over array destructuring.

### Object Literals
- Avoid `Object` constructor; use `{}`.
- Iterate with `for...of Object.keys/entries` or filtered `for...in`.
- Use spread `{...bar}` for copying; match types (spread objects into objects).
- Use computed properties `{['key'+foo()]: 42}` as dict-style; symbols allowed.
- Use destructuring: `function f({num, str='default'}: Options={}) {};`; keep simple, no deep nesting.

### Classes
- No semicolons after class declarations; use for class expressions.
- Separate methods with blank lines; no semicolons between methods.
- Avoid private static methods; prefer module-local functions.
- Do not rely on dynamic dispatch for statics; call on base class.
- Avoid `this` in static methods.
- Use parentheses for constructors: `new Foo()`.
- Omit empty/default constructors unless needed (e.g., parameter properties).
- Separate constructor with blank lines.
- No #private fields; use TypeScript visibility (`private`).
- Use `readonly` for non-reassigned properties.
- Use parameter properties: `constructor(private readonly bar: BarService) {}`.
- Initialize fields where declared.
- For external/template properties, use `protected` or `public`; no `obj['foo']` to bypass visibility.
- Use getters/setters sparingly; getters must be pure; no `Object.defineProperty`.
- Limit visibility; avoid `public` except non-readonly parameters.
- Do not manipulate prototypes.

### Functions
- Prefer declarations for named functions; arrow for expressions.
- Use arrow functions in methods for `this`.
- Avoid function expressions; use arrows.
- Use concise or block bodies; block if return unused.
- Avoid rebinding `this` with `bind`; use arrows or parameters.
- Pass arrows as callbacks; forward parameters explicitly.
- Avoid arrow functions as properties; use in templates if needed.
- For event handlers, use arrows if no uninstall; properties for uninstallable.
- Use default initializers sparingly; no side effects.
- Prefer rest/spread over `arguments`; no space after `...`.
- Separate function content with blank lines sparingly; no blank at start/end.
- Attach `*` to `function` and `yield` in generators.
- Parentheses around single-arg arrow LHS optional.

### Primitive Literals
- Use single quotes for strings; no line continuations.
- Use template literals for multi-line/concatenation.
- Numbers: use `0x`, `0o`, `0b` prefixes lowercase.
- Coerce with `String()`, `Boolean()`, `!!`, templates; explicit for enums.
- Parse with `Number()` and check `NaN`; no unary `+`, `parseInt` (except non-10 radix with checks), `parseFloat`.
- Avoid implicit boolean coercion for enums; OK for others.
- Use triple equals (`===`); double for `== null`.

### Type and Non-Nullability Assertions
- Avoid assertions without reason; use runtime checks instead.
- Use `as` syntax: `(z as Foo).length`.
- For double assertions: `(x as unknown as Foo)`.
- Use annotations over assertions for object literals.

### Control Structures
- Always brace blocks; first statement on own line.
- Avoid assignment in controls; parenthesize if needed.
- Prefer `for...of` for arrays; `forEach` or indexed OK.
- All `switch` need `default` last; non-empty cases must `break`; empty may fall through.

### Exception Handling
- Instantiate with `new Error()`; throw only `Error` subtypes.
- Assume caught are `Error`; narrow with guards.
- Avoid empty catch; comment justification.
- Rethrow with `throw e;`.

### Disallowed Features
- No wrapper objects (`new String` etc.); call as functions for coercion.
- No ASI; always use semicolons.
- No `const enum`; use `enum`.
- No `debugger`.
- No `with`.
- No `eval` or `Function(string)`.
- No non-standard ES features.
- Do not modify builtins or globals.

## Naming

- ASCII letters, digits, underscores (for tests/constants), rare `$`.
- No type decorations; no `_` prefix/suffix (except unused destructuring).
- Casing: UpperCamelCase (classes/interfaces/types/enums/decorators/type params/TSX components); lowerCamelCase (vars/params/functions/methods/properties/module aliases); CONSTANT_CASE (global constants/enums).
- Descriptive names; no ambiguous abbreviations.
- Test methods may use `_` separators.
- Imports: lowerCamelCase namespaces; exceptions ($ for jquery, THREE for threejs).
- Constants: CONSTANT_CASE for globals; lowerCamelCase for locals.
- Aliases match source format; use `const`/readonly.

## Type System

- Rely on inference; annotate complex for readability.
- Use `null|undefined` unions; prefer `?` optional over `|undefined`.
- Use structural types/interfaces; no classes for types.
- Prefer interfaces over type aliases for objects.
- Use `T[]` for simple arrays; `Array<T>` for complex.
- Index signatures: meaningful key label; prefer Map/Set.
- Use mapped/conditional sparingly; prefer explicit interfaces.
- Avoid `any`; use specific types, `unknown`, or suppress with comment.
- No `{}` for most cases; use `unknown`, `Record`, `object`.
- Use tuples over Pair interfaces; inline objects for named.
- No wrapper types.
- No return-type-only generics; specify explicitly.

## Toolchain Requirements

- Pass type checking.
- No `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`; use casts/comments.
- Abide by conformance rules (tsetse/tsec).

## Comments and Documentation

- JSDoc (`/** */`) for user docs; `//` for implementation.
- Multi-line: use `//`; indent same level; no boxes.
- JSDoc in Markdown; tags on own lines.
- Wrap descriptions indented 4 spaces; no indent for @desc/@fileoverview.
- Document all top-level exports; classes/methods if non-obvious.
- Method desc: third-person verb phrase.
- Use @param for parameter properties.
- No redundant comments; omit obvious @param/@return.
- Place JSDoc before decorators.
- No types in JSDoc (redundant with TS).

## Policies

- Be consistent with file/directory; new files must follow guide.
- Reformat on significant changes; separate style fixes.
- Deprecate with @deprecated and fix directions.
- Generated code exempt except referenced identifiers.