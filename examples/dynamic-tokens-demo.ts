import { DynamicRegistry } from '../src/dynamic-registry';
import { DynamicLexer } from '../src/dynamic-lexer';

console.log('=== Dynamic Token System Demo ===\n');

// Create a registry
const registry = new DynamicRegistry();

// Register standard FHIRPath operators
const standardOps = [
  { symbol: '+', name: 'plus', precedence: 70 },
  { symbol: '-', name: 'minus', precedence: 70 },
  { symbol: '*', name: 'multiply', precedence: 80 },
  { symbol: '/', name: 'divide', precedence: 80 },
  { symbol: '=', name: 'equal', precedence: 40 },
  { symbol: 'and', name: 'and', precedence: 30 },
  { symbol: 'or', name: 'or', precedence: 20 },
];

console.log('Registering standard operators:');
const tokenMap: Record<string, number> = {};

standardOps.forEach(op => {
  const token = registry.registerOperator({
    symbol: op.symbol,
    name: op.name,
    category: ['standard'],
    precedence: op.precedence,
    associativity: 'left',
    description: `${op.name} operator`,
    examples: [],
    signatures: []
  });
  
  tokenMap[op.symbol] = token;
  console.log(`  ${op.symbol} -> Token #${token} (${registry.getTokenName(token)})`);
});

// Now add custom operators
console.log('\nRegistering custom operators:');

const customOps = [
  { symbol: '**', name: 'power', precedence: 90, associativity: 'right' as const },
  { symbol: '??', name: 'null-coalesce', precedence: 35, associativity: 'left' as const },
  { symbol: '...', name: 'spread', precedence: 5, associativity: 'left' as const },
];

customOps.forEach(op => {
  const token = registry.registerOperator({
    symbol: op.symbol,
    name: op.name,
    category: ['custom'],
    precedence: op.precedence,
    associativity: op.associativity,
    description: `${op.name} operator`,
    examples: [],
    signatures: []
  });
  
  console.log(`  ${op.symbol} -> Token #${token} (${registry.getTokenName(token)})`);
});

// Test lexing
console.log('\n=== Lexing Examples ===');

const examples = [
  '2 + 3 * 4',
  '2 ** 3 ** 2',  // Right associative
  'value ?? default',
  'true and false or x',
  'items...',
];

examples.forEach(expr => {
  console.log(`\nExpression: "${expr}"`);
  const lexer = new DynamicLexer(expr, registry);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.forEach((token, i) => {
    if (token.type === tokens[tokens.length - 1].type) return; // Skip EOF
    
    const value = lexer.getTokenValue(token);
    const name = lexer.getTokenName(token);
    const precedence = registry.getPrecedence(token.type);
    const assoc = registry.getAssociativity(token.type);
    
    let info = `  [${i}] "${value}" -> ${name}`;
    if (precedence >= 0) {
      info += ` (prec: ${precedence}, assoc: ${assoc})`;
    }
    console.log(info);
  });
});

// Show benefits
console.log('\n=== Benefits of Dynamic Token System ===');
console.log('1. Single source of truth - Registry defines both tokens and operators');
console.log('2. No need to modify TokenType enum when adding operators');
console.log('3. Operators can be loaded from configuration or plugins');
console.log('4. Token types are automatically allocated');
console.log('5. Parser can query operator properties using token type');

// Export token definitions
console.log('\n=== Exported Token Definitions ===');
const exportedTokens = registry.exportTokenDefinitions();
console.log('Static tokens:', Object.keys(exportedTokens).filter(k => !k.startsWith('OP_')).length);
console.log('Dynamic operator tokens:', Object.keys(exportedTokens).filter(k => k.startsWith('OP_')).length);
console.log('\nSample exports:');
Object.entries(exportedTokens)
  .filter(([k]) => k.startsWith('OP_'))
  .slice(0, 5)
  .forEach(([name, value]) => {
    console.log(`  ${name} = ${value}`);
  });