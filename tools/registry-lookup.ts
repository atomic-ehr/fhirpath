#!/usr/bin/env bun

import { Registry } from '../src/registry/registry';
// Import registry to trigger operation registration
import '../src/registry';

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: bun tools/registry-lookup.ts <operation-name|"list">');
  console.error('Examples:');
  console.error('  bun tools/registry-lookup.ts "+"');
  console.error('  bun tools/registry-lookup.ts "where"');
  console.error('  bun tools/registry-lookup.ts "list"');
  console.error('  bun tools/registry-lookup.ts "list functions"');
  console.error('  bun tools/registry-lookup.ts "list operators"');
  process.exit(1);
}

const query = args.join(' ');
const [command, subcommand] = args;

if (command === 'list') {
  let operations;
  
  if (subcommand === 'functions') {
    operations = Registry.getAllFunctions();
  } else if (subcommand === 'operators') {
    operations = Registry.getOperatorsByForm('infix')
      .concat(Registry.getOperatorsByForm('prefix'))
      .concat(Registry.getOperatorsByForm('postfix'));
  } else {
    operations = Registry.getAllOperations();
  }
  
  const names = operations.map(op => ({
    name: op.name,
    kind: op.kind,
    form: op.kind === 'operator' ? op.syntax.form : undefined
  }));
  
  console.log(JSON.stringify(names, null, 2));
} else {
  const operation = Registry.get(query);
  
  if (!operation) {
    console.error(`Operation "${query}" not found in registry`);
    process.exit(1);
  }
  
  console.log(JSON.stringify(operation, null, 2));
}