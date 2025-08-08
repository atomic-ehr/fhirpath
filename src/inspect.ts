import type { TypeInfo, ASTNode, Diagnostic } from './types';
import type { FHIRPathValue } from './boxing';
import { NodeType, DiagnosticSeverity } from './types';
import { parse } from './parser';
import { Analyzer } from './analyzer';
import { Interpreter, RuntimeContextManager } from './interpreter';
import type { RuntimeContext } from './types';

export interface ASTMetadata {
  complexity: number;
  depth: number;
  operationCount: Map<string, number>;
}

export interface InspectResult {
  result: FHIRPathValue[];
  
  ast: {
    node: ASTNode;
    metadata: ASTMetadata;
  };
  
  diagnostics: {
    warnings: Diagnostic[];
    hints: Array<{message: string; suggestion?: string}>;
  };
  
  performance: {
    parseTime: number;
    analyzeTime: number;
    evalTime: number;
    totalTime: number;
    operationTimings: Map<string, number>;
  };
  
  traces?: Array<{
    label: string;
    value: FHIRPathValue[];
    timestamp: number;
  }>;
}

export interface InspectOptions {
  input?: any;
  variables?: Record<string, any>;
  includeTraces?: boolean;
  maxDepth?: number;
}

class PerformanceTracker {
  private timings = new Map<string, number>();
  private startTimes = new Map<string, number>();
  
  start(name: string): void {
    this.startTimes.set(name, performance.now());
  }
  
  end(name: string): void {
    const startTime = this.startTimes.get(name);
    if (startTime !== undefined) {
      const duration = performance.now() - startTime;
      this.timings.set(name, duration);
      this.startTimes.delete(name);
    }
  }
  
  get(name: string): number {
    return this.timings.get(name) ?? 0;
  }
  
  getAll(): Map<string, number> {
    return new Map(this.timings);
  }
}

function analyzeAST(node: ASTNode, maxDepth = 100): ASTMetadata {
  const operationCount = new Map<string, number>();
  let complexity = 0;
  let maxDepthFound = 0;
  
  function visit(n: ASTNode, depth: number): void {
    if (depth > maxDepth) return;
    maxDepthFound = Math.max(maxDepthFound, depth);
    
    // Count operation types
    const opKey = n.type;
    operationCount.set(opKey, (operationCount.get(opKey) ?? 0) + 1);
    
    // Calculate complexity based on node type
    switch (n.type) {
      case NodeType.Binary:
        complexity += 2;
        const binary = n as any;
        visit(binary.left, depth + 1);
        visit(binary.right, depth + 1);
        break;
        
      case NodeType.Function:
        complexity += 3;
        const func = n as any;
        if (func.name) visit(func.name, depth + 1);
        func.args?.forEach((arg: ASTNode) => visit(arg, depth + 1));
        break;
        
      case NodeType.Unary:
        complexity += 1;
        visit((n as any).operand, depth + 1);
        break;
        
      case NodeType.Index:
        complexity += 2;
        const index = n as any;
        visit(index.expression, depth + 1);
        visit(index.index, depth + 1);
        break;
        
      case NodeType.Collection:
        complexity += 1;
        (n as any).elements?.forEach((el: ASTNode) => visit(el, depth + 1));
        break;
        
      case NodeType.MembershipTest:
        complexity += 2;
        const membership = n as any;
        visit(membership.expression, depth + 1);
        if (membership.typeExpression) visit(membership.typeExpression, depth + 1);
        break;
        
      case NodeType.TypeCast:
        complexity += 2;
        const typeCast = n as any;
        visit(typeCast.expression, depth + 1);
        if (typeCast.typeExpression) visit(typeCast.typeExpression, depth + 1);
        break;
        
      case NodeType.Literal:
      case NodeType.Identifier:
      case NodeType.Variable:
      case NodeType.TypeReference:
      case NodeType.TypeOrIdentifier:
        complexity += 1;
        break;
    }
  }
  
  visit(node, 0);
  
  return {
    complexity,
    depth: maxDepthFound,
    operationCount
  };
}

