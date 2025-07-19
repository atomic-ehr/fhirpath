# FHIRPath Parser Comprehensive Reference

This document describes the complete FHIRPath language features and their S-expression AST representation. The parser adds implicit `$this` to make the evaluation context explicit.

## AST Format

The parser produces S-expressions in the format:
- `(type arg1 arg2 ...)`
- Types: `literal`, `member`, `method`, `function`, `operator`, `index`, `if`, `variable`, `env-var`

## Core Principle: Implicit $this

Every FHIRPath expression operates on an implicit context. The parser makes this explicit by adding `$this[implicit]` to:
1. Root identifiers
2. Bare function calls (except standalone functions)
3. Identifiers inside iterative functions

## 1. Literals

### 1.1 Empty Collection
```fhirpath
{}
-> (literal 'empty' {})
```

### 1.2 Boolean
```fhirpath
true
-> (literal 'boolean' true)

false
-> (literal 'boolean' false)
```

### 1.3 Integer
```fhirpath
42
-> (literal 'integer' 42)

-123
-> (literal 'integer' -123)
```

### 1.4 Decimal
```fhirpath
3.14159
-> (literal 'decimal' 3.14159)

-0.5
-> (literal 'decimal' -0.5)
```

### 1.5 String
```fhirpath
'hello world'
-> (literal 'string' 'hello world')

'O\'Brien'
-> (literal 'string' 'O\'Brien')
```

### 1.6 Date
```fhirpath
@2024-01-15
-> (literal 'date' '2024-01-15')
```

### 1.7 DateTime
```fhirpath
@2024-01-15T10:30:00Z
-> (literal 'datetime' '2024-01-15T10:30:00Z')

@2024-01-15T10:30:00.123-05:00
-> (literal 'datetime' '2024-01-15T10:30:00.123-05:00')
```

### 1.8 Time
```fhirpath
@T14:30:00
-> (literal 'time' '14:30:00')

@T14:30:00.123
-> (literal 'time' '14:30:00.123')
```

### 1.9 Quantity
```fhirpath
5 'mg'
-> (literal 'quantity' 5 'mg')

10.5 'mg/dL'
-> (literal 'quantity' 10.5 'mg/dL')

3 days
-> (literal 'quantity' 3 'days')
```

## 2. Special Variables

### 2.1 $this
```fhirpath
$this
-> (variable '$this' false)

// Implicit $this added by parser
name
-> (member 'name' (variable '$this' true))
```

### 2.2 $index
```fhirpath
$index
-> (variable '$index' false)

// In where clause
name.where($index < 3)
-> (method 'where'
    (member 'name' (variable '$this' true))
    (operator '<' (variable '$index' false) (literal 'integer' 3)))
```

### 2.3 $total
```fhirpath
// Only in aggregate
value.aggregate($total + $this, 0)
-> (method 'aggregate'
    (member 'value' (variable '$this' true))
    (operator '+' (variable '$total' false) (variable '$this' false))
    (literal 'integer' 0))
```

## 3. Environment Variables

```fhirpath
%context
-> (env-var 'context')

%resource
-> (env-var 'resource')

%rootResource
-> (env-var 'rootResource')

%ucum
-> (env-var 'ucum')

%sct
-> (env-var 'sct')

%loinc
-> (env-var 'loinc')

%`vs-observation-status`
-> (env-var 'vs-observation-status')

%`ext-data-absent-reason`
-> (env-var 'ext-data-absent-reason')
```

## 4. Operators (by precedence, highest to lowest)

### 4.1 Member Invocation (.)
```fhirpath
Patient.name
-> (member 'name' 
    (member 'Patient' (variable '$this' true)))

name.given
-> (member 'given'
    (member 'name' (variable '$this' true)))
```

### 4.2 Indexer ([])
```fhirpath
name[0]
-> (index 
    (member 'name' (variable '$this' true))
    (literal 'integer' 0))

name[index]
-> (index
    (member 'name' (variable '$this' true))
    (member 'index' (variable '$this' true)))
```

