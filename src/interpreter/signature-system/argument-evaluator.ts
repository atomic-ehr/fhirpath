import type { FunctionNode } from '../../parser/ast';
import type { Context } from '../types';
import type { Interpreter } from '../interpreter';
import { EvaluationError, CollectionUtils } from '../types';
import { ContextManager } from '../context';
import type { 
  ArgumentDefinition, 
  FunctionDefinition, 
  EvaluatedArguments 
} from './types';

export class ArgumentEvaluator {
  static evaluateArguments(
    funcDef: FunctionDefinition,
    node: FunctionNode,
    input: any[],
    context: Context,
    interpreter: Interpreter
  ): any[] {
    const argDefs = funcDef.arguments || [];
    const values: any[] = [];

    // Calculate arity from arguments definition
    const arity = this.calculateArity(argDefs);
    
    // Validate argument count
    this.validateArity(funcDef.name, arity, node.arguments.length);

    // Process each argument
    for (let i = 0; i < argDefs.length; i++) {
      const argDef = argDefs[i];
      if (!argDef) continue;
      
      const argNode = node.arguments[i];

      if (!argNode && !argDef.optional) {
        throw new EvaluationError(
          `${funcDef.name}() requires ${argDef.name} argument`,
          node.position
        );
      }

      if (argNode) {
        const evaluatedArg = this.evaluateArgument(
          argDef,
          argNode,
          input,
          context,
          interpreter,
          funcDef.name
        );

        values.push(evaluatedArg.value);
      } else if (argDef.defaultValue !== undefined) {
        values.push(argDef.defaultValue);
      } else {
        values.push(undefined);
      }
    }

    return values;
  }

  private static calculateArity(argDefs: ArgumentDefinition[]): { min: number; max: number } {
    const min = argDefs.filter(arg => !arg.optional).length;
    const max = argDefs.length;
    return { min, max };
  }

  private static evaluateArgument(
    argDef: ArgumentDefinition,
    argNode: any,
    input: any[],
    context: Context,
    interpreter: Interpreter,
    functionName: string
  ): { value: any, context: Context } {
    const mode = argDef.evaluationMode || 'eager';

    // Handle lazy evaluation
    if (mode === 'lazy') {
      // Return the AST node without evaluating it
      return { value: argNode, context };
    }

    // Handle type-only evaluation
    if (mode === 'type-only') {
      // Import NodeType at the top of the file if not already imported
      const { NodeType } = require('../../parser/ast');
      
      // For type references, just return the type name
      if (argNode.type === NodeType.TypeReference) {
        return { value: (argNode as any).typeName, context };
      }
      // Also handle TypeOrIdentifier nodes (like String, Integer, etc.)
      if (argNode.type === NodeType.TypeOrIdentifier || argNode.type === NodeType.Identifier) {
        return { value: (argNode as any).name, context };
      }
      throw new EvaluationError(
        `${functionName}() ${argDef.name} requires a type reference`,
        argNode.position
      );
    }

    // Eager evaluation (default)
    const evalContext = this.getEvaluationContext(
      argDef.evaluationContext || '$this',
      input,
      context
    );

    const result = interpreter.evaluate(argNode, evalContext.input, evalContext.context);
    
    // Validate and convert result based on type
    const validated = this.validateAndConvert(
      result.value,
      argDef,
      functionName,
      argNode.position
    );

    // Apply custom validator if provided
    if (argDef.validator && validated !== undefined && validated !== null) {
      if (!argDef.validator(validated)) {
        throw new EvaluationError(
          `${functionName}() ${argDef.name} failed validation`,
          argNode.position
        );
      }
    }

    return { value: validated, context: result.context };
  }

  private static getEvaluationContext(
    contextType: string,
    input: any[],
    context: Context
  ): { input: any[], context: Context } {
    switch (contextType) {
      case 'input':
        return { input, context };
      
      case '$this':
        // Use $this from context as input
        const $this = context.env.$this || input;
        return { input: $this, context };
      
      case 'original':
        // Use original context without modification
        return { input: context.$context || input, context };
      
      default:
        return { input, context };
    }
  }

  private static validateAndConvert(
    value: any[],
    argDef: ArgumentDefinition,
    functionName: string,
    position?: any
  ): any {
    // Check if empty and optional
    if (value.length === 0 && argDef.optional) {
      return argDef.defaultValue !== undefined ? argDef.defaultValue : null;
    }

    // Type-specific validation
    switch (argDef.type) {
      case 'string':
        if (value.length === 0 && !argDef.optional) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} requires a value`,
            position
          );
        }
        const strValue = CollectionUtils.toSingleton(value);
        if (typeof strValue !== 'string' && strValue !== undefined) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} must be a string`,
            position
          );
        }
        return strValue;

      case 'integer':
        if (value.length === 0 && !argDef.optional) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} requires a value`,
            position
          );
        }
        const intValue = CollectionUtils.toSingleton(value);
        if (typeof intValue !== 'number' && intValue !== undefined) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} must be an integer`,
            position
          );
        }
        if (intValue !== undefined && !Number.isInteger(intValue)) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} must be an integer`,
            position
          );
        }
        return intValue;

      case 'decimal':
        if (value.length === 0 && !argDef.optional) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} requires a value`,
            position
          );
        }
        const numValue = CollectionUtils.toSingleton(value);
        if (typeof numValue !== 'number' && numValue !== undefined) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} must be a number`,
            position
          );
        }
        return numValue;

      case 'boolean':
        if (value.length === 0 && !argDef.optional) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} requires a value`,
            position
          );
        }
        const boolValue = CollectionUtils.toSingleton(value);
        if (typeof boolValue !== 'boolean' && boolValue !== undefined) {
          throw new EvaluationError(
            `${functionName}() ${argDef.name} must be a boolean`,
            position
          );
        }
        return boolValue;

      case 'collection':
        return value;

      case 'expression':
        // Expression type is used for lazy evaluation, shouldn't reach here
        return value;

      case 'any':
      default:
        return CollectionUtils.toSingleton(value);
    }
  }

  private static validateArity(
    functionName: string,
    arity: { min: number; max: number },
    argCount: number
  ): void {
    if (argCount < arity.min) {
      throw new EvaluationError(
        `Function ${functionName} expects at least ${arity.min} arguments, got ${argCount}`
      );
    }
    if (argCount > arity.max) {
      throw new EvaluationError(
        `Function ${functionName} expects at most ${arity.max} arguments, got ${argCount}`
      );
    }
  }
}