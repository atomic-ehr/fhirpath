#!/usr/bin/env bun

import { readdirSync } from 'fs';
import { join } from 'path';

interface SectionMetadata {
  title: string;
  file: string;
  keywords: string[];
}

interface SearchResult {
  metadata: SectionMetadata;
  score: number;
  content?: string;
}

const metaDir = './spec2/sections-meta';
const sectionsDir = './spec2/sections';
const indexFile = './spec2/sections-meta/.index.json';

async function loadAllMetadata(): Promise<SectionMetadata[]> {
  // Try to load from index first
  const indexPath = Bun.file(indexFile);
  if (await indexPath.exists()) {
    const content = await indexPath.text();
    return JSON.parse(content) as SectionMetadata[];
  }
  
  // Fallback to loading individual files
  const files = readdirSync(metaDir).filter(f => f.endsWith('.json') && f !== '.index.json');
  const promises = files.map(async file => {
    const bunFile = Bun.file(join(metaDir, file));
    const content = await bunFile.text();
    return JSON.parse(content) as SectionMetadata;
  });
  return Promise.all(promises);
}

function searchSections(query: string, metadata: SectionMetadata[]): SearchResult[] {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  
  const results: SearchResult[] = metadata.map(section => {
    let score = 0;
    const titleLower = section.title.toLowerCase();
    
    // Score based on matches
    for (const term of searchTerms) {
      // Exact title match (highest score)
      if (titleLower === term) {
        score += 100;
      }
      // Title contains term
      else if (titleLower.includes(term)) {
        score += 50;
      }
      
      // Keyword exact match
      if (section.keywords.includes(term)) {
        score += 30;
      }
      
      // Keyword partial match
      for (const keyword of section.keywords) {
        if (keyword.includes(term) && keyword !== term) {
          score += 10;
        }
      }
    }
    
    return { metadata: section, score };
  }).filter(result => result.score > 0);
  
  // Sort by score (descending)
  return results.sort((a, b) => b.score - a.score);
}

async function loadSectionContent(filename: string): Promise<string> {
  try {
    const bunFile = Bun.file(join(sectionsDir, filename));
    return await bunFile.text();
  } catch (error) {
    return `Error loading content: ${error}`;
  }
}

function formatResult(result: SearchResult, index: number, showContent: boolean = false): string {
  const { metadata } = result;
  let output = `\n${index + 1}. ${metadata.title}\n`;
  output += `   File: ${metadata.file}\n`;
  output += `   Keywords: ${metadata.keywords.join(', ')}\n`;
  output += `   Score: ${result.score}\n`;
  
  if (showContent && result.content) {
    output += '\n   Content:\n';
    output += '   ' + '-'.repeat(60) + '\n';
    const lines = result.content.split('\n');
    for (const line of lines.slice(0, 50)) {
      output += `   ${line}\n`;
    }
    if (lines.length > 50) {
      output += `   ... (${lines.length - 50} more lines)\n`;
    }
    output += '   ' + '-'.repeat(60) + '\n';
  }
  
  return output;
}

// Main CLI
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
FHIRPath Specification Search Tool

Usage: bun tools/spec.ts <search-query> [options]

Options:
  --content, -c     Show full content of matching sections
  --limit, -l <n>   Limit results to top N matches (default: 10)
  --all, -a         Show all matching results (no limit)

Examples:
  bun tools/spec.ts "where"                    # Search for sections about 'where'
  bun tools/spec.ts "where function" -c        # Search and show content
  bun tools/spec.ts "arithmetic operator" -l 5 # Show top 5 matches
  bun tools/spec.ts "+" -c                     # Search for plus operator with content
  bun tools/spec.ts "equals comparison"        # Search for equals comparison
`);
  process.exit(0);
}

// Parse arguments
let query = '';
let showContent = false;
let limit = 10;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--content' || arg === '-c') {
    showContent = true;
  } else if ((arg === '--limit' || arg === '-l') && i + 1 < args.length) {
    limit = parseInt(args[++i]) || 10;
  } else if (arg === '--all' || arg === '-a') {
    limit = Infinity;
  } else if (!arg.startsWith('-')) {
    query += (query ? ' ' : '') + arg;
  }
}

if (!query) {
  console.error('Error: No search query provided');
  process.exit(1);
}

console.log(`Searching for: "${query}"\n`);

// Load metadata and search
const metadata = await loadAllMetadata();
console.log(`Loaded ${metadata.length} section metadata files\n`);

const results = searchSections(query, metadata);

if (results.length === 0) {
  console.log('No matching sections found.');
  process.exit(0);
}

console.log(`Found ${results.length} matching sections:`);

// Load content if requested
if (showContent) {
  const contentPromises = results.map(async result => {
    result.content = await loadSectionContent(result.metadata.file);
  });
  await Promise.all(contentPromises);
}

// Display results
const displayCount = Math.min(results.length, limit);
for (let i = 0; i < displayCount; i++) {
  console.log(formatResult(results[i], i, showContent));
}

if (results.length > displayCount) {
  console.log(`\n... and ${results.length - displayCount} more results.`);
  console.log('Use --all to see all results or --limit <n> to change the limit.');
}

// If showing content and only one result, provide a tip
if (showContent && displayCount === 1) {
  console.log('\nTip: You can open the file directly:');
  console.log(`  bun tools/read.ts spec2/sections/${results[0].metadata.file}`);
}