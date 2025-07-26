#!/usr/bin/env bun

import { parseArgs } from 'util';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

interface ModelResponse {
  model: string;
  response: string;
  timestamp: number;
  error?: string;
}

interface ResearchConfig {
  prompt: string;
  models?: string[];
  summarize?: boolean;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    xai?: string;
  };
}

const DEFAULT_MODELS = ['grok-heavy', 'o3', 'claude-3-opus'];

async function queryGrok(prompt: string, apiKey?: string): Promise<ModelResponse> {
  if (!apiKey) {
    return {
      model: 'grok-heavy',
      response: '',
      timestamp: Date.now(),
      error: 'X.AI API key not provided. Set XAI_API_KEY environment variable.'
    };
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-4-0709',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      model: 'grok-heavy',
      response: data.choices[0].message.content,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      model: 'grok-heavy',
      response: '',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function queryOpenAI(prompt: string, apiKey?: string): Promise<ModelResponse> {
  if (!apiKey) {
    return {
      model: 'o3',
      response: '',
      timestamp: Date.now(),
      error: 'OpenAI API key not provided. Set OPENAI_API_KEY environment variable.'
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      model: 'o3',
      response: data.choices[0].message.content,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      model: 'o3',
      response: '',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function queryClaude(prompt: string, apiKey?: string): Promise<ModelResponse> {
  if (!apiKey) {
    return {
      model: 'claude-3-opus',
      response: '',
      timestamp: Date.now(),
      error: 'Anthropic API key not provided. Set ANTHROPIC_API_KEY environment variable.'
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      model: 'claude-3-opus',
      response: data.content[0].text,
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      model: 'claude-3-opus',
      response: '',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function queryModels(config: ResearchConfig): Promise<ModelResponse[]> {
  const models = config.models || DEFAULT_MODELS;
  const apiKeys = {
    openai: config.apiKeys?.openai || process.env.OPENAI_API_KEY,
    anthropic: config.apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY,
    xai: config.apiKeys?.xai || process.env.XAI_API_KEY
  };

  const queries = models.map(async (model) => {
    switch (model.toLowerCase()) {
      case 'grok':
      case 'grok-heavy':
        return queryGrok(config.prompt, apiKeys.xai);
      case 'gpt-4':
      case 'o3':
      case 'openai':
        return queryOpenAI(config.prompt, apiKeys.openai);
      case 'claude-3-opus':
      case 'claude':
        return queryClaude(config.prompt, apiKeys.anthropic);
      default:
        return {
          model,
          response: '',
          timestamp: Date.now(),
          error: `Unknown model: ${model}`
        };
    }
  });

  return Promise.all(queries);
}

function summarizeResponses(responses: ModelResponse[]): string {
  const validResponses = responses.filter(r => !r.error && r.response);
  
  if (validResponses.length === 0) {
    return 'No valid responses received from any model.';
  }

  const summary = [`# Research Summary\n`];
  summary.push(`Query sent to ${responses.length} models, ${validResponses.length} responded successfully.\n`);
  
  summary.push(`## Key Points Across Models:\n`);
  
  const commonThemes = extractCommonThemes(validResponses);
  commonThemes.forEach((theme, index) => {
    summary.push(`${index + 1}. ${theme}`);
  });
  
  summary.push(`\n## Unique Perspectives:\n`);
  
  validResponses.forEach(response => {
    const uniquePoints = extractUniquePoints(response, validResponses);
    if (uniquePoints.length > 0) {
      summary.push(`\n### ${response.model}:`);
      uniquePoints.forEach(point => {
        summary.push(`- ${point}`);
      });
    }
  });
  
  return summary.join('\n');
}

function extractCommonThemes(responses: ModelResponse[]): string[] {
  const allText = responses.map(r => r.response.toLowerCase()).join(' ');
  const words = allText.split(/\s+/);
  const wordFreq = new Map<string, number>();
  
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'some', 'any', 'few', 'more', 'most', 'other', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'as']);
  
  words.forEach(word => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });
  
  const commonWords = Array.from(wordFreq.entries())
    .filter(([_, count]) => count >= responses.length)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  
  return commonWords.map(word => {
    const contexts = responses.map(r => {
      const sentences = r.response.split(/[.!?]+/);
      return sentences.find(s => s.toLowerCase().includes(word));
    }).filter(Boolean);
    
    if (contexts.length > 0) {
      return `Common theme around "${word}" - mentioned by all models`;
    }
    return '';
  }).filter(Boolean);
}

function extractUniquePoints(response: ModelResponse, allResponses: ModelResponse[]): string[] {
  const otherResponses = allResponses.filter(r => r.model !== response.model);
  const sentences = response.response.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  
  const uniqueSentences = sentences.filter(sentence => {
    const keywords = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    return keywords.some(keyword => {
      return !otherResponses.some(other => 
        other.response.toLowerCase().includes(keyword)
      );
    });
  });
  
  return uniqueSentences.slice(0, 3);
}

function formatResponses(responses: ModelResponse[], summarize: boolean): string {
  const output: string[] = [];
  
  if (summarize) {
    output.push(summarizeResponses(responses));
    output.push('\n---\n');
  }
  
  output.push('# Individual Model Responses\n');
  
  responses.forEach(response => {
    output.push(`## ${response.model}`);
    output.push(`Time: ${new Date(response.timestamp).toISOString()}`);
    
    if (response.error) {
      output.push(`Error: ${response.error}`);
    } else {
      output.push(`\n${response.response}`);
    }
    
    output.push('\n---\n');
  });
  
  return output.join('\n');
}

function generateRequestDirName(prompt: string): string {
  // Create a directory name from the prompt
  // Remove special characters and limit length
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  // Add timestamp to ensure uniqueness
  const timestamp = new Date().toISOString().split('T')[0];
  return `${timestamp}-${cleaned}`;
}

async function saveResponses(prompt: string, responses: ModelResponse[]): Promise<string> {
  const dirName = generateRequestDirName(prompt);
  const basePath = join(process.cwd(), 'llm', dirName);
  
  // Create directory structure
  await mkdir(basePath, { recursive: true });
  
  // Save prompt
  await Bun.write(join(basePath, 'prompt.md'), `# Prompt\n\n${prompt}\n\nGenerated: ${new Date().toISOString()}\n`);
  
  // Save individual responses
  for (const response of responses) {
    let filename: string;
    let content: string;
    
    // Map model names to filenames
    switch (response.model.toLowerCase()) {
      case 'grok-heavy':
        filename = 'grok.md';
        break;
      case 'o3':
        filename = 'openai.md';
        break;
      case 'claude-3-opus':
        filename = 'anthropic.md';
        break;
      default:
        filename = `${response.model.replace(/[^a-z0-9]/gi, '-')}.md`;
    }
    
    if (response.error) {
      content = `# ${response.model} Response\n\n## Error\n\n${response.error}\n\nTimestamp: ${new Date(response.timestamp).toISOString()}\n`;
    } else {
      content = `# ${response.model} Response\n\n${response.response}\n\nTimestamp: ${new Date(response.timestamp).toISOString()}\n`;
    }
    
    await Bun.write(join(basePath, filename), content);
  }
  
  return basePath;
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      models: {
        type: 'string',
        short: 'm',
        multiple: true,
        default: DEFAULT_MODELS
      },
      summarize: {
        type: 'boolean',
        short: 's',
        default: true
      },
      'no-summarize': {
        type: 'boolean',
        default: false
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false
      }
    },
    allowPositionals: true
  });

  if (values.help || positionals.length === 0) {
    console.log(`
Research Tool - Query multiple AI models and collect responses

Usage: bun tools/research.ts "<prompt>" [options]

Options:
  -m, --models <model>     Models to query (default: grok-heavy, o3, claude-3-opus)
                          Can be specified multiple times
  -s, --summarize         Generate a summary of responses (default: true)
  --no-summarize          Disable summary generation
  -h, --help              Show this help message

Environment Variables:
  XAI_API_KEY             API key for X.AI (Grok)
  OPENAI_API_KEY          API key for OpenAI
  ANTHROPIC_API_KEY       API key for Anthropic (Claude)

Examples:
  bun tools/research.ts "What are the key differences between interpreted and compiled languages?"
  bun tools/research.ts "Explain quantum computing" -m gpt-4 -m claude
  bun tools/research.ts "Compare React and Vue frameworks" --no-summarize
    `);
    process.exit(0);
  }

  const prompt = positionals[0] as string;
  const config: ResearchConfig = {
    prompt,
    models: values.models as string[],
    summarize: !values['no-summarize'] && values.summarize !== false
  };

  console.log('Querying models...\n');
  
  const responses = await queryModels(config);
  
  // Save responses to files
  const savedPath = await saveResponses(prompt, responses);
  console.log(`Responses saved to: ${savedPath}\n`);
  
  // Also display formatted output
  const output = formatResponses(responses, config.summarize ?? true);
  console.log(output);
}

if (import.meta.main) {
  main().catch(console.error);
}