### 4.3 Unary Plus and Minus
```fhirpath
-value
-> (operator 'unary-' (member 'value' (variable '$this' true)))

+value
-> (operator 'unary+' (member 'value' (variable '$this' true)))
```

### 4.4 Multiplicative (* / div mod)
```fhirpath
a * b
-> (operator '*' 
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))

a / b
-> (operator '/' 
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))

a div b
-> (operator 'div'
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))

a mod b
-> (operator 'mod'
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))
```

### 4.5 Additive (+ - &)
```fhirpath
a + b
-> (operator '+' 
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))

a - b
-> (operator '-'
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))

'hello' & ' world'
-> (operator '&' 
    (literal 'string' 'hello')
    (literal 'string' ' world'))
```

### 4.6 Type Operators (is as)
```fhirpath
value is Quantity
-> (operator 'is'
    (member 'value' (variable '$this' true))
    (type 'Quantity'))

value as Quantity
-> (operator 'as'
    (member 'value' (variable '$this' true))
    (type 'Quantity'))
```

### 4.7 Union (|)
```fhirpath
name.given | name.family
-> (operator '|'
    (member 'given' (member 'name' (variable '$this' true)))
    (member 'family' (member 'name' (variable '$this' true))))
```

### 4.8 Comparison (< <= > >= = != ~ !~)
```fhirpath
age > 18
-> (operator '>'
    (member 'age' (variable '$this' true))
    (literal 'integer' 18))

status = 'active'
-> (operator '='
    (member 'status' (variable '$this' true))
    (literal 'string' 'active'))

code ~ %loinc#1234-5
-> (operator '~'
    (member 'code' (variable '$this' true))
    (env-var 'loinc#1234-5'))
```

### 4.9 Membership (in contains)
```fhirpath
5 in (1 | 2 | 5 | 10)
-> (operator 'in'
    (literal 'integer' 5)
    (operator '|' ...))

name contains 'John'
-> (operator 'contains'
    (member 'name' (variable '$this' true))
    (literal 'string' 'John'))
```

### 4.10 Boolean (and or xor)
```fhirpath
active and status = 'final'
-> (operator 'and'
    (member 'active' (variable '$this' true))
    (operator '='
        (member 'status' (variable '$this' true))
        (literal 'string' 'final')))

deceased or inactive
-> (operator 'or'
    (member 'deceased' (variable '$this' true))
    (member 'inactive' (variable '$this' true)))

a xor b
-> (operator 'xor'
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))
```

### 4.11 Implies
```fhirpath
a implies b
-> (operator 'implies'
    (member 'a' (variable '$this' true))
    (member 'b' (variable '$this' true)))
```

## 5. Functions

### 5.1 Standalone Functions (no implicit $this)

```fhirpath
today()
-> (function 'today')

now()
-> (function 'now')

timeOfDay()
-> (function 'timeOfDay')

// Can be chained
today().add(3 days)
-> (method 'add'
    (function 'today')
    (literal 'quantity' 3 'days'))
```

### 5.2 Iterative Functions (set $this for expressions)

These functions evaluate their expression arguments with $this set to each item:

#### where(criteria)
```fhirpath
Patient.name.where(use = 'official')
-> (method 'where'
    (member 'name' (member 'Patient' (variable '$this' true)))
    (operator '='
        (member 'use' (variable '$this' true))
        (literal 'string' 'official')))
```

#### select(projection)
```fhirpath
Patient.name.select(given + ' ' + family)
-> (method 'select'
    (member 'name' (member 'Patient' (variable '$this' true)))
    (operator '+'
        (operator '+'
            (member 'given' (variable '$this' true))
            (literal 'string' ' '))
        (member 'family' (variable '$this' true))))
```

#### exists([criteria])
```fhirpath
name.exists()
-> (method 'exists'
    (member 'name' (variable '$this' true)))

name.exists(use = 'official')
-> (method 'exists'
    (member 'name' (variable '$this' true))
    (operator '='
        (member 'use' (variable '$this' true))
        (literal 'string' 'official')))
```

