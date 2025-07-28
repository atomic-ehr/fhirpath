import { describe, it } from 'bun:test';
import { Parser, NodeType } from '../src/parser';
import { Lexer } from '../src/lexer';
import type { 
  ASTNode, 
  BinaryNode, 
  UnaryNode, 
  FunctionNode, 
  IndexNode,
  MembershipTestNode,
  TypeCastNode,
  CollectionNode
} from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('Parser Performance', () => {
  it('measures parser performance on fixture expressions', () => {
    runPerformanceTest();
  });
});

function runPerformanceTest() {
    const fixturesPath = path.join(process.cwd(), 'test', 'fixtures');
    const iterations = 5000; // Fewer iterations than lexer since parsing is more expensive
    
    // Read all fixture files
    const fixtureFiles = fs.readdirSync(fixturesPath)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(fixturesPath, file)
      }));
    
    console.log(`\nRunning parser performance tests with ${iterations} iterations per expression\n`);
    
    let totalExpressions = 0;
    let totalIterations = 0;
    let totalTime = 0;
    let totalTokens = 0;
    let totalNodes = 0;
    const expressionStats: { expression: string; time: number; tokens: number; nodes: number }[] = [];
    
    for (const fixture of fixtureFiles) {
      console.log(`Processing ${fixture.name}...`);
      
      const content = fs.readFileSync(fixture.path, 'utf-8');
      const expressions: string[] = JSON.parse(content);
      
      for (const expression of expressions) {
        if (!expression) continue;
        
        try {
          // Warm up run and get stats
          const warmupParser = new Parser(expression);
          const ast = warmupParser.parse();
          const tokenCount = countTokens(expression);
          const nodeCount = countNodes(ast);
          
          // Measure total time for all iterations
          const start = performance.now();
          for (let j = 0; j < iterations; j++) {
            const parser = new Parser(expression);
            parser.parse();
          }
          const end = performance.now();
          
          const totalTimeForExpression = end - start;
          totalTime += totalTimeForExpression;
          totalExpressions++;
          totalIterations += iterations;
          totalTokens += tokenCount * iterations;
          totalNodes += nodeCount * iterations;
          
          expressionStats.push({
            expression,
            time: totalTimeForExpression / iterations,
            tokens: tokenCount,
            nodes: nodeCount
          });
        } catch (error) {
          // Skip expressions that fail to parse
          console.log(`  Skipping unparseable expression: ${expression.substring(0, 50)}...`);
        }
      }
    }
    
    const avgTimePerExpression = totalTime / totalIterations;
    const avgTokensPerExpression = totalTokens / totalIterations;
    const avgNodesPerExpression = totalNodes / totalIterations;
    
    // Sort by time to find slowest expressions
    expressionStats.sort((a, b) => b.time - a.time);
    
    console.log('\n' + '='.repeat(70));
    console.log('PARSER PERFORMANCE RESULTS');
    console.log('='.repeat(70));
    console.log(`Total expressions: ${totalExpressions}`);
    console.log(`Total iterations: ${totalIterations}`);
    console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Time per expression: ${avgTimePerExpression.toFixed(4)}ms`);
    console.log(`Expressions per second: ${(1000 / avgTimePerExpression).toFixed(0)}`);
    console.log(`Average tokens per expression: ${avgTokensPerExpression.toFixed(1)}`);
    console.log(`Average AST nodes per expression: ${avgNodesPerExpression.toFixed(1)}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('TOP 10 SLOWEST EXPRESSIONS');
    console.log('='.repeat(70));
    console.log('Time (ms) | Tokens | Nodes | Expression');
    console.log('-'.repeat(70));
    
    for (let i = 0; i < Math.min(10, expressionStats.length); i++) {
      const stat = expressionStats[i];
      if (!stat) continue;
      const expr = stat.expression.length > 40 
        ? stat.expression.substring(0, 37) + '...' 
        : stat.expression;
      console.log(
        `${stat.time.toFixed(4).padStart(9)} | ` +
        `${stat.tokens.toString().padStart(6)} | ` +
        `${stat.nodes.toString().padStart(5)} | ` +
        expr
      );
    }
    
    // Calculate complexity metrics
    const complexityStats = expressionStats.map(stat => ({
      ...stat,
      timePerToken: stat.time / stat.tokens,
      timePerNode: stat.time / stat.nodes
    }));
    
    console.log('\n' + '='.repeat(70));
    console.log('COMPLEXITY ANALYSIS');
    console.log('='.repeat(70));
    
    // Group by token count ranges
    const tokenRanges = [
      { min: 0, max: 5, label: '1-5 tokens' },
      { min: 5, max: 10, label: '6-10 tokens' },
      { min: 10, max: 20, label: '11-20 tokens' },
      { min: 20, max: 50, label: '21-50 tokens' },
      { min: 50, max: Infinity, label: '50+ tokens' }
    ];
    
    console.log('\nPerformance by expression complexity:');
    console.log('Token Range  | Count | Avg Time (ms) | Time/Token (μs)');
    console.log('-'.repeat(55));
    
    for (const range of tokenRanges) {
      const inRange = complexityStats.filter(
        s => s.tokens > range.min && s.tokens <= range.max
      );
      if (inRange.length > 0) {
        const avgTime = inRange.reduce((sum, s) => sum + s.time, 0) / inRange.length;
        const avgTimePerToken = inRange.reduce((sum, s) => sum + s.timePerToken, 0) / inRange.length;
        console.log(
          `${range.label.padEnd(12)} | ${inRange.length.toString().padStart(5)} | ` +
          `${avgTime.toFixed(4).padStart(13)} | ${(avgTimePerToken * 1000).toFixed(2).padStart(15)}`
        );
      }
    }
}

function countTokens(expression: string): number {
  const lexer = new Lexer(expression);
  const tokens = lexer.tokenize();
  // Don't count EOF token
  return tokens.filter(t => t.type !== 0).length;
}

function countNodes(node: ASTNode): number {
  if (!node) return 0;
  
  let count = 1;
  
  // Handle different node types
  switch (node.type) {
    case NodeType.Binary:
      const binary = node as BinaryNode;
      count += countNodes(binary.left);
      count += countNodes(binary.right);
      break;
      
    case NodeType.Unary:
      const unary = node as UnaryNode;
      count += countNodes(unary.operand);
      break;
      
    case NodeType.Function:
      const func = node as FunctionNode;
      if (func.name && typeof func.name === 'object') {
        count += countNodes(func.name);
      }
      for (const arg of func.arguments) {
        count += countNodes(arg);
      }
      break;
      
    case NodeType.Index:
      const index = node as IndexNode;
      count += countNodes(index.expression);
      count += countNodes(index.index);
      break;
      
    case NodeType.MembershipTest:
      const membershipTest = node as MembershipTestNode;
      count += countNodes(membershipTest.expression);
      break;
      
    case NodeType.TypeCast:
      const typeCast = node as TypeCastNode;
      count += countNodes(typeCast.expression);
      break;
      
    case NodeType.Collection:
      const collection = node as CollectionNode;
      for (const elem of collection.elements) {
        count += countNodes(elem);
      }
      break;
  }
  
  return count;
}