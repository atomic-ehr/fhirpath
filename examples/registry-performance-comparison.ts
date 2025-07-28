import { DynamicRegistry } from '../src/dynamic-registry';
import { DynamicRegistryOptimized } from '../src/dynamic-registry-optimized';

console.log('=== Registry Performance Comparison ===\n');

// Create both registries
const basicRegistry = new DynamicRegistry();
const optimizedRegistry = new DynamicRegistryOptimized();

// Register same operators in both
const operators = [
  { symbol: '+', name: 'plus', precedence: 70 },
  { symbol: '-', name: 'minus', precedence: 70 },
  { symbol: '*', name: 'multiply', precedence: 80 },
  { symbol: '/', name: 'divide', precedence: 80 },
  { symbol: '**', name: 'power', precedence: 90 },
  { symbol: '=', name: 'equal', precedence: 40 },
  { symbol: '>', name: 'greater', precedence: 50 },
  { symbol: 'and', name: 'and', precedence: 30 },
  { symbol: 'or', name: 'or', precedence: 20 },
];

const basicTokens: number[] = [];
const optimizedTokens: number[] = [];

operators.forEach(op => {
  const basicToken = basicRegistry.registerOperator({
    symbol: op.symbol,
    name: op.name,
    category: ['test'],
    precedence: op.precedence,
    associativity: 'left',
    description: 'Test',
    examples: [],
    signatures: []
  });
  
  const optimizedToken = optimizedRegistry.registerOperator({
    symbol: op.symbol,
    name: op.name,
    category: ['test'],
    precedence: op.precedence,
    associativity: 'left',
    description: 'Test',
    examples: [],
    signatures: []
  });
  
  basicTokens.push(basicToken);
  optimizedTokens.push(optimizedToken);
});

// Show token encoding
console.log('Token Encoding Comparison:');
console.log('Symbol | Basic Token | Optimized Token | Decoded');
console.log('-------|-------------|-----------------|--------');
operators.forEach((op, i) => {
  const decoded = optimizedRegistry.decodeToken(optimizedTokens[i]);
  console.log(
    `${op.symbol.padEnd(6)} | ${basicTokens[i].toString().padEnd(11)} | 0x${optimizedTokens[i].toString(16).padStart(8, '0')} | precedence=${decoded.precedence}, id=${decoded.id}`
  );
});

// Performance comparison
console.log('\n=== Performance Comparison ===\n');

const iterations = 1000000;

// Test basic registry
console.log('Basic Registry (Map lookup):');
let start = performance.now();
for (let i = 0; i < iterations; i++) {
  basicRegistry.getPrecedence(basicTokens[i % basicTokens.length]);
}
let end = performance.now();
const basicTime = end - start;
console.log(`  ${iterations} lookups: ${basicTime.toFixed(2)}ms`);
console.log(`  Per lookup: ${((basicTime / iterations) * 1000000).toFixed(2)}ns`);

// Test optimized registry
console.log('\nOptimized Registry (bit shift):');
start = performance.now();
for (let i = 0; i < iterations; i++) {
  optimizedRegistry.getPrecedence(optimizedTokens[i % optimizedTokens.length]);
}
end = performance.now();
const optimizedTime = end - start;
console.log(`  ${iterations} lookups: ${optimizedTime.toFixed(2)}ms`);
console.log(`  Per lookup: ${((optimizedTime / iterations) * 1000000).toFixed(2)}ns`);

console.log(`\nSpeedup: ${(basicTime / optimizedTime).toFixed(1)}x faster`);

// Show benefits
console.log('\n=== Benefits of Bit-Encoded Precedence ===');
console.log('1. Constant-time precedence lookup (just a bit shift)');
console.log('2. No memory allocation during lookup');
console.log('3. Better CPU cache utilization');
console.log('4. Token value contains all needed information');
console.log('5. Compatible with existing parser precedence logic');

// Example usage in parser
console.log('\n=== Usage in Parser ===');
console.log('```typescript');
console.log('// In parser\'s precedence climbing:');
console.log('const precedence = tokenType >>> 24; // Super fast!');
console.log('if (precedence < minPrecedence) break;');
console.log('```');

// Memory comparison
console.log('\n=== Memory Usage ===');
console.log('Basic Registry:');
console.log('  - Map<TokenType, Operator> for operators');
console.log('  - Additional lookup for each precedence check');
console.log('\nOptimized Registry:');
console.log('  - Precedence encoded in token itself');
console.log('  - No additional lookup needed');
console.log('  - Can still store full operator metadata when needed');