#### all(criteria)
```fhirpath
children.all(age > 10)
-> (method 'all'
    (member 'children' (variable '$this' true))
    (operator '>'
        (member 'age' (variable '$this' true))
        (literal 'integer' 10)))
```

#### repeat(projection)
```fhirpath
Questionnaire.repeat(item)
-> (method 'repeat'
    (member 'Questionnaire' (variable '$this' true))
    (member 'item' (variable '$this' true)))
```

#### aggregate(aggregator [, init])
```fhirpath
value.aggregate($total + $this, 0)
-> (method 'aggregate'
    (member 'value' (variable '$this' true))
    (operator '+'
        (variable '$total' false)
        (variable '$this' false))
    (literal 'integer' 0))
```

### 5.3 Regular Methods (all others)

Methods that don't change $this for their arguments:

#### Collection methods
```fhirpath
// count()
name.count()
-> (method 'count'
    (member 'name' (variable '$this' true)))

// first()
name.first()
-> (method 'first'
    (member 'name' (variable '$this' true)))

// last()
name.last()
-> (method 'last'
    (member 'name' (variable '$this' true)))

// tail()
name.tail()
-> (method 'tail'
    (member 'name' (variable '$this' true)))

// skip(num)
name.skip(2)
-> (method 'skip'
    (member 'name' (variable '$this' true))
    (literal 'integer' 2))

// take(num)
name.take(3)
-> (method 'take'
    (member 'name' (variable '$this' true))
    (literal 'integer' 3))

// distinct()
code.distinct()
-> (method 'distinct'
    (member 'code' (variable '$this' true)))

// empty()
name.empty()
-> (method 'empty'
    (member 'name' (variable '$this' true)))
```

#### Type checking
```fhirpath
// ofType(type)
value.ofType(Quantity)
-> (method 'ofType'
    (member 'value' (variable '$this' true))
    (type 'Quantity'))
```

#### String methods
```fhirpath
// startsWith(prefix)
name.startsWith('John')
-> (method 'startsWith'
    (member 'name' (variable '$this' true))
    (literal 'string' 'John'))

// endsWith(suffix)
name.endsWith('son')
-> (method 'endsWith'
    (member 'name' (variable '$this' true))
    (literal 'string' 'son'))

// contains(substring)
name.contains('oh')
-> (method 'contains'
    (member 'name' (variable '$this' true))
    (literal 'string' 'oh'))

// substring(start [, length])
name.substring(0, 3)
-> (method 'substring'
    (member 'name' (variable '$this' true))
    (literal 'integer' 0)
    (literal 'integer' 3))

// upper()
name.upper()
-> (method 'upper'
    (member 'name' (variable '$this' true)))

// lower()
name.lower()
-> (method 'lower'
    (member 'name' (variable '$this' true)))

// replace(pattern, substitution)
text.replace('old', 'new')
-> (method 'replace'
    (member 'text' (variable '$this' true))
    (literal 'string' 'old')
    (literal 'string' 'new'))

// matches(regex)
email.matches('^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$')
-> (method 'matches'
    (member 'email' (variable '$this' true))
    (literal 'string' '^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$'))

// indexOf(substring)
text.indexOf('search')
-> (method 'indexOf'
    (member 'text' (variable '$this' true))
    (literal 'string' 'search'))

// length()
name.length()
-> (method 'length'
    (member 'name' (variable '$this' true)))

// toChars()
'abc'.toChars()
-> (method 'toChars'
    (literal 'string' 'abc'))

// trim()
name.trim()
-> (method 'trim'
    (member 'name' (variable '$this' true)))
```

