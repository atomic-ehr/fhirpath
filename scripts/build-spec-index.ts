#!/usr/bin/env bun

import { readdirSync } from 'fs';
import { join } from 'path';

const metaDir = './spec/sections-meta';
const indexFile = './spec/sections-meta/.index.json';

interface SectionMetadata {
  title: string;
  file: string;
  keywords: string[];
}

async function buildIndex() {
  console.log('Building specification index...');
  
  const files = readdirSync(metaDir).filter(f => f.endsWith('.json') && f !== '.index.json');
  console.log(`Found ${files.length} metadata files`);
  
  const index: SectionMetadata[] = [];
  
  // Load all metadata files in parallel
  const promises = files.map(async file => {
    const bunFile = Bun.file(join(metaDir, file));
    const content = await bunFile.text();
    return JSON.parse(content) as SectionMetadata;
  });
  
  const metadata = await Promise.all(promises);
  index.push(...metadata);
  
  // Write the index file
  await Bun.write(indexFile, JSON.stringify(index, null, 2));
  
  console.log(`Index created with ${index.length} entries`);
  console.log(`Saved to: ${indexFile}`);
  
  // Show file size comparison
  const indexSize = (await Bun.file(indexFile).size) / 1024;
  const totalSize = files.reduce((sum, file) => {
    const fileSize = Bun.file(join(metaDir, file)).size;
    return sum + fileSize;
  }, 0) / 1024;
  
  console.log(`\nSize comparison:`);
  console.log(`  Individual files: ${totalSize.toFixed(2)} KB`);
  console.log(`  Index file: ${indexSize.toFixed(2)} KB`);
  console.log(`  Reduction: ${((1 - indexSize/totalSize) * 100).toFixed(1)}%`);
}

buildIndex().catch(console.error);