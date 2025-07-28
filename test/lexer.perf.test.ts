import { describe, it } from 'bun:test';
import { Lexer } from '../src/lexer';
import * as fs from 'fs';
import * as path from 'path';

describe('Lexer Performance', () => {
  it('measures lexer performance on fixture expressions', () => {
    runPerformanceTest(false);
  });
});

function runPerformanceTest(preserveTrivia: boolean) {
    const fixturesPath = path.join(process.cwd(), 'test', 'fixtures');
    const iterations = 10000;
    
    // Read all fixture files
    const fixtureFiles = fs.readdirSync(fixturesPath)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(fixturesPath, file)
      }));
    
    console.log(`\nRunning lexer performance tests with ${iterations} iterations per expression`);
    console.log(`Trivia preservation: ${preserveTrivia ? 'ENABLED' : 'DISABLED'}\n`);
    
    let totalExpressions = 0;
    let totalIterations = 0;
    let totalTime = 0;
    
    for (const fixture of fixtureFiles) {
      console.log(`Processing ${fixture.name}...`);
      
      const content = fs.readFileSync(fixture.path, 'utf-8');
      const expressions: string[] = JSON.parse(content);
      
      for (const expression of expressions) {
        if (!expression) continue;
        
        // Warm up run
        const warmupLexer = new Lexer(expression, { preserveTrivia });
        warmupLexer.tokenize();
        
        // Measure total time for all iterations
        const start = performance.now();
        for (let j = 0; j < iterations; j++) {
          const lexer = new Lexer(expression, { preserveTrivia });
          lexer.tokenize();
        }
        const end = performance.now();
        
        totalTime += (end - start);
        totalExpressions++;
        totalIterations += iterations;
      }
    }
    
    const avgTimePerExpression = totalTime / totalIterations;
    
    console.log('\n' + '='.repeat(50));
    console.log('RESULTS');
    console.log('='.repeat(50));
    console.log(`Total expressions: ${totalExpressions}`);
    console.log(`Total iterations: ${totalIterations}`);
    console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Time per expression: ${avgTimePerExpression.toFixed(4)}ms`);
    console.log(`Expressions per second: ${(1000 / avgTimePerExpression).toFixed(0)}`);
}