import type { FunctionDefinition } from '../functions';
import type { EnhancedFunctionDefinition } from './types';
import type { Context, EvaluationResult } from '../types';
import type { Interpreter } from '../interpreter';
import type { ASTNode } from '../../parser/ast';

export function enhancedToStandardFunction(enhanced: EnhancedFunctionDefinition): FunctionDefinition {
  // Calculate arity from arguments definition
  const minArgs = enhanced.arguments?.filter(arg => !arg.optional).length ?? 0;
  const maxArgs = enhanced.arguments?.length ?? 0;
  
  const arity = minArgs === maxArgs ? minArgs : { min: minArgs, max: maxArgs };
  
  // Check if any argument needs lazy evaluation
  const hasLazyArgs = enhanced.arguments?.some(arg => arg.evaluationMode === 'lazy') ?? false;
  
  return {
    name: enhanced.name,
    arity,
    evaluateArgs: !hasLazyArgs,
    evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
      if (hasLazyArgs && Array.isArray(args) && args.length > 0 && args[0] && 'type' in args[0]) {
        // We have AST nodes - handle lazy evaluation
        const evaluatedArgs: any[] = [];
        const astArgs = args as ASTNode[];
        
        for (let i = 0; i < astArgs.length; i++) {
          const argDef = enhanced.arguments?.[i];
          if (argDef?.evaluationMode === 'lazy') {
            // Pass AST node directly
            evaluatedArgs.push(astArgs[i]);
          } else {
            // Evaluate the argument
            const astNode = astArgs[i];
            if (astNode) {
              const argResult = interpreter.evaluate(astNode, input, context);
              evaluatedArgs.push(argResult.value);
            }
          }
        }
        
        return enhanced.evaluate(interpreter, context, input, ...evaluatedArgs);
      } else {
        // Normal case - args are already evaluated
        const evaluatedArgs = (args as any[][]) || [];
        
        // Apply defaults for optional arguments
        const finalArgs: any[] = [];
        const argsLength = enhanced.arguments?.length ?? 0;
        for (let i = 0; i < argsLength; i++) {
          const argDef = enhanced.arguments?.[i];
          if (i < evaluatedArgs.length) {
            finalArgs.push(evaluatedArgs[i]);
          } else if (argDef && argDef.optional && argDef.defaultValue !== undefined) {
            finalArgs.push(argDef.defaultValue);
          } else {
            finalArgs.push(undefined);
          }
        }
        
        // Validate input type if specified
        if (enhanced.inputType && enhanced.inputType !== 'any') {
          const typeCheck = validateType(input, enhanced.inputType);
          if (!typeCheck) {
            throw new Error(`${enhanced.name}() requires ${enhanced.inputType} input`);
          }
        }
        
        return enhanced.evaluate(interpreter, context, input, ...finalArgs);
      }
    }
  };
}

function validateType(value: any[], expectedType: string): boolean {
  if (value.length === 0) return true; // Empty is valid for any type
  
  switch (expectedType) {
    case 'string':
      return value.every(v => typeof v === 'string');
    case 'integer':
      return value.every(v => typeof v === 'number' && Number.isInteger(v));
    case 'decimal':
      return value.every(v => typeof v === 'number');
    case 'boolean':
      return value.every(v => typeof v === 'boolean');
    case 'collection':
      return true; // Any collection is valid
    default:
      return true;
  }
}