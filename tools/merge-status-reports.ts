#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface FunctionItem {
  name: string;
  category: string;
  type: 'function' | 'operator';
  implemented: boolean;
  implementationFile: string | null;
  testFiles: string[];
  testCoverage: 'full' | 'partial' | 'none';
  notes: string;
}

interface BatchReport {
  batchId: number;
  items: FunctionItem[];
}

interface CategoryStats {
  total: number;
  implemented: number;
  fullyTested: number;
  partiallyTested: number;
  untested: number;
}

function loadReports(files: string[]): BatchReport[] {
  const reports: BatchReport[] = [];
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const report = JSON.parse(content) as BatchReport;
      
      // Load original batch data to get categories
      const batchFile = `/tmp/fhirpath-batches/batch-${report.batchId}.json`;
      try {
        const batchContent = readFileSync(batchFile, 'utf-8');
        const batchData = JSON.parse(batchContent);
        
        // Map categories from original batch data
        const categoryMap = new Map<string, string>();
        for (const item of batchData.items) {
          categoryMap.set(item.name, item.category);
        }
        
        // Add category to report items
        for (const item of report.items) {
          item.category = categoryMap.get(item.name) || 'Uncategorized';
        }
      } catch (e) {
        console.warn(`Could not load batch file ${batchFile}, using Uncategorized`);
      }
      
      reports.push(report);
      console.log(`Loaded batch ${report.batchId} with ${report.items.length} items`);
    } catch (e) {
      console.error(`Failed to load ${file}:`, e);
    }
  }
  
  return reports;
}

