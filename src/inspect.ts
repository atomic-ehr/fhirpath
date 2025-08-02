import { Parser } from './parser';
import { Interpreter, RuntimeContextManager } from './interpreter';
import type { ASTNode, RuntimeContext, EvaluationResult, FunctionEvaluator } from './types';
import { Registry } from './registry';
import * as operations from './operations';

export interface TraceEntry {
  name: string;
  values: any[];
  depth: number;
  timestamp: number;
  projection?: any[];
}

export interface InspectOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
  maxTraces?: number;
}

export interface InspectResult {
  expression: string;
  result: any[];
  ast: ASTNode;
  traces: TraceEntry[];
  executionTime: number;
  errors?: Array<{ type: string; message: string; location?: { line: number; column: number } }>;
  warnings?: Array<{ code: string; message: string }>;
}

class TraceCollector {
  traces: TraceEntry[] = [];
  maxTraces?: number;
  startTime: number;
  depth: number = 0;

  constructor(maxTraces?: number) {
    this.maxTraces = maxTraces;
    this.startTime = Date.now();
  }

  addTrace(name: string, values: any[], projection?: any[]) {
    if (this.maxTraces && this.traces.length >= this.maxTraces) {
      return;
    }
    
    const timestamp = Date.now() - this.startTime;
    this.traces.push({
      name,
      values: [...values], // Clone to prevent mutation
      depth: this.depth,
      timestamp,
      projection: projection ? [...projection] : undefined
    });
  }

  getTraces(): TraceEntry[] {
    return [...this.traces];
  }
}

function createTraceInterceptor(collector: TraceCollector): FunctionEvaluator {
  const originalEvaluator = operations.traceFunction.evaluate;
  
  return (input: any[], context: RuntimeContext, args: ASTNode[], evaluator: any): EvaluationResult => {
    // Check if we've reached max traces
    if (collector.maxTraces && collector.traces.length >= collector.maxTraces) {
      // Still call original to maintain console output
      return originalEvaluator(input, context, args, evaluator);
    }

    // Evaluate the name argument
    if (args.length === 0) {
      collector.addTrace('(unnamed)', input);
      return originalEvaluator(input, context, args, evaluator);
    }

    const nameResult = evaluator(args[0], input, context);
    if (nameResult.value.length !== 1 || typeof nameResult.value[0] !== 'string') {
      return originalEvaluator(input, context, args, evaluator);
    }
    
    const name = nameResult.value[0];
    
    // If projection argument is provided, evaluate it
    let projection: any[] | undefined;
    if (args.length === 2 && args[1]) {
      const projectionResult = evaluator(args[1], input, context);
      projection = projectionResult.value;
    }
    
    collector.addTrace(name, input, projection);
    
    // Call original evaluator to maintain console output and correct behavior
    return originalEvaluator(input, context, args, evaluator);
  };
}

export function inspect(
  expression: string,
  options: InspectOptions = {}
): InspectResult {
  const startTime = Date.now();
  
  try {
    const parser = new Parser(expression);
    const parseResult = parser.parse();
    
    // Collect parse errors
    const errors = parseResult.errors.map(err => ({
      type: 'ParseError',
      message: err.message,
      location: err.position ? {
        line: err.position.line,
        column: err.position.offset || 0
      } : undefined
    }));
    
    if (errors.length > 0) {
      return {
        expression,
        result: [],
        ast: parseResult.ast,
        traces: [],
        executionTime: Date.now() - startTime,
        errors
      };
    }
    
    const ast = parseResult.ast;
    
    // Create trace collector
    const traceCollector = new TraceCollector(options.maxTraces);
    
    // Create a custom registry with our trace interceptor
    const registry = new Registry();
    
    // Store original trace function
    const originalTraceEvaluator = operations.traceFunction.evaluate;
    
    // Replace with interceptor
    (operations.traceFunction as any).evaluate = createTraceInterceptor(traceCollector);
    
    try {
      // Create interpreter with our registry
      const interpreter = new Interpreter(registry);
      
      const input = options.input === undefined ? [] : Array.isArray(options.input) ? options.input : [options.input];
      
      // Create context with variables
      let context = RuntimeContextManager.create(input);
      context = RuntimeContextManager.setVariable(context, '$this', input);
      
      if (options.variables) {
        for (const [key, value] of Object.entries(options.variables)) {
          const varValue = Array.isArray(value) ? value : [value];
          context = RuntimeContextManager.setVariable(context, key, varValue);
        }
      }
      
      let result: any[] = [];
      let evalErrors: Array<{ type: string; message: string }> = [];
      
      try {
        const evalResult = interpreter.evaluate(ast, input, context);
        result = evalResult.value;
      } catch (error) {
        evalErrors.push({
          type: 'EvaluationError',
          message: error instanceof Error ? error.message : String(error)
        });
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        expression,
        result,
        ast,
        traces: traceCollector.getTraces(),
        executionTime,
        errors: evalErrors.length > 0 ? evalErrors : undefined
      };
      
    } finally {
      // Always restore original evaluator
      (operations.traceFunction as any).evaluate = originalTraceEvaluator;
    }
    
  } catch (error) {
    // Unexpected error
    return {
      expression,
      result: [],
      ast: { type: 'Error' as any, message: 'Failed to parse', range: { start: { line: 1, offset: 0 }, end: { line: 1, offset: 0 } } } as any,
      traces: [],
      executionTime: Date.now() - startTime,
      errors: [{
        type: 'UnexpectedError',
        message: error instanceof Error ? error.message : String(error)
      }]
    };
  }
}