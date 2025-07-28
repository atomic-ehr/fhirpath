import { DynamicRegistry } from '../src/dynamic-registry';
import { DynamicParser, printAST } from '../src/dynamic-parser';

console.log('=== Dynamic Parser Demo ===\n');

// Create registry and register operators
const registry = new DynamicRegistry();

// Standard FHIRPath operators
const standardOps = [
  { symbol: '+', name: 'plus', precedence: 70, category: 'arithmetic' },
  { symbol: '-', name: 'minus', precedence: 70, category: 'arithmetic' },
  { symbol: '*', name: 'multiply', precedence: 80, category: 'arithmetic' },
  { symbol: '/', name: 'divide', precedence: 80, category: 'arithmetic' },
  { symbol: '=', name: 'equal', precedence: 40, category: 'comparison' },
  { symbol: '!=', name: 'not-equal', precedence: 40, category: 'comparison' },
  { symbol: '<', name: 'less-than', precedence: 50, category: 'comparison' },
  { symbol: '>', name: 'greater-than', precedence: 50, category: 'comparison' },
  { symbol: '<=', name: 'less-equal', precedence: 50, category: 'comparison' },
  { symbol: '>=', name: 'greater-equal', precedence: 50, category: 'comparison' },
  { symbol: 'and', name: 'and', precedence: 30, category: 'logical' },
  { symbol: 'or', name: 'or', precedence: 20, category: 'logical' },
  { symbol: '|', name: 'union', precedence: 25, category: 'collection' },
];

console.log('Registering standard operators:');
standardOps.forEach(op => {
  const token = registry.registerOperator({
    symbol: op.symbol,
    name: op.name,
    category: [op.category],
    precedence: op.precedence,
    associativity: 'left',
    description: `${op.name} operator`,
    examples: [],
    signatures: []
  });
  console.log(`  ${op.symbol.padEnd(4)} -> ${registry.getTokenName(token)} (precedence: ${op.precedence})`);
});

// Custom operators
console.log('\nRegistering custom operators:');
const customOps = [
  { symbol: '**', name: 'power', precedence: 90, associativity: 'right' as const },
  { symbol: '??', name: 'null-coalesce', precedence: 35, associativity: 'left' as const },
  { symbol: '::', name: 'scope', precedence: 95, associativity: 'left' as const },
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
  console.log(`  ${op.symbol.padEnd(4)} -> ${registry.getTokenName(token)} (precedence: ${op.precedence}, ${op.associativity})`);
});

// Parse examples
console.log('\n=== Parsing Examples ===');

const examples = [
  {
    title: 'Arithmetic with precedence',
    expr: '2 + 3 * 4 - 1',
    expected: '(2 + (3 * 4)) - 1'
  },
  {
    title: 'Power operator (right associative)',
    expr: '2 ** 3 ** 2',
    expected: '2 ** (3 ** 2)'
  },
  {
    title: 'Comparison and logical',
    expr: 'age > 18 and status = "active" or priority > 5',
    expected: '((age > 18) and (status = "active")) or (priority > 5)'
  },
  {
    title: 'Member access chain',
    expr: 'Patient.name.given.first()',
    expected: 'Patient.name.given.first()'
  },
  {
    title: 'Null coalescing',
    expr: 'value ?? defaultValue ?? "none"',
    expected: '(value ?? defaultValue) ?? "none"'
  },
  {
    title: 'Mixed operators',
    expr: 'items[0].price * quantity + tax',
    expected: '((items[0].price) * quantity) + tax'
  },
  {
    title: 'Function with operators',
    expr: 'where(age > 18 and active = true)',
    expected: 'where((age > 18) and (active = true))'
  },
  {
    title: 'Collection literal',
    expr: '{1 + 2, 3 * 4, "hello"}',
    expected: '{(1 + 2), (3 * 4), "hello"}'
  }
];

examples.forEach(({ title, expr }) => {
  console.log(`\n${title}:`);
  console.log(`  Expression: ${expr}`);
  
  try {
    const parser = new DynamicParser(expr, registry);
    const ast = parser.parse();
    console.log('  AST:');
    console.log(printAST(ast, 4));
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
});

// Show benefits
console.log('\n=== Benefits of Dynamic Parser ===');
console.log('1. Operators defined in registry, not hardcoded in parser');
console.log('2. Easy to add new operators with custom precedence/associativity');
console.log('3. Parser automatically handles any registered operators');
console.log('4. Single source of truth for operator behavior');
console.log('5. Can load operators from configuration files');

// Example: Loading operators from config
console.log('\n=== Loading Operators from Configuration ===');
const operatorConfig = {
  operators: [
    { symbol: '~=', name: 'matches', precedence: 45, category: 'string' },
    { symbol: 'in', name: 'in', precedence: 35, category: 'membership' },
    { symbol: 'contains', name: 'contains', precedence: 35, category: 'membership' },
  ]
};

console.log('Loading operators from config:');
operatorConfig.operators.forEach(op => {
  const token = registry.registerOperator({
    symbol: op.symbol,
    name: op.name,
    category: [op.category],
    precedence: op.precedence,
    associativity: 'left',
    description: `${op.name} operator`,
    examples: [],
    signatures: []
  });
  console.log(`  ${op.symbol.padEnd(10)} -> ${registry.getTokenName(token)}`);
});

// Parse with new operators
console.log('\nParsing with dynamically loaded operators:');
const testExpr = 'name ~= "John*" and id in allowedIds';
const parser = new DynamicParser(testExpr, registry);
const ast = parser.parse();
console.log(`Expression: ${testExpr}`);
console.log('AST:');
console.log(printAST(ast, 2));