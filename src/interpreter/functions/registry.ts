import type { FunctionNode } from '../../parser/ast';
import { NodeType } from '../../parser/ast';
import type { IdentifierNode, BinaryNode } from '../../parser/ast';
import type { Context, EvaluationResult } from '../types';
import type { Interpreter } from '../interpreter';
import { EvaluationError } from '../types';
import { ArgumentEvaluator } from '../signature-system/argument-evaluator';
import type { EnhancedFunctionDefinition } from '../signature-system/types';

/**
 * Registry of built-in FHIRPath functions using the new signature system
 */
export class FunctionRegistry {
  private static functions = new Map<string, EnhancedFunctionDefinition>();

  /**
   * Register a function
   */
  static register(fn: EnhancedFunctionDefinition) {
    this.functions.set(fn.name, fn);
  }

  /**
   * Get a function definition
   */
  static get(name: string): EnhancedFunctionDefinition | undefined {
    return this.functions.get(name);
  }

  /**
   * Check if a function exists
   */
  static has(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Evaluate a function call
   */
  static evaluate(
    interpreter: Interpreter,
    node: FunctionNode,
    input: any[],
    context: Context
  ): EvaluationResult {
    let funcName: string;
    
    // Handle different function name patterns
    if (node.name.type === NodeType.Identifier) {
      funcName = (node.name as IdentifierNode).name;
    } else if (node.name.type === NodeType.Binary) {
      // Method call syntax like 'hello'.is(String)
      const binaryNode = node.name as BinaryNode;
      if (binaryNode.right.type === NodeType.Identifier) {
        funcName = (binaryNode.right as IdentifierNode).name;
        // For method calls, evaluate the left side and use as input
        const leftResult = interpreter.evaluate(binaryNode.left, input, context);
        input = leftResult.value;
        // Update $this to the new input for method calls
        context = {
          ...leftResult.context,
          env: {
            ...leftResult.context.env,
            $this: input
          }
        };
      } else {
        throw new EvaluationError('Invalid function call syntax', node.position);
      }
    } else {
      throw new EvaluationError('Invalid function name', node.position);
    }
    
    const funcDef = this.get(funcName);

    if (!funcDef) {
      throw new EvaluationError(`Unknown function: ${funcName}`, node.position);
    }

    // Check propagateEmptyInput flag
    if (funcDef.propagateEmptyInput && input.length === 0) {
      return { value: [], context };
    }

    // Validate input type if specified
    if (funcDef.inputType) {
      validateInputType(input, funcDef.inputType, funcDef.name);
    }

    // Evaluate arguments using the centralized evaluator
    const evaluatedArgs = ArgumentEvaluator.evaluateArguments(
      funcDef,
      node,
      input,
      context,
      interpreter
    );

    // Check if this is a new-style function (checks for 4 parameters)
    if (funcDef.evaluate.length >= 4) {
      // New style - pass spread arguments
      return funcDef.evaluate(interpreter, context, input, ...evaluatedArgs);
    } else {
      // Old style - pass EvaluatedArguments object for backward compatibility
      const legacyArgs = {
        values: evaluatedArgs,
        ast: node.arguments,
        metadata: {
          types: [],
          evaluationModes: [],
          contexts: []
        }
      };
      return (funcDef.evaluate as any)(interpreter, legacyArgs, input, context);
    }
  }
}

// Utility function for input validation
function validateInputType(input: any[], type: string, functionName: string): void {
  switch (type) {
    case 'string':
      if (input.length > 0) {
        for (const item of input) {
          if (typeof item !== 'string') {
            throw new EvaluationError(`${functionName}() requires string input`);
          }
        }
      }
      break;
    
    case 'integer':
      if (input.length > 0) {
        for (const item of input) {
          if (typeof item !== 'number' || !Number.isInteger(item)) {
            throw new EvaluationError(`${functionName}() requires integer input`);
          }
        }
      }
      break;
    
    case 'decimal':
      if (input.length > 0) {
        for (const item of input) {
          if (typeof item !== 'number') {
            throw new EvaluationError(`${functionName}() requires numeric input`);
          }
        }
      }
      break;
    
    case 'boolean':
      if (input.length > 0) {
        for (const item of input) {
          if (typeof item !== 'boolean') {
            throw new EvaluationError(`${functionName}() requires boolean input`);
          }
        }
      }
      break;
    
    case 'collection':
      // Any collection is valid
      break;
    
    case 'any':
    default:
      // No validation needed
      break;
  }
}