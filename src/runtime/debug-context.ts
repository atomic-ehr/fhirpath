import type { RuntimeContext } from './context';
import type { TraceEntry, EvaluationStep, InspectOptions } from '../api/types';

/**
 * Debug-enabled runtime context that extends RuntimeContext
 * with debugging capabilities for inspect() function
 */
export interface DebugRuntimeContext extends RuntimeContext {
  debugMode: true;
  traces: TraceEntry[];
  steps?: EvaluationStep[];
  startTime: number;
  callStack: CallStackEntry[];
  inspectOptions?: InspectOptions;
}

interface CallStackEntry {
  expression: string;
  nodeType: string;
  timestamp: number;
}

/**
 * Check if a context is a debug context
 */
export function isDebugContext(context: RuntimeContext): context is DebugRuntimeContext {
  return 'debugMode' in context && context.debugMode === true;
}

/**
 * Create a debug context from a regular context
 */
export function createDebugContext(
  context: RuntimeContext,
  options?: InspectOptions
): DebugRuntimeContext {
  const debugContext = Object.create(context) as DebugRuntimeContext;
  debugContext.debugMode = true;
  debugContext.traces = [];
  debugContext.startTime = performance.now();
  debugContext.callStack = [];
  debugContext.inspectOptions = options;
  
  if (options?.recordSteps) {
    debugContext.steps = [];
  }
  
  return debugContext;
}

/**
 * Add a trace entry to the debug context
 */
export function addTrace(
  context: DebugRuntimeContext,
  name: string,
  values: any[]
): void {
  // Check trace limit
  if (context.inspectOptions?.maxTraces && 
      context.traces.length >= context.inspectOptions.maxTraces) {
    return;
  }
  
  const trace: TraceEntry = {
    name,
    values,
    timestamp: performance.now() - context.startTime,
    depth: context.callStack.length
  };
  
  context.traces.push(trace);
}

/**
 * Record an evaluation step
 */
export function recordStep(
  context: DebugRuntimeContext,
  nodeType: string,
  expression: string,
  input: any[],
  output: any[]
): void {
  if (!context.steps) return;
  
  // Check step limit
  if (context.inspectOptions?.maxSteps && 
      context.steps.length >= context.inspectOptions.maxSteps) {
    return;
  }
  
  const stepStart = performance.now();
  
  const step: EvaluationStep = {
    nodeType,
    expression,
    input,
    output,
    variables: { ...context.variables }, // Snapshot current variables
    timestamp: stepStart - context.startTime,
    duration: 0 // Will be calculated when step completes
  };
  
  context.steps.push(step);
}

/**
 * Push an entry onto the call stack
 */
export function pushCallStack(
  context: DebugRuntimeContext,
  expression: string,
  nodeType: string
): void {
  context.callStack.push({
    expression,
    nodeType,
    timestamp: performance.now() - context.startTime
  });
}

/**
 * Pop an entry from the call stack
 */
export function popCallStack(context: DebugRuntimeContext): void {
  context.callStack.pop();
}

/**
 * Get the current call stack depth
 */
export function getCallDepth(context: DebugRuntimeContext): number {
  return context.callStack.length;
}