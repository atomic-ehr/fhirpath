import { lex } from '../src/lexer/lexer';
import { formatError } from '../src/lexer/errors';
import { LexerError } from '../src/lexer/errors';

// Example 1: Simple expression
console.log('=== Example 1: Simple expression ===');
const tokens1 = lex('Patient.name.given');
tokens1.forEach(token => {
  console.log(`${token.type.padEnd(15)} | ${token.value.padEnd(10)} | Line ${token.position.line}:${token.position.column}`);
});

// Example 2: Complex expression with operators
console.log('\n=== Example 2: Complex expression ===');
const tokens2 = lex("age >= 18 and status = 'active'");
tokens2.forEach(token => {
  console.log(`${token.type.padEnd(15)} | ${token.value.padEnd(10)} | Line ${token.position.line}:${token.position.column}`);
});

// Example 3: Date/time literals
console.log('\n=== Example 3: Date/time literals ===');
const tokens3 = lex('@2024-01-15T10:30:00Z > @2024-01-01');
tokens3.forEach(token => {
  console.log(`${token.type.padEnd(15)} | ${token.value.padEnd(10)} | Line ${token.position.line}:${token.position.column}`);
});

// Example 4: Error handling
console.log('\n=== Example 4: Error handling ===');
const errorInput = "name.where(use = 'official";
try {
  lex(errorInput);
} catch (e) {
  if (e instanceof LexerError) {
    console.log('Error caught:');
    console.log(formatError(e, errorInput));
  }
}

// Example 5: Special variables and environment
console.log('\n=== Example 5: Special variables ===');
const tokens5 = lex('$this.name[0] where $index < $total and %context');
tokens5.forEach(token => {
  console.log(`${token.type.padEnd(15)} | ${token.value.padEnd(10)} | Line ${token.position.line}:${token.position.column}`);
});