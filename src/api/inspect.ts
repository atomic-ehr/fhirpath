import type { 
  FHIRPathExpression,
  EvaluationContext,
  InspectResult,
  InspectOptions,
  ErrorInfo,
  WarningInfo
} from './types';
import { parseLegacy } from './index';
import { Interpreter } from '../interpreter/interpreter';
import { RuntimeContextManager } from '../runtime/context';
import { createDebugContext, isDebugContext } from '../runtime/debug-context';
import { FHIRPathError } from './errors';

/**
 * Inspect a FHIRPath expression, providing rich debugging information
 * including traces, AST, execution time, and optionally step-by-step evaluation
 */
export function inspect(
  expression: string | FHIRPathExpression,
  input?: any,
  context?: EvaluationContext,
  options?: InspectOptions
): InspectResult {
  const startTime = performance.now();
  
  // Parse if string
  const expr = typeof expression === 'string' ? parseLegacy(expression) : expression;
  const exprString = typeof expression === 'string' ? expression : expr.toString();
  
  // Prepare input (default to empty array)
  const inputValue = input === undefined ? [] : Array.isArray(input) ? input : [input];
  
  // Create runtime context
  const runtimeContext = RuntimeContextManager.create(inputValue, context?.variables);
  
  // Convert to debug context
  const debugContext = createDebugContext(runtimeContext, options);
  
  // Initialize result
  const errors: ErrorInfo[] = [];
  const warnings: WarningInfo[] = [];
  let result: any[] = [];
  
  try {
    // Create interpreter
    const interpreter = new Interpreter();
    
    // Evaluate with debug context
    const evalResult = interpreter.evaluate(expr.ast, inputValue, debugContext);
    result = evalResult.value;
  } catch (error) {
    // Capture error information
    const errorInfo: ErrorInfo = {
      message: error instanceof Error ? error.message : String(error),
      type: error instanceof FHIRPathError ? error.name : 'Error'
    };
    
    if (error instanceof Error && error.stack) {
      errorInfo.stack = error.stack;
    }
    
    errors.push(errorInfo);
    
    // Re-throw if it's a critical error
    if (error instanceof FHIRPathError && error.name === 'ParseError') {
      throw error;
    }
  }
  
  const executionTime = performance.now() - startTime;
  
  // Build result
  const inspectResult: InspectResult = {
    result,
    expression: exprString,
    ast: expr.ast,
    executionTime,
    traces: debugContext.traces
  };
  
  // Add optional fields
  if (debugContext.steps && debugContext.steps.length > 0) {
    inspectResult.evaluationSteps = debugContext.steps;
  }
  
  if (errors.length > 0) {
    inspectResult.errors = errors;
  }
  
  if (warnings.length > 0) {
    inspectResult.warnings = warnings;
  }
  
  return inspectResult;
}