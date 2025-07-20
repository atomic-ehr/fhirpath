# Task 007: Implement Core Functions and Operators

## Overview
Extend the FHIRPath interpreter with essential functions and operators that are fundamental for real-world usage. This task focuses on HIGH PRIORITY items that provide the most value.

## Implementation Priority

### Phase 1: Essential Operators
These operators are fundamental and used in almost every FHIRPath expression:

#### 1.1 Type Operators
- [ ] `is` operator - type checking (e.g., `resource.is(Patient)`)
- [ ] `as` operator - type casting (e.g., `resource.as(Patient)`)

#### 1.2 Collection Operators  
- [ ] `in` operator - membership test (e.g., `'active' in status`)
- [ ] `contains` operator - containership test (e.g., `status contains 'active'`)

#### 1.3 String Concatenation
- [ ] `&` operator - null-safe string concatenation (e.g., `given & ' ' & family`)

### Phase 2: Essential Functions

#### 2.1 Existence Functions
```fhirpath
// Core existence checks
empty() : Boolean
exists([criteria : expression]) : Boolean
count() : Integer
```

#### 2.2 Subsetting Functions
```fhirpath
// Essential navigation
[index] : T  // Indexer operator
last() : T
tail() : collection
skip(n : Integer) : collection
take(n : Integer) : collection
```

#### 2.3 String Functions
```fhirpath
// Most commonly used string operations
contains(substring : String) : Boolean
length() : Integer
substring(start : Integer [, length : Integer]) : String
startsWith(prefix : String) : Boolean
endsWith(suffix : String) : Boolean
upper() : String
lower() : String
replace(pattern : String, replacement : String) : String
```

#### 2.4 Conversion Functions
```fhirpath
// Essential type conversions
toString() : String
toInteger() : Integer
toDecimal() : Decimal
toBoolean() : Boolean
```

### Phase 3: Collection Functions

#### 3.1 Set Operations
```fhirpath
// Collection manipulation
distinct() : collection
union(other : collection) : collection  // Removes duplicates
combine(other : collection) : collection  // Keeps duplicates
intersect(other : collection) : collection
exclude(other : collection) : collection
```

#### 3.2 Boolean Aggregates
```fhirpath
// Aggregate boolean operations
all(criteria : expression) : Boolean
anyTrue() : Boolean
allTrue() : Boolean
anyFalse() : Boolean
allFalse() : Boolean
```

### Phase 4: Math Functions
```fhirpath
// Common math operations
abs() : Number
ceiling() : Integer
floor() : Integer
round([precision : Integer]) : Number
sqrt() : Decimal
```

## Implementation Details

### Type Operators (is/as)
The `is` operator checks if items match a type:
```fhirpath
Patient.contact.where(relationship.is(CodeableConcept))
```

The `as` operator performs type casting (returns empty if cast fails):
```fhirpath
Bundle.entry.resource.as(Patient).name
```

Implementation notes:
- Need type registry/checking system
- Should support FHIR resource types and primitives
- `as` returns empty collection if type doesn't match

### Collection Operators (in/contains)
```fhirpath
// 'in' - item in collection
'active' in Patient.active
5 in (1 | 2 | 3 | 4 | 5)

// 'contains' - collection contains item  
Patient.name.given contains 'John'
(1 | 2 | 3) contains 2
```

Implementation notes:
- Use collection equality rules
- Empty propagation applies
- Singleton conversion applies

### String Concatenation (&)
```fhirpath
// Null-safe concatenation
Patient.name.given & ' ' & Patient.name.family
// If given is empty, entire result is empty
```

Implementation notes:
- If any operand is empty, result is empty
- Only works with strings
- Different from `+` which throws on null

### Existence Functions
```fhirpath
Patient.name.empty()  // true if no names
Patient.name.exists() // true if has names
Patient.name.exists(use = 'official') // true if has official name
Patient.identifier.count() // number of identifiers
```

### Subsetting Functions
```fhirpath
Patient.name[0]        // First name (empty if none)
Patient.name.last()    // Last name
Patient.name.tail()    // All but first
Patient.name.skip(2)   // Skip first 2
Patient.name.take(3)   // Take first 3
```

Implementation notes:
- Indexer uses 0-based indexing
- Out of bounds returns empty
- Negative indices not supported

### String Functions
All string functions operate on single strings (singleton conversion):
```fhirpath
Patient.name.family.contains('Smith')
Patient.name.given.first().length()
Patient.name.family.substring(0, 3)
Patient.identifier.value.startsWith('MRN')
```

### Type Conversion Functions
```fhirpath
age.toString()         // Convert to string
'123'.toInteger()      // Convert to integer
'12.5'.toDecimal()     // Convert to decimal
active.toBoolean()     // Convert to boolean
```

Implementation notes:
- Return empty if conversion fails
- Follow FHIRPath conversion rules
- Consider implementing convertsToX() functions

### Collection Functions
```fhirpath
// Remove duplicates
Patient.name.given.distinct()

// Set operations
list1.union(list2)     // Unique items from both
list1.combine(list2)   // All items from both
list1.intersect(list2) // Common items
list1.exclude(list2)   // Items in list1 not in list2
```

### Boolean Aggregates
```fhirpath
Patient.contact.all(relationship.exists())  // All have relationship
Patient.condition.verificationStatus.allTrue()  // All are true
```

## Test Cases

### Type Operators
```typescript
// is operator
"Bundle.entry.resource.where($this.is(Patient))"
"value.is(Integer)"
"element.is(CodeableConcept)"

// as operator  
"Bundle.entry.resource.as(Patient).name"
"value.as(String).length()"
```

### Collection Operators
```typescript
// in operator
"'active' in status"
"5 in {1, 2, 3, 4, 5}"
"{} in {1, 2, 3}" // false

// contains operator
"name.given contains 'John'"
"{1, 2, 3} contains 2"
```

### String Functions
```typescript
"name.family.contains('Smith')"
"identifier.value.length()"
"name.given.first().substring(0, 1)"
"code.startsWith('ICD')"
"display.upper()"
"text.replace('old', 'new')"
```

### Existence and Counting
```typescript
"name.empty()"
"identifier.exists()"
"contact.exists(relationship.coding.exists())"
"address.count()"
```

### Subsetting
```typescript
"name[0].given"
"address.last().city"
"identifier.tail().value"
"entry.skip(10).take(5)"
```

### Conversions
```typescript
"'123'.toInteger() + 1"
"value.toString().length()"
"'true'.toBoolean() and active"
```

## Success Criteria

1. All operators work with proper precedence
2. Functions handle empty collections correctly
3. Type checking/casting works for common types
4. String functions handle null/empty properly
5. Collection functions preserve order where specified
6. Conversions follow FHIRPath rules
7. Comprehensive test coverage
8. Clear error messages

## Technical Considerations

### Type System
- Need to implement basic type checking
- Start with primitive types and add FHIR types later
- Type registry for extensibility

### Operator Precedence
- Ensure `is` and `as` have correct precedence
- `in` and `contains` are comparison operators

### Performance
- Optimize common operations like `exists()` and `empty()`
- Consider lazy evaluation for `all()` and similar functions
- Efficient set operations for `distinct()`, `union()`, etc.

### Error Handling
- Type mismatches should return empty (not error)
- Clear messages for invalid arguments
- Helpful errors for common mistakes

## Resources
- FHIRPath spec sections 6.1-6.7
- Existing function registry pattern
- Current operator implementation

## Next Steps
After this task, we should implement:
1. Date/time functions and arithmetic
2. Math functions (advanced)
3. Type-specific functions (FHIR resources)
4. Aggregate functions (sum, avg, min, max)