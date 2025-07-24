#!/usr/bin/env bun

import { registry } from '../src';

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

const [command, subcommand] = args;
const query = command!;

if (command === 'list') {
  let names;
  
  if (subcommand === 'functions') {
    names = registry.listFunctions();
  } else if (subcommand === 'operators') {
    names = registry.listOperators();
  } else {
    names = registry.listAllOperations();
  }
  
  console.log(JSON.stringify(names, null, 2));
} else {
  const operation = registry.getOperationInfo(query);
  
  if (!operation) {
    console.error(`Operation "${query}" not found in registry`);
    process.exit(1);
  }
  
  console.log(JSON.stringify(operation, null, 2));
}