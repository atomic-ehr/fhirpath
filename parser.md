# FHIRPath parser design by example

* Operators: expr op expr -> (operator <op> <expr> <expr>)
* Functions: function(expr) -> (function <function> <expr>)
* Methods:  expr.method(expr) -> (method <method> <context> <expr> <expr>)
* Literals: literal(type, value) -> (literal <type> <value>)
* Member: expr.attr -> (member <attr> <context>)
* Index: expr[expr] -> (index <context> <expr>)
* Special forms: iif(expr, expr, expr) -> (iif <expr> <expr> <expr>)
* Special forms: defineVariable(name, expr) -> (define-var <name> <expr>)


Implicit $this added to the top of the expression:
`name` 
-> (member 'name' $this[implicit])

`Patient.name` 
-> (member 'name' 
     (member 'Patient' $this[implicit]))

`Patient.name.given`
-> (member 'given' 
     (member 'name' 
        (member 'Patient' $this[implicit])))

methods (<function>(<args,>)) are chained and getting context from the left side as first argument.

`Patient.name.given.first()`
-> (method 'first' 
     (member 'given' 
        (member 'name' 
           (member 'Patient' $this[implicit]))))

methods like `where` are special (high order function) and redefine `$this` for nested expressions.
`Patient.name.where(use='official')` 
-> (method 'where' 
    (member 'name' (member 'Patient' $this[implicit])) 
    (op '=' (member 'use' $this) (literal 'string' 'official')))

`Patient.name.where($this.use='official')` 
-> (method 'where' 
    (member 'name' (member 'Patient' $this)) 
    (op '=' (member 'use' $this) (literal 'string' 'official')))

`1 + 2`
-> (op '+' 
     (literal 'integer' 1) 
     (literal 'integer' 2))

`Patient.name | Patient.contact.name`
-> (op '|' 
    (member 'name' 
      (member 'Patient' $this[implicit])) 
    (member 'name' 
      (member 'contact' (member 'Patient' $this[implicit]))))

Not high order function are not redefining `$this` for nested expressions.
`Patient.name.union(Patient.contact.name)` = `$this.Patient.name.union($this.Patient.contact.name)`
-> (op 'union' 
    (member 'name' 
      (member 'Patient' $this[implicit])) 
    (member 'name' 
      (member 'contact' 
        (member 'Patient' $this[implicit]))))

`Patient.name.where(use='official').given`
-> (member 'given'
     (method 'where' 
      (member 'name' (member 'Patient' $this[implicit])) 
      (op '=' (member 'use' $this[implicit]) (literal 'string' 'official'))))

`today()` and `now()` are functions that could not be chained from left side.

`today()`
-> (function 'today')

`Patient.birthDate != today()`
-> (op '!=' 
     (member 'birthDate' (member 'Patient' $this[implicit])) 
     (function 'today'))

But can be chained from right side.

`today().toDate()`
-> (function 'toDate' 
     (function 'today'))


`iif` is a special form that is not a function (cannot be chained from left).
`iif(birthDate < today(), 'old', 'young')`
-> (iif
     (op '<' 
      (member 'birthDate' $this[implicit]) 
      (function 'today')) 
     (literal 'string' 'old') 
     (literal 'string' 'young'))

`Patient.name.where(use='official').given.first().substring(0, 1)`
->  (method 'substring' 
     (method 'first' 
      (method 'where' 
       (member 'name' (member 'Patient' $this)) 
       (op '=' (member 'use' $this) (literal 'string' 'official')))) 
     (literal 'integer' 0) 
     (literal 'integer' 1))

`Patient.name.given.select(substring(0, 1))` = `$this.Patient.name.given.select($this.substring(0, 1))`
-> (method 'select' 
     (member 'given' (member 'name' (member 'Patient' $this)))
     (method 'substring' 
      $this[implicit]
      (literal 'integer' 0) 
      (literal 'integer' 1)))


`Patient.name[0].given` = `$this.Patient.name[0].given`
-> (member 'given' 
      (index (member 'name' (member 'Patient' $this[implicit])) 
      (literal 'integer' 0)))