function mergeAndDeduplicate(reports: BatchReport[]): FunctionItem[] {
  const itemMap = new Map<string, FunctionItem>();
  
  for (const report of reports) {
    for (const item of report.items) {
      const key = `${item.type}:${item.name}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, item);
      }
    }
  }
  
  return Array.from(itemMap.values());
}

function groupByCategory(items: FunctionItem[]): Map<string, FunctionItem[]> {
  const groups = new Map<string, FunctionItem[]>();
  
  for (const item of items) {
    const category = item.category || 'Uncategorized';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(item);
  }
  
  // Sort items within each category
  for (const [category, categoryItems] of groups) {
    categoryItems.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return groups;
}

function calculateStats(items: FunctionItem[]): CategoryStats {
  return {
    total: items.length,
    implemented: items.filter(i => i.implemented).length,
    fullyTested: items.filter(i => i.testCoverage === 'full').length,
    partiallyTested: items.filter(i => i.testCoverage === 'partial').length,
    untested: items.filter(i => i.implemented && i.testCoverage === 'none').length
  };
}

function generateMarkdown(items: FunctionItem[]): string {
  const functions = items.filter(i => i.type === 'function');
  const operators = items.filter(i => i.type === 'operator');
  
  const functionGroups = groupByCategory(functions);
  const operatorGroups = groupByCategory(operators);
  
  const totalFuncStats = calculateStats(functions);
  const totalOpStats = calculateStats(operators);
  
  let markdown = `# FHIRPath Implementation Status

Generated: ${new Date().toISOString()}

## Summary

### Functions
- **Total Functions**: ${totalFuncStats.total}
- **Implemented**: ${totalFuncStats.implemented} (${Math.round(totalFuncStats.implemented / totalFuncStats.total * 100)}%)
- **Fully Tested**: ${totalFuncStats.fullyTested} (${Math.round(totalFuncStats.fullyTested / totalFuncStats.implemented * 100)}% of implemented)
- **Partially Tested**: ${totalFuncStats.partiallyTested}
- **Untested**: ${totalFuncStats.untested}

### Operators
- **Total Operators**: ${totalOpStats.total}
- **Implemented**: ${totalOpStats.implemented} (${Math.round(totalOpStats.implemented / totalOpStats.total * 100)}%)
- **Fully Tested**: ${totalOpStats.fullyTested} (${Math.round(totalOpStats.fullyTested / totalOpStats.implemented * 100)}% of implemented)
- **Partially Tested**: ${totalOpStats.partiallyTested}
- **Untested**: ${totalOpStats.untested}

## Functions Implementation Status

`;

  // Generate function sections
  const categoryOrder = [
    'Existence Functions',
    'Filtering and Projection Functions',
    'Subsetting Functions',
    'Combining Functions',
    'Conversion Functions',
    'String Manipulation Functions',
    'Additional String Functions (§1.5.7) - STU',
    'Math Functions (§1.5.8) - STU',
    'Tree Navigation Functions',
    'Utility Functions',
    'Aggregate Functions (§1.7) - STU'
  ];
  
  for (const category of categoryOrder) {
    const categoryItems = functionGroups.get(category);
    if (!categoryItems || categoryItems.length === 0) continue;
    
    const stats = calculateStats(categoryItems);
    
    markdown += `### ${category} (${stats.implemented}/${stats.total} implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
`;
    
    for (const item of categoryItems) {
      const status = item.implemented ? '✅' : '❌';
      const impl = item.implementationFile || '-';
      const testCount = item.testFiles.length;
      const tests = testCount > 0 ? `${testCount} file${testCount > 1 ? 's' : ''}` : '-';
      const coverage = item.testCoverage === 'none' ? '-' : 
                      item.testCoverage === 'full' ? 'Full' : 'Partial';
      
      markdown += `| ${item.name} | ${status} | ${impl} | ${tests} | ${coverage} | ${item.notes || '-'} |\n`;
    }
    
    markdown += '\n';
  }
  
  // Generate operators section
  markdown += `## Operators Implementation Status

| Operator | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
`;
  
  const allOperators = operatorGroups.get('Operators') || [];
  for (const item of allOperators) {
    const status = item.implemented ? '✅' : '❌';
    const impl = item.implementationFile || '-';
    const testCount = item.testFiles.length;
    const tests = testCount > 0 ? `${testCount} file${testCount > 1 ? 's' : ''}` : '-';
    const coverage = item.testCoverage === 'none' ? '-' : 
                    item.testCoverage === 'full' ? 'Full' : 'Partial';
    
    markdown += `| \`${item.name}\` | ${status} | ${impl} | ${tests} | ${coverage} | ${item.notes || '-'} |\n`;
  }
  
  markdown += `
## Priority Lists

### High Priority - Not Implemented Functions
`;
  
  const notImplemented = functions.filter(i => !i.implemented);
  const highPriorityCategories = ['Conversion Functions', 'Tree Navigation Functions'];
  
  for (const category of highPriorityCategories) {
    const items = notImplemented.filter(i => i.category === category);
    if (items.length > 0) {
      markdown += `\n#### ${category}\n`;
      for (const item of items) {
        markdown += `- ${item.name}\n`;
      }
    }
  }
  
  markdown += `
### Implemented but Untested
`;
  
  const untestedFunctions = functions.filter(i => i.implemented && i.testCoverage === 'none');
  const untestedOperators = operators.filter(i => i.implemented && i.testCoverage === 'none');
  
  if (untestedFunctions.length > 0) {
    markdown += '\n#### Functions\n';
    for (const item of untestedFunctions) {
      markdown += `- ${item.name} (${item.implementationFile})\n`;
    }
  }
  
  if (untestedOperators.length > 0) {
    markdown += '\n#### Operators\n';
    for (const item of untestedOperators) {
      markdown += `- ${item.name} (${item.implementationFile})\n`;
    }
  }
  
  markdown += `
## Test File Index

### Functions by Test File
`;
  
  // Create reverse index of test files to functions
  const testFileIndex = new Map<string, string[]>();
  
  for (const item of items) {
    for (const testFile of item.testFiles) {
      if (!testFileIndex.has(testFile)) {
        testFileIndex.set(testFile, []);
      }
      testFileIndex.get(testFile)!.push(item.name);
    }
  }
  
  const sortedTestFiles = Array.from(testFileIndex.keys()).sort();
  
  for (const testFile of sortedTestFiles) {
    const itemNames = testFileIndex.get(testFile)!;
    markdown += `\n**${testFile}**\n`;
    markdown += `  Tests: ${itemNames.join(', ')}\n`;
  }
  
  return markdown;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: bun tools/merge-status-reports.ts <report1.json> <report2.json> ...');
    console.error('  or: bun tools/merge-status-reports.ts /tmp/status-report-batch-*.json');
    process.exit(1);
  }
  
  // Load all reports
  const reports = loadReports(args);
  
  if (reports.length === 0) {
    console.error('No valid reports loaded');
    process.exit(1);
  }
  
  // Merge and deduplicate
  const allItems = mergeAndDeduplicate(reports);
  console.log(`\nTotal unique items: ${allItems.length}`);
  
  // Generate markdown
  const markdown = generateMarkdown(allItems);
  
  // Write output
  const outputPath = join(__dirname, '../docs/implementation-status.md');
  writeFileSync(outputPath, markdown);
  console.log(`\nGenerated ${outputPath}`);
  
  // Print summary
  const functions = allItems.filter(i => i.type === 'function');
  const operators = allItems.filter(i => i.type === 'operator');
  
  console.log('\nSummary:');
  console.log(`  Functions: ${functions.filter(f => f.implemented).length}/${functions.length} implemented`);
  console.log(`  Operators: ${operators.filter(o => o.implemented).length}/${operators.length} implemented`);
}

// Run if called directly
if (import.meta.main) {
  main();
}