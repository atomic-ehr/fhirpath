# ADR 001: Public Interface


```typescript

import { evaluate } from './index';

let context = {};
let patient = { name: { given: 'John' } };

let result = evaluate(context, {expression: 'Patient.name.given', input: patient, variables: {}})

let getGiven = compile(context, 'Patient.name.given');
let result = getGiven(patient); // ['John']

let diagnostic = analyze(context, {expression: 'Patient.name.given', input: patient});

diagnostic.errors // []
diagnostic.warnings // []
diagnostic.ast // ASTNode
diagnostic.result // ['John']


lookup(context, {operator: '|'})

let suggestions = suggest(context, {expression: 'Patient.name.', input: patient});


```