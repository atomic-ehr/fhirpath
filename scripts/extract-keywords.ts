import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const sectionsDir = './spec2/sections';
const outputDir = './spec2/sections-meta';

// Create output directory if it doesn't exist
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Common stop words to filter out
const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'been', 'be',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'as', 'if', 'when', 'where', 'which', 'what',
  'how', 'why', 'all', 'some', 'any', 'each', 'every', 'either', 'neither',
  'such', 'only', 'just', 'also', 'very', 'too', 'so', 'than', 'then',
  'there', 'here', 'not', 'no', 'yes', 'into', 'onto', 'upon', 'over',
  'under', 'above', 'below', 'between', 'among', 'through', 'during',
  'before', 'after', 'since', 'until', 'while', 'about', 'against',
  'across', 'along', 'around', 'behind', 'beside', 'besides', 'beyond',
  'within', 'without', 'because', 'although', 'though', 'unless',
  'whereas', 'whether', 'however', 'therefore', 'otherwise', 'thus',
  'hence', 'furthermore', 'moreover', 'nevertheless', 'nonetheless',
  'meanwhile', 'instead', 'indeed', 'perhaps', 'maybe', 'probably',
  'certainly', 'definitely', 'really', 'actually', 'basically',
  'essentially', 'generally', 'usually', 'typically', 'often',
  'sometimes', 'rarely', 'never', 'always', 'already', 'still',
  'yet', 'even', 'much', 'many', 'few', 'several', 'various',
  'other', 'another', 'same', 'different', 'similar', 'certain',
  'particular', 'specific', 'general', 'common', 'special',
  'note', 'example', 'see', 'section', 'following', 'used',
  'using', 'use', 'called', 'named', 'known', 'defined'
]);

// FHIRPath and healthcare domain-specific important terms
const domainTerms = new Set([
  'fhirpath', 'fhir', 'expression', 'function', 'operator', 'collection',
  'resource', 'element', 'type', 'value', 'boolean', 'integer', 'decimal',
  'string', 'datetime', 'date', 'time', 'quantity', 'code', 'reference',
  'identifier', 'period', 'range', 'ratio', 'annotation', 'attachment',
  'extension', 'narrative', 'metadata', 'profile', 'binding', 'constraint',
  'cardinality', 'slice', 'discriminator', 'invariant', 'validation',
  'conformance', 'implementation', 'specification', 'standard', 'hl7',
  'patient', 'practitioner', 'organization', 'encounter', 'observation',
  'condition', 'procedure', 'medication', 'immunization', 'allergy',
  'diagnostic', 'laboratory', 'vital', 'clinical', 'medical', 'healthcare',
  'terminology', 'coding', 'system', 'display', 'valueset', 'codesystem',
  'bundle', 'transaction', 'history', 'search', 'parameter', 'modifier',
  'chain', 'include', 'revinclude', 'operation', 'interaction', 'capability',
  'rest', 'messaging', 'document', 'subscription', 'security', 'privacy',
  'audit', 'provenance', 'signature', 'consent', 'policy', 'permission',
  'where', 'select', 'exists', 'all', 'any', 'contains', 'matches',
  'startswith', 'endswith', 'substring', 'replace', 'trim', 'upper',
  'lower', 'indexof', 'length', 'split', 'join', 'first', 'last',
  'tail', 'skip', 'take', 'union', 'distinct', 'intersect', 'exclude',
  'combine', 'flatten', 'empty', 'count', 'aggregate', 'sum', 'min',
  'max', 'avg', 'single', 'oftype', 'is', 'as', 'cast', 'children',
  'descendants', 'trace', 'today', 'now', 'resolve', 'extension',
  'arithmetic', 'comparison', 'logical', 'equality', 'membership',
  'navigation', 'filtering', 'projection', 'subsetting', 'combining',
  'conversion', 'polymorphic', 'invocation', 'precedence', 'associativity',
  'syntax', 'grammar', 'literal', 'identifier', 'path', 'expression',
  'unary', 'binary', 'ternary', 'operand', 'result', 'evaluation',
  'context', 'scope', 'binding', 'resolution', 'propagation', 'null',
  'undefined', 'error', 'exception', 'handling', 'semantics', 'behavior'
]);

function extractKeywords(content: string, title: string): string[] {
  // Remove markdown formatting
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/[#*_~]/g, '') // Remove markdown formatting
    .replace(/\|/g, ' ') // Replace table separators
    .replace(/[^\w\s-]/g, ' ') // Remove special characters except hyphens
    .toLowerCase();

  // Extract all words
  const words = cleanContent.match(/\b[a-z][a-z-]*\b/g) || [];
  
  // Count word frequency
  const wordFreq = new Map<string, number>();
  
  for (const word of words) {
    if (word.length > 2 && !stopWords.has(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  // Boost domain-specific terms
  for (const [word, freq] of wordFreq) {
    if (domainTerms.has(word)) {
      wordFreq.set(word, freq * 3); // Triple the weight for domain terms
    }
  }

  // Extract title words and boost them
  const titleWords = title.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  for (const word of titleWords) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 10); // Heavily boost title words
  }

  // Sort by frequency and get top keywords
  const sortedWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  // Return top 3 unique keywords
  const keywords: string[] = [];
  for (const word of sortedWords) {
    if (!keywords.includes(word)) {
      keywords.push(word);
      if (keywords.length === 3) break;
    }
  }

  // If we don't have 3 keywords, add some fallbacks
  while (keywords.length < 3) {
    const fallbacks = ['fhirpath', 'expression', 'function', 'operator', 'type'];
    for (const fallback of fallbacks) {
      if (!keywords.includes(fallback)) {
        keywords.push(fallback);
        if (keywords.length === 3) break;
      }
    }
  }

  return keywords;
}

// Process all section files
const files = readdirSync(sectionsDir).filter(f => f.endsWith('.md'));
console.log(`Processing ${files.length} section files...`);

let processed = 0;
for (const file of files) {
  const filePath = join(sectionsDir, file);
  const content = readFileSync(filePath, 'utf-8');
  
  // Extract title from first line (header)
  const titleMatch = content.match(/^#+\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? file.replace('.md', '');
  
  // Extract keywords
  const keywords = extractKeywords(content, title);
  
  // Create metadata object
  const metadata = {
    title,
    file,
    keywords
  };
  
  // Write JSON file
  const jsonFileName = file.replace('.md', '.json');
  const jsonPath = join(outputDir, jsonFileName);
  writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
  
  processed++;
  if (processed % 10 === 0) {
    console.log(`Processed ${processed}/${files.length} files...`);
  }
}

console.log(`\nCompleted! Processed ${processed} files.`);
console.log(`Metadata files saved to: ${outputDir}`);