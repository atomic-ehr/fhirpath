import type { Context, EvaluationResult } from '../interpreter/types';
import type { ASTNode } from '../parser/ast';

/**
 * A compiled FHIRPath node - a JavaScript function that implements
 * the stream-processing model: (input, context) → (output, new context)
 */
export type CompiledNode = (input: any[], context: Context) => EvaluationResult;

/**
 * A function that compiles a specific AST node type into a JavaScript closure
 */
export type NodeCompiler<T extends ASTNode = ASTNode> = (node: T) => CompiledNode;

/**
 * Compilation context for tracking state during compilation
 */
export interface CompilationContext {
  // Future: optimization flags, source map info, etc.
}

// Re-export types from registry to avoid conflicts
export type { CompiledExpression, RuntimeContext } from '../registry/types';