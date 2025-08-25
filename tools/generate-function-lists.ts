#!/usr/bin/env bun

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { registry } from '../src/registry';

interface FunctionItem {
  name: string;
  category: string;
  specSection?: string;
  signature?: string;
  type: 'function' | 'operator';
}

interface Batch {
  batchId: number;
  description: string;
  items: FunctionItem[];
}

// Parse functions from spec/functions.md
function parseFunctionsFromSpec(): FunctionItem[] {
  const specContent = readFileSync(join(__dirname, '../spec/functions.md'), 'utf-8');
  const functions: FunctionItem[] = [];
  let currentCategory = '';
  let currentSection = '';
  
  const lines = specContent.split('\n');
  for (const line of lines) {
    // Category headers like "### 1. Existence Functions (§1.5.1)"
    if (line.startsWith('### ') && line.includes('(§')) {
      const categoryMatch = line.match(/### \d+\.\s+(.+?)\s+\(§([\d.]+)\)/);
      if (categoryMatch) {
        currentCategory = categoryMatch[1];
        currentSection = categoryMatch[2];
      }
    }
    
    // Function rows in tables
    if (line.startsWith('|') && !line.includes('Function') && !line.includes('---')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 4) {
        const name = parts[0];
        const signature = parts[1];
        
        // Skip header rows and status indicators
        if (name && !name.includes('✅') && !name.includes('❌') && !name.includes('⚠️')) {
          functions.push({
            name,
            category: currentCategory,
            specSection: `§${currentSection}`,
            signature,
            type: 'function'
          });
        }
      }
    }
  }
  
  return functions;
}

// Get all operators from registry
function getOperatorsFromRegistry(): FunctionItem[] {
  const operators: FunctionItem[] = [];
  
  // Get all registered operators
  const operatorNames = registry.listOperators();
  
  for (const name of operatorNames) {
    const metadata = registry.getOperatorDefinition(name);
    if (metadata) {
      operators.push({
        name: metadata.symbol || name,
        category: 'Operators',
        type: 'operator'
      });
    }
  }
  
  // Add operators that might not be in registry but are in parser
  const additionalOperators = [
    '.', '[]', '()', '{}', '|', ',', ';'
  ];
  
  for (const op of additionalOperators) {
    if (!operators.find(o => o.name === op)) {
      operators.push({
        name: op,
        category: 'Operators',
        type: 'operator'
      });
    }
  }
  
  return operators;
}

// Create batches for parallel processing
function createBatches(): Batch[] {
  const functions = parseFunctionsFromSpec();
  const operators = getOperatorsFromRegistry();
  
  console.log(`Found ${functions.length} functions and ${operators.length} operators`);
  
  const batches: Batch[] = [];
  
  // Group functions by category
  const categories = new Map<string, FunctionItem[]>();
  for (const func of functions) {
    if (!categories.has(func.category)) {
      categories.set(func.category, []);
    }
    categories.get(func.category)!.push(func);
  }
  
  // Create batches based on categories
  let batchId = 1;
  
  // Batch 1: Existence Functions
  const existence = categories.get('Existence Functions') || [];
  batches.push({
    batchId: batchId++,
    description: 'Existence Functions',
    items: existence
  });
  
  // Batch 2: Filtering, Projection, and Subsetting
  const filtering = categories.get('Filtering and Projection Functions') || [];
  const subsetting = categories.get('Subsetting Functions') || [];
  batches.push({
    batchId: batchId++,
    description: 'Filtering and Subsetting Functions',
    items: [...filtering, ...subsetting]
  });
  
  // Batch 3: Conversion Functions
  const conversion = categories.get('Conversion Functions') || [];
  const combining = categories.get('Combining Functions') || [];
  batches.push({
    batchId: batchId++,
    description: 'Conversion and Combining Functions',
    items: [...conversion, ...combining]
  });
  
  // Batch 4: String Functions
  const stringFuncs = categories.get('String Manipulation Functions') || [];
  const additionalString = categories.get('Additional String Functions (§1.5.7) - STU') || [];
  batches.push({
    batchId: batchId++,
    description: 'String Functions',
    items: [...stringFuncs, ...additionalString]
  });
  
  // Batch 5: Math, Tree, and Utility Functions
  const math = categories.get('Math Functions (§1.5.8) - STU') || [];
  const tree = categories.get('Tree Navigation Functions') || [];
  const utility = categories.get('Utility Functions') || [];
  const aggregate = categories.get('Aggregate Functions (§1.7) - STU') || [];
  batches.push({
    batchId: batchId++,
    description: 'Math, Tree, and Utility Functions',
    items: [...math, ...tree, ...utility, ...aggregate]
  });
  
  // Batch 6: All Operators
  batches.push({
    batchId: batchId++,
    description: 'Operators',
    items: operators
  });
  
  return batches;
}

// Main execution
function main() {
  const batches = createBatches();
  
  // Create output directory
  const outputDir = '/tmp/fhirpath-batches';
  mkdirSync(outputDir, { recursive: true });
  
  // Write each batch to a separate file
  for (const batch of batches) {
    const filename = join(outputDir, `batch-${batch.batchId}.json`);
    writeFileSync(filename, JSON.stringify(batch, null, 2));
    console.log(`Created ${filename} with ${batch.items.length} items`);
  }
  
  // Write summary file
  const summary = {
    totalBatches: batches.length,
    totalItems: batches.reduce((sum, b) => sum + b.items.length, 0),
    batches: batches.map(b => ({
      id: b.batchId,
      description: b.description,
      itemCount: b.items.length,
      file: `batch-${b.batchId}.json`
    }))
  };
  
  const summaryFile = join(outputDir, 'summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`\nCreated summary at ${summaryFile}`);
  console.log('\nBatch Summary:');
  summary.batches.forEach(b => {
    console.log(`  Batch ${b.id}: ${b.description} (${b.itemCount} items)`);
  });
}

main();