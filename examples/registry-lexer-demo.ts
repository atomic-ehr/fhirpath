import { RegistryBasedLexer } from '../src/registry-based-lexer';
import { Registry, defaultRegistry } from '../src/registry';
import { TokenType } from '../src/lexer';
import type { BinaryOperator } from '../src/registry';

// Example 1: Using the default registry
console.log('=== Example 1: Default Registry ===');
const lexer1 = new RegistryBasedLexer('Patient.name where use = "official" and active');
const tokens1 = lexer1.tokenize();

console.log('Tokens:');
tokens1.forEach(token => {
  if (token.type !== TokenType.EOF) {
    const value = lexer1.getTokenValue(token);
    const precedence = defaultRegistry.getPrecedence(token.type);
    console.log(`  ${value} -> ${TokenType[token.type]}${precedence >= 0 ? ` (precedence: ${precedence})` : ''}`);
  }
});

// Example 2: Custom registry with new operators
console.log('\n=== Example 2: Custom Registry with Power Operator ===');
const customRegistry = new Registry();

// Copy existing operators
[TokenType.PLUS, TokenType.MULTIPLY].forEach(tokenType => {
  const op = defaultRegistry.getBinaryOperator(tokenType);
  if (op) customRegistry.registerBinaryOperator(op);
});

// Add custom power operator
const powerOp: BinaryOperator = {
  symbol: '**',
  name: 'power',
  tokenType: TokenType.MULTIPLY, // Reusing token type for demo
  category: ['arithmetic'],
  precedence: 95, // Higher than multiply
  associativity: 'right',
  description: 'Exponentiation',
  examples: ['2 ** 3 ** 2'],
  signatures: [{
    name: 'power',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};

customRegistry.registerBinaryOperator(powerOp);

const lexer2 = new RegistryBasedLexer('2 ** 3 * 4 + 5', {}, customRegistry);
const tokens2 = lexer2.tokenize();

console.log('Tokens with precedence:');
tokens2.forEach(token => {
  if (token.type !== TokenType.EOF) {
    const value = lexer2.getTokenValue(token);
    const precedence = customRegistry.getPrecedence(token.type);
    console.log(`  ${value} -> ${TokenType[token.type]}${precedence >= 0 ? ` (precedence: ${precedence})` : ''}`);
  }
});

// Example 3: Benefits of registry-based approach
console.log('\n=== Example 3: Registry Benefits ===');
console.log('1. Single source of truth for operators');
console.log('2. Easy to add new operators without modifying lexer');
console.log('3. Precedence information available during parsing');
console.log('4. Type signatures available for validation');

// Show operator info
const plusOp = defaultRegistry.getBinaryOperator(TokenType.PLUS);
if (plusOp) {
  console.log('\nPlus operator details:');
  console.log(`  Symbol: ${plusOp.symbol}`);
  console.log(`  Precedence: ${plusOp.precedence}`);
  console.log(`  Associativity: ${plusOp.associativity}`);
  console.log(`  Signatures: ${plusOp.signatures.length}`);
  plusOp.signatures.forEach(sig => {
    console.log(`    - ${sig.left.type} + ${sig.right.type} -> ${sig.result.type}`);
  });
}