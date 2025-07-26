import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const sectionsDir = './spec2/sections';
const outputDir = './spec2/sections-meta';

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create output directory if it doesn't exist
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function extractKeywordsWithClaude(content: string, title: string): Promise<string[]> {
  try {
    const prompt = `You are analyzing a section from the FHIRPath specification documentation. Extract exactly 3 keywords that best represent the main concepts in this section.

Title: ${title}

Content:
${content.substring(0, 2000)} ${content.length > 2000 ? '...(truncated)' : ''}

Instructions:
- Return ONLY 3 keywords, one per line
- Keywords should be lowercase
- Focus on technical terms, FHIRPath concepts, operations, or data types
- Prioritize specific technical terms over generic ones
- If the section is about a specific function or operator, include it as a keyword
- Do not include articles, prepositions, or generic words
- Do not include explanatory text, just the keywords

Output exactly 3 keywords:`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const firstContent = message.content[0];
    const response = firstContent && 'text' in firstContent ? firstContent.text : '';
    const keywords = response
      .split('\n')
      .map(line => line.trim().toLowerCase())
      .filter(line => line.length > 0 && !line.includes(':') && !line.includes(' '))
      .slice(0, 3);

    // Ensure we have exactly 3 keywords
    while (keywords.length < 3) {
      keywords.push('fhirpath');
    }

    return keywords;
  } catch (error) {
    console.error(`Error extracting keywords for ${title}:`, error);
    // Fallback keywords
    return ['fhirpath', 'expression', 'function'];
  }
}

async function processFiles() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
    console.error('Please set it with: export ANTHROPIC_API_KEY=your-api-key');
    process.exit(1);
  }

  // Process all section files
  const files = readdirSync(sectionsDir).filter(f => f.endsWith('.md'));
  console.log(`Processing ${files.length} section files with Claude...`);
  console.log('Note: This will make API calls and may take some time.\n');

  let processed = 0;
  const batchSize = 5; // Process 5 files at a time to avoid rate limits

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const promises = batch.map(async (file) => {
      const filePath = join(sectionsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Extract title from first line (header)
      const titleMatch = content.match(/^#+\s+(.+)$/m);
      const title = titleMatch?.[1]?.trim() ?? file.replace('.md', '');
      
      // Extract keywords using Claude
      const keywords = await extractKeywordsWithClaude(content, title);
      
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
      
      return file;
    });

    // Wait for batch to complete
    const completedFiles = await Promise.all(promises);
    processed += completedFiles.length;
    
    console.log(`Processed ${processed}/${files.length} files...`);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\nCompleted! Processed ${processed} files.`);
  console.log(`Metadata files saved to: ${outputDir}`);
}

// Run the script
processFiles().catch(console.error);