#### Math methods
```fhirpath
// abs()
value.abs()
-> (method 'abs'
    (member 'value' (variable '$this' true)))

// ceiling()
value.ceiling()
-> (method 'ceiling'
    (member 'value' (variable '$this' true)))

// floor()
value.floor()
-> (method 'floor'
    (member 'value' (variable '$this' true)))

// truncate()
value.truncate()
-> (method 'truncate'
    (member 'value' (variable '$this' true)))

// round([precision])
value.round(2)
-> (method 'round'
    (member 'value' (variable '$this' true))
    (literal 'integer' 2))

// sqrt()
value.sqrt()
-> (method 'sqrt'
    (member 'value' (variable '$this' true)))

// ln()
value.ln()
-> (method 'ln'
    (member 'value' (variable '$this' true)))

// log(base)
value.log(10)
-> (method 'log'
    (member 'value' (variable '$this' true))
    (literal 'integer' 10))

// exp()
value.exp()
-> (method 'exp'
    (member 'value' (variable '$this' true)))

// power(exponent)
value.power(2)
-> (method 'power'
    (member 'value' (variable '$this' true))
    (literal 'integer' 2))
```

#### Date/Time methods
```fhirpath
// toDate()
dateTime.toDate()
-> (method 'toDate'
    (member 'dateTime' (variable '$this' true)))

// toDateTime()
date.toDateTime()
-> (method 'toDateTime'
    (member 'date' (variable '$this' true)))

// toTime()
dateTime.toTime()
-> (method 'toTime'
    (member 'dateTime' (variable '$this' true)))
```

#### Conversion methods
```fhirpath
// convertsToBoolean()
value.convertsToBoolean()
-> (method 'convertsToBoolean'
    (member 'value' (variable '$this' true)))

// toBoolean()
value.toBoolean()
-> (method 'toBoolean'
    (member 'value' (variable '$this' true)))

// convertsToInteger()
value.convertsToInteger()
-> (method 'convertsToInteger'
    (member 'value' (variable '$this' true)))

// toInteger()
value.toInteger()
-> (method 'toInteger'
    (member 'value' (variable '$this' true)))

// convertsToDecimal()
value.convertsToDecimal()
-> (method 'convertsToDecimal'
    (member 'value' (variable '$this' true)))

// toDecimal()
value.toDecimal()
-> (method 'toDecimal'
    (member 'value' (variable '$this' true)))

// convertsToString()
value.convertsToString()
-> (method 'convertsToString'
    (member 'value' (variable '$this' true)))

// toString()
value.toString()
-> (method 'toString'
    (member 'value' (variable '$this' true)))

// convertsToQuantity([unit])
value.convertsToQuantity('mg')
-> (method 'convertsToQuantity'
    (member 'value' (variable '$this' true))
    (literal 'string' 'mg'))

// toQuantity([unit])
value.toQuantity('mg')
-> (method 'toQuantity'
    (member 'value' (variable '$this' true))
    (literal 'string' 'mg'))
```

#### FHIR-specific methods
```fhirpath
// extension(url)
Patient.extension('http://example.org/ext')
-> (method 'extension'
    (member 'Patient' (variable '$this' true))
    (literal 'string' 'http://example.org/ext'))

// hasValue()
value.hasValue()
-> (method 'hasValue'
    (member 'value' (variable '$this' true)))

// getValue()
value.getValue()
-> (method 'getValue'
    (member 'value' (variable '$this' true)))

// resolve()
reference.resolve()
-> (method 'resolve'
    (member 'reference' (variable '$this' true)))

// memberOf(valueset)
code.memberOf('http://hl7.org/fhir/ValueSet/example')
-> (method 'memberOf'
    (member 'code' (variable '$this' true))
    (literal 'string' 'http://hl7.org/fhir/ValueSet/example'))

// subsumes(code)
code.subsumes(otherCode)
-> (method 'subsumes'
    (member 'code' (variable '$this' true))
    (member 'otherCode' (variable '$this' true)))

// subsumedBy(code)
code.subsumedBy(parentCode)
-> (method 'subsumedBy'
    (member 'code' (variable '$this' true))
    (member 'parentCode' (variable '$this' true)))
```

