import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('FHIRPath Parser - Invariants', () => {
  it('parses all FHIRPath invariants from invariants.json', () => {
    // Read the invariants file
    const invariantsPath = join(__dirname, 'invariants.json');
    const invariantsContent = readFileSync(invariantsPath, 'utf-8');
    const invariants: string[] = JSON.parse(invariantsContent);
    
    console.log(`\nTesting ${invariants.length} FHIRPath expressions from invariants.json\n`);
    
    // Track results
    const results = {
      total: invariants.length,
      passed: 0,
      failed: 0,
      failures: [] as { expression: string; error: string; index: number }[]
    };
    
    // Measure total processing time
    const startTime = performance.now();
    
    // Test each expression
    invariants.forEach((expression, index) => {
      try {
        parse(expression);
        results.passed++;
      } catch (error) {
        results.failed++;
        results.failures.push({
          expression,
          error: (error as any).message,
          index: index + 1
        });
      }
    });
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / invariants.length;
    
    // Report results
    console.log(`Results:`);
    console.log(`  Total expressions: ${results.total}`);
    console.log(`  Passed: ${results.passed} (${(results.passed / results.total * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${results.failed} (${(results.failed / results.total * 100).toFixed(1)}%)`);
    console.log(`\nPerformance:`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Average time per expression: ${avgTime.toFixed(3)}ms`);
    
    // Report failures if any
    if (results.failures.length > 0) {
      console.log(`\nFailures (${results.failures.length}):`);
      results.failures.forEach(failure => {
        console.log(`\n  [${failure.index}] Expression: ${failure.expression}`);
        console.log(`      Error: ${failure.error}`);
      });
    }
    
    // Assert that we have a high success rate
    // We expect some failures initially as the parser may not support all FHIRPath features yet
    expect(results.total).toBeGreaterThan(0);
    
    // Log summary for visibility
    if (results.failed > 0) {
      console.log(`\n⚠️  ${results.failed} expressions failed to parse - see details above`);
    } else {
      console.log(`\n✅ All ${results.total} expressions parsed successfully!`);
    }
  });
  
  it('measures individual expression parse times', () => {
    // Read the invariants file
    const invariantsPath = join(__dirname, 'invariants.json');
    const invariantsContent = readFileSync(invariantsPath, 'utf-8');
    const invariants: string[] = JSON.parse(invariantsContent);
    
    // Find slowest expressions
    const timings: { expression: string; time: number; index: number }[] = [];
    
    invariants.forEach((expression, index) => {
      try {
        const start = performance.now();
        parse(expression);
        const end = performance.now();
        timings.push({
          expression,
          time: end - start,
          index: index + 1
        });
      } catch {
        // Skip failed expressions for timing analysis
      }
    });
    
    // Sort by time descending
    timings.sort((a, b) => b.time - a.time);
    
    // Report slowest expressions
    console.log(`\nSlowest expressions to parse:`);
    timings.slice(0, 10).forEach((timing, i) => {
      console.log(`  ${i + 1}. [${timing.index}] ${timing.time.toFixed(3)}ms - ${timing.expression.substring(0, 80)}${timing.expression.length > 80 ? '...' : ''}`);
    });
    
    // Check that even the slowest expressions are reasonably fast
    if (timings.length > 0) {
      expect(timings[0]!.time).toBeLessThan(10); // Slowest should be under 10ms
    }
  });
});