function generateHints(ast: ASTNode): Array<{message: string; suggestion?: string}> {
  const hints: Array<{message: string; suggestion?: string}> = [];
  
  function visit(node: ASTNode): void {
    switch (node.type) {
      case NodeType.Binary:
        const binary = node as any;
        
        // Hint for chain of where() calls
        if (binary.operator === '.' && 
            binary.right.type === NodeType.Function && 
            (binary.right as any).name?.name === 'where') {
          const leftFunc = binary.left.type === NodeType.Binary && 
                          (binary.left as any).right?.type === NodeType.Function &&
                          (binary.left as any).right?.name?.name === 'where';
          if (leftFunc) {
            hints.push({
              message: 'Multiple where() calls detected',
              suggestion: 'Consider combining conditions with "and" for better performance'
            });
          }
        }
        
        // Hint for unnecessary empty() check before first()
        if (binary.operator === '.' && 
            binary.right.type === NodeType.Function &&
            (binary.right as any).name?.name === 'first' &&
            binary.left.type === NodeType.Binary &&
            (binary.left as any).right?.type === NodeType.Function &&
            (binary.left as any).right?.name?.name === 'empty') {
          hints.push({
            message: 'Unnecessary empty() check before first()',
            suggestion: 'first() returns empty collection if input is empty'
          });
        }
        
        visit(binary.left);
        visit(binary.right);
        break;
        
      case NodeType.Function:
        const func = node as any;
        
        // Hint for count() > 0 pattern
        if (func.name?.name === 'count' && func.parent?.type === NodeType.Binary) {
          const parent = func.parent as any;
          if (parent.operator === '>' && 
              parent.right?.type === NodeType.Literal && 
              parent.right?.value === 0) {
            hints.push({
              message: 'count() > 0 pattern detected',
              suggestion: 'Consider using exists() for better clarity'
            });
          }
        }
        
        func.args?.forEach((arg: ASTNode) => visit(arg));
        break;
        
      case NodeType.Collection:
        (node as any).elements?.forEach((el: ASTNode) => visit(el));
        break;
        
      case NodeType.Unary:
        visit((node as any).operand);
        break;
        
      case NodeType.Index:
        const index = node as any;
        visit(index.expression);
        visit(index.index);
        break;
        
      case NodeType.MembershipTest:
        const membership = node as any;
        visit(membership.expression);
        if (membership.typeExpression) visit(membership.typeExpression);
        break;
        
      case NodeType.TypeCast:
        const typeCast = node as any;
        visit(typeCast.expression);
        if (typeCast.typeExpression) visit(typeCast.typeExpression);
        break;
    }
  }
  
  visit(ast);
  return hints;
}

export function inspect(
  expression: string, 
  options: InspectOptions = {}
): InspectResult {
  const tracker = new PerformanceTracker();
  const traces: InspectResult['traces'] = [];
  
  tracker.start('total');
  
  // Parse
  tracker.start('parse');
  const parseResult = parse(expression);
  const ast = parseResult.ast;
  tracker.end('parse');
  
  // Analyze
  tracker.start('analyze');
  const analyzer = new Analyzer();
  const analysisResult = analyzer.analyze(ast, options.variables);
  const warnings = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning);
  const hints = generateHints(ast);
  tracker.end('analyze');
  
  // Analyze AST metadata
  const metadata = analyzeAST(ast, options.maxDepth);
  
  // Setup context for evaluation
  const input = options.input === undefined ? [] : Array.isArray(options.input) ? options.input : [options.input];
  let context = RuntimeContextManager.create(input);
  context = RuntimeContextManager.setVariable(context, '$this', input);
  
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      const varValue = Array.isArray(value) ? value : [value];
      context = RuntimeContextManager.setVariable(context, key, varValue);
    }
  }
  
  // Setup trace collection if requested
  if (options.includeTraces) {
    // We'll collect traces by intercepting the trace function during evaluation
    // This will be implemented when trace() is called during evaluation
  }
  
  // Evaluate
  tracker.start('eval');
  const interpreter = new Interpreter();
  
  // Track operation timings
  const operationTimings = new Map<string, number>();
  const originalEvaluate = interpreter.evaluate.bind(interpreter);
  interpreter.evaluate = function(node: ASTNode, inputData: any[], ctx: RuntimeContext) {
    const opStart = performance.now();
    const result = originalEvaluate(node, inputData, ctx);
    const opTime = performance.now() - opStart;
    
    const opKey = node.type === NodeType.Function ? 
      `Function:${(node as any).name?.name || 'unknown'}` : 
      node.type === NodeType.Binary ? 
        `Binary:${(node as any).operator}` :
        node.type;
    
    operationTimings.set(opKey, (operationTimings.get(opKey) ?? 0) + opTime);
    
    return result;
  };
  
  const result = interpreter.evaluate(ast, input, context);
  tracker.end('eval');
  
  tracker.end('total');
  
  return {
    result: result.value,
    ast: {
      node: ast,
      metadata
    },
    diagnostics: {
      warnings,
      hints
    },
    performance: {
      parseTime: tracker.get('parse'),
      analyzeTime: tracker.get('analyze'),
      evalTime: tracker.get('eval'),
      totalTime: tracker.get('total'),
      operationTimings
    },
    ...(options.includeTraces && { traces })
  };
}