#### Collection operations
```fhirpath
// union(other)
name.given.union(name.suffix)
-> (method 'union'
    (member 'given' (member 'name' (variable '$this' true)))
    (member 'suffix' (member 'name' (variable '$this' true))))

// intersect(other)
codes.intersect(allowedCodes)
-> (method 'intersect'
    (member 'codes' (variable '$this' true))
    (member 'allowedCodes' (variable '$this' true)))

// exclude(other)
allItems.exclude(deletedItems)
-> (method 'exclude'
    (member 'allItems' (variable '$this' true))
    (member 'deletedItems' (variable '$this' true)))

// combine(other)
list1.combine(list2)
-> (method 'combine'
    (member 'list1' (variable '$this' true))
    (member 'list2' (variable '$this' true)))
```

#### Existence methods
```fhirpath
// empty()
name.empty()
-> (method 'empty'
    (member 'name' (variable '$this' true)))

// not()
active.not()
-> (method 'not'
    (member 'active' (variable '$this' true)))

// allTrue()
flags.allTrue()
-> (method 'allTrue'
    (member 'flags' (variable '$this' true)))

// anyTrue()
flags.anyTrue()
-> (method 'anyTrue'
    (member 'flags' (variable '$this' true)))

// allFalse()
flags.allFalse()
-> (method 'allFalse'
    (member 'flags' (variable '$this' true)))

// anyFalse()
flags.anyFalse()
-> (method 'anyFalse'
    (member 'flags' (variable '$this' true)))

// subsetOf(other)
requiredCodes.subsetOf(providedCodes)
-> (method 'subsetOf'
    (member 'requiredCodes' (variable '$this' true))
    (member 'providedCodes' (variable '$this' true)))

// supersetOf(other)
allowedValues.supersetOf(actualValues)
-> (method 'supersetOf'
    (member 'allowedValues' (variable '$this' true))
    (member 'actualValues' (variable '$this' true)))
```

#### Singleton methods (require single item)
```fhirpath
// single()
identifier.where(system = 'ssn').single()
-> (method 'single'
    (method 'where'
        (member 'identifier' (variable '$this' true))
        (operator '='
            (member 'system' (variable '$this' true))
            (literal 'string' 'ssn'))))
```

### 5.4 Special Forms (like standalone functions)

Special forms cannot be chained from the left side, only from the right (like standalone functions).

#### iif (immediate if)
```fhirpath
iif(condition, thenResult, elseResult)
-> (if 
    (member 'condition' (variable '$this' true))
    (member 'thenResult' (variable '$this' true))
    (member 'elseResult' (variable '$this' true)))

// Example
iif(age >= 18, 'adult', 'minor')
-> (if
    (operator '>='
        (member 'age' (variable '$this' true))
        (literal 'integer' 18))
    (literal 'string' 'adult')
    (literal 'string' 'minor'))

// Can only be chained from the right
iif(status = 'active', priority, 0).first()
-> (method 'first'
    (if
        (operator '='
            (member 'status' (variable '$this' true))
            (literal 'string' 'active'))
        (member 'priority' (variable '$this' true))
        (literal 'integer' 0)))

// INVALID: Patient.iif(...) - cannot chain from left
```

#### defineVariable (variable definition)
```fhirpath
defineVariable(name, value)
-> (define-var
    (literal 'string' 'name')
    (member 'value' (variable '$this' true)))

// Example - define a variable and use it
defineVariable('firstGiven', name.first().given) | %firstGiven
-> (operator '|'
    (define-var
        (literal 'string' 'firstGiven')
        (member 'given'
            (method 'first'
                (member 'name' (variable '$this' true)))))
    (env-var 'firstGiven'))

// Complex example with multiple variable definitions
defineVariable('n1', name.first()).where(active.not()) | defineVariable('n1', name.skip(1).first()).select(%n1.given)
-> (operator '|'
    (method 'where'
        (define-var
            (literal 'string' 'n1')
            (method 'first'
                (member 'name' (variable '$this' true))))
        (method 'not'
            (member 'active' (variable '$this' true))))
    (method 'select'
        (define-var
            (literal 'string' 'n1')
            (method 'first'
                (method 'skip'
                    (member 'name' (variable '$this' true))
                    (literal 'integer' 1))))
        (member 'given'
            (env-var 'n1'))))

// Can be chained from the right
defineVariable('pt', Patient).name
-> (member 'name'
    (define-var
        (literal 'string' 'pt')
        (member 'Patient' (variable '$this' true))))

// INVALID: Patient.defineVariable(...) - cannot chain from left
```

