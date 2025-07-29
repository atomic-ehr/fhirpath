#!/usr/bin/env bun

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface HeaderInfo {
  level: number;
  text: string;
  lineNumber: number;
  levelNumbers: number[];
}

function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseHeaders(content: string): HeaderInfo[] {
  const lines = content.split('\n');
  const headers: HeaderInfo[] = [];
  const levelCounters: { [key: number]: number } = {};
  const currentLevels: number[] = [0, 0, 0, 0, 0, 0]; // Support up to 6 levels

  lines.forEach((line, index) => {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1]?.length ?? 1;
      const text = headerMatch[2]?.trim() ?? '';
      
      // Update level counters
      if (level > 0 && level <= currentLevels.length) {
        const currentCount = currentLevels[level - 1] ?? 0;
        currentLevels[level - 1] = currentCount + 1;
      }
      // Reset all deeper levels
      for (let i = level; i < currentLevels.length; i++) {
        currentLevels[i] = 0;
      }
      
      // Get the level numbers for this header
      const levelNumbers = currentLevels.slice(0, level).filter(n => n > 0);
      
      headers.push({
        level,
        text,
        lineNumber: index,
        levelNumbers
      });
    }
  });

  return headers;
}

function generateFilename(header: HeaderInfo): string {
  const levelString = header.levelNumbers.join('.');
  const kebabText = kebabCase(header.text);
  return `§${levelString}-${kebabText}.md`;
}

function splitMarkdown(inputPath: string, outputDir: string) {
  // Read the input file
  const content = readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n');
  
  // Parse headers
  const headers = parseHeaders(content);
  
  if (headers.length === 0) {
    console.error('No headers found in the input file');
    return;
  }
  
  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Split content by headers
  headers.forEach((header, index) => {
    const startLine = header.lineNumber;
    const endLine = index < headers.length - 1 ? headers[index + 1]?.lineNumber ?? lines.length : lines.length;
    
    // Extract content for this section
    const sectionContent = lines.slice(startLine, endLine).join('\n').trim();
    
    if (sectionContent) {
      const filename = generateFilename(header);
      const outputPath = join(outputDir, filename);
      
      writeFileSync(outputPath, sectionContent);
      console.log(`Created: ${filename}`);
    }
  });
  
  console.log(`\nSplit ${headers.length} sections from ${inputPath}`);
}

// Main execution
const inputFile = join(__dirname, '..', 'spec', 'fhirpath-2025.md');
const outputDirectory = join(__dirname, '..', 'spec', 'sections');

if (!existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

console.log(`Splitting: ${inputFile}`);
console.log(`Output directory: ${outputDirectory}\n`);

splitMarkdown(inputFile, outputDirectory);