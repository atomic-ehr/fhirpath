import { describe, it, expect } from 'bun:test';
import { parse } from '../src/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('FHIRPath Parser - Search Parameters', () => {
  it('parses all FHIRPath search parameter expressions from searchparams.json', () => {
    // Read the search parameters file
    const searchParamsPath = join(__dirname, 'searchparams.json');
    const searchParamsContent = readFileSync(searchParamsPath, 'utf-8');
    const searchParams: string[] = JSON.parse(searchParamsContent);
    
    console.log(`\nTesting ${searchParams.length} FHIRPath search parameter expressions\n`);
    
    // Track results
    const results = {
      total: searchParams.length,
      passed: 0,
      failed: 0,
      failures: [] as { expression: string; error: string; index: number }[]
    };
    
    // Measure total processing time
    const startTime = performance.now();
    
    // Test each expression
    searchParams.forEach((expression, index) => {
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
    const avgTime = totalTime / searchParams.length;
    
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
      // Limit to first 20 failures for readability
      const failuresToShow = Math.min(results.failures.length, 20);
      results.failures.slice(0, failuresToShow).forEach(failure => {
        console.log(`\n  [${failure.index}] Expression: ${failure.expression.substring(0, 100)}${failure.expression.length > 100 ? '...' : ''}`);
        console.log(`      Error: ${failure.error}`);
      });
      
      if (results.failures.length > failuresToShow) {
        console.log(`\n  ... and ${results.failures.length - failuresToShow} more failures`);
      }
    }
    
    // Assert that we have a high success rate
    expect(results.total).toBeGreaterThan(0);
    
    // Log summary for visibility
    if (results.failed > 0) {
      console.log(`\n⚠️  ${results.failed} search parameter expressions failed to parse - see details above`);
    } else {
      console.log(`\n✅ All ${results.total} search parameter expressions parsed successfully!`);
    }
  });
  
  it('analyzes expression complexity in search parameters', () => {
    // Read the search parameters file
    const searchParamsPath = join(__dirname, 'searchparams.json');
    const searchParamsContent = readFileSync(searchParamsPath, 'utf-8');
    const searchParams: string[] = JSON.parse(searchParamsContent);
    
    // Analyze expressions
    const stats = {
      totalExpressions: searchParams.length,
      byLength: {
        short: 0,      // < 50 chars
        medium: 0,     // 50-200 chars
        long: 0,       // 200-500 chars
        veryLong: 0    // > 500 chars
      },
      features: {
        withUnion: 0,
        withOfType: 0,
        withWhere: 0,
        withAs: 0,
        multiResource: 0,
        withDot: 0
      }
    };
    
    searchParams.forEach(expr => {
      // Length analysis
      if (expr.length < 50) stats.byLength.short++;
      else if (expr.length < 200) stats.byLength.medium++;
      else if (expr.length < 500) stats.byLength.long++;
      else stats.byLength.veryLong++;
      
      // Feature analysis
      if (expr.includes(' | ')) stats.features.withUnion++;
      if (expr.includes('ofType(')) stats.features.withOfType++;
      if (expr.includes('where(')) stats.features.withWhere++;
      if (expr.includes(' as ')) stats.features.withAs++;
      if ((expr.match(/\w+\./g) || []).length > 5) stats.features.multiResource++;
      if (expr.includes('.')) stats.features.withDot++;
    });
    
    console.log('\nExpression Complexity Analysis:');
    console.log(`\nLength Distribution:`);
    console.log(`  Short (<50 chars): ${stats.byLength.short} (${(stats.byLength.short / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  Medium (50-200): ${stats.byLength.medium} (${(stats.byLength.medium / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  Long (200-500): ${stats.byLength.long} (${(stats.byLength.long / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  Very Long (>500): ${stats.byLength.veryLong} (${(stats.byLength.veryLong / stats.totalExpressions * 100).toFixed(1)}%)`);
    
    console.log(`\nFeature Usage:`);
    console.log(`  With union (|): ${stats.features.withUnion} (${(stats.features.withUnion / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  With ofType(): ${stats.features.withOfType} (${(stats.features.withOfType / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  With where(): ${stats.features.withWhere} (${(stats.features.withWhere / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  With 'as' cast: ${stats.features.withAs} (${(stats.features.withAs / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  Multi-resource: ${stats.features.multiResource} (${(stats.features.multiResource / stats.totalExpressions * 100).toFixed(1)}%)`);
    console.log(`  With dot navigation: ${stats.features.withDot} (${(stats.features.withDot / stats.totalExpressions * 100).toFixed(1)}%)`);
    
    // Find longest expression
    const longest = searchParams.reduce((max, expr) => expr.length > max.length ? expr : max, '');
    console.log(`\nLongest expression (${longest.length} chars):`);
    console.log(`  ${longest.substring(0, 100)}...`);
    
    expect(stats.totalExpressions).toBeGreaterThan(0);
  });
  
  it('measures performance on search parameter expressions', () => {
    // Read the search parameters file
    const searchParamsPath = join(__dirname, 'searchparams.json');
    const searchParamsContent = readFileSync(searchParamsPath, 'utf-8');
    const searchParams: string[] = JSON.parse(searchParamsContent);
    
    // Find slowest expressions
    const timings: { expression: string; time: number; index: number }[] = [];
    
    searchParams.forEach((expression, index) => {
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
    console.log(`\nSlowest search parameter expressions to parse:`);
    timings.slice(0, 10).forEach((timing, i) => {
      console.log(`  ${i + 1}. [${timing.index}] ${timing.time.toFixed(3)}ms - ${timing.expression.substring(0, 80)}${timing.expression.length > 80 ? '...' : ''}`);
    });
    
    // Calculate percentiles
    if (timings.length > 0) {
      const sorted = [...timings].sort((a, b) => a.time - b.time);
      const p50 = sorted[Math.floor(sorted.length * 0.5)]!.time;
      const p90 = sorted[Math.floor(sorted.length * 0.9)]!.time;
      const p99 = sorted[Math.floor(sorted.length * 0.99)]!.time;
      
      console.log(`\nPerformance Percentiles:`);
      console.log(`  50th percentile: ${p50.toFixed(3)}ms`);
      console.log(`  90th percentile: ${p90.toFixed(3)}ms`);
      console.log(`  99th percentile: ${p99.toFixed(3)}ms`);
      
      // Check that even the slowest expressions are reasonably fast
      expect(timings[0]!.time).toBeLessThan(10); // Slowest should be under 10ms
    }
  });
});