## 6. Complex Examples

### Chained operations
```fhirpath
Patient.name.where(use = 'official').given.first()
-> (method 'first'
    (member 'given'
        (method 'where'
            (member 'name' (member 'Patient' (variable '$this' true)))
            (operator '='
                (member 'use' (variable '$this' true))
                (literal 'string' 'official')))))
```

### Union of filtered collections
```fhirpath
Patient.name.where(use = 'official').given | Patient.name.where(use = 'nickname').given
-> (operator '|'
    (member 'given'
        (method 'where'
            (member 'name' (member 'Patient' (variable '$this' true)))
            (operator '='
                (member 'use' (variable '$this' true))
                (literal 'string' 'official'))))
    (member 'given'
        (method 'where'
            (member 'name' (member 'Patient' (variable '$this' true)))
            (operator '='
                (member 'use' (variable '$this' true))
                (literal 'string' 'nickname')))))
```

### Nested select with string manipulation
```fhirpath
Patient.name.select(given.first() + ' ' + family.upper())
-> (method 'select'
    (member 'name' (member 'Patient' (variable '$this' true)))
    (operator '+'
        (operator '+'
            (method 'first'
                (member 'given' (variable '$this' true)))
            (literal 'string' ' '))
        (method 'upper'
            (member 'family' (variable '$this' true)))))
```

### Aggregate with complex expression
```fhirpath
value.aggregate(iif($total.empty(), $this, iif($this < $total, $this, $total)))
-> (method 'aggregate'
    (member 'value' (variable '$this' true))
    (if
        (method 'empty'
            (variable '$total' false))
        (variable '$this' false)
        (if
            (operator '<'
                (variable '$this' false)
                (variable '$total' false))
            (variable '$this' false)
            (variable '$total' false))))
```

### Type checking with navigation
```fhirpath
Observation.value.ofType(Quantity).where(value > 100 and unit = 'mg/dL')
-> (method 'where'
    (method 'ofType'
        (member 'value' (member 'Observation' (variable '$this' true)))
        (type 'Quantity'))
    (operator 'and'
        (operator '>'
            (member 'value' (variable '$this' true))
            (literal 'integer' 100))
        (operator '='
            (member 'unit' (variable '$this' true))
            (literal 'string' 'mg/dL'))))
```

### Environment variables in expressions
```fhirpath
code.memberOf(%`vs-observation-status`)
-> (method 'memberOf'
    (member 'code' (variable '$this' true))
    (env-var 'vs-observation-status'))

extension(%`ext-data-absent-reason`).exists()
-> (method 'exists'
    (method 'extension'
        (variable '$this' true)
        (env-var 'ext-data-absent-reason')))
```

## 7. Function Argument Context Rules

### Regular methods - arguments evaluated in outer context
```fhirpath
// 'length()' is evaluated in the context of '123456789', not Patient
'123456789'.substring(length() - 4)
-> (method 'substring'
    (literal 'string' '123456789')
    (operator '-'
        (method 'length'
            (literal 'string' '123456789'))
        (literal 'integer' 4)))
```

### Iterative functions - arguments evaluated with inner $this
```fhirpath
// 'given' refers to $this (each name), not Patient
Patient.name.select(given)
-> (method 'select'
    (member 'name' (member 'Patient' (variable '$this' true)))
    (member 'given' (variable '$this' true)))
```

## 8. Notes

1. **Implicit $this**: The parser adds `[implicit]` marker to distinguish parser-added vs user-written `$this`
2. **Type identifiers**: Type names in `is`/`as` expressions are represented as `(type 'TypeName')`
3. **Method chaining**: Methods always take their context as the first implicit argument
4. **Standalone functions**: Only `today()`, `now()`, and `timeOfDay()` are true functions without context
5. **Special forms**: `iif` (lazy evaluation) and `defineVariable` (creates scoped variables)