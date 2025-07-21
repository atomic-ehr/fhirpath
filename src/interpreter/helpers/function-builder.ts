import type { FunctionDefinition } from '../functions';
import { FunctionRegistry } from '../functions';
import type { Interpreter } from '../interpreter';
import type { Context, EvaluationResult } from '../types';
import { ArgumentValidators } from './argument-validators';
import { InputValidators } from './input-validators';

/**
 * Type specifications for function arguments
 */
export type ArgumentType = 'string' | 'integer' | 'decimal' | 'boolean' | 'collection' | 'any';

export interface ArgumentSpec {
  name: string;
  type: ArgumentType;
  optional?: boolean;
}

export interface FunctionSpec {
  name: string;
  arity: number | { min: number; max?: number };
  inputType?: ArgumentType;
  argTypes?: ArgumentSpec[];
  evaluateArgs?: boolean;
  implementation: (
    args: any[],
    input: any,
    context: Context
  ) => EvaluationResult;
}

/**
 * Function builder that provides automatic validation
 */
export class FunctionBuilder {
  /**
   * Build a function with automatic validation
   */
  static build(spec: FunctionSpec): FunctionDefinition {
    return {
      name: spec.name,
      arity: spec.arity,
      evaluateArgs: spec.evaluateArgs !== false, // default true
      evaluate: (interpreter: Interpreter, args: any[], input: any[], context: Context): EvaluationResult => {
        // Validate input if specified
        let validatedInput: any = input;
        if (spec.inputType) {
          validatedInput = this.validateInput(input, spec.inputType, spec.name);
        }

        // Validate arguments if specified
        let validatedArgs: any[] = args;
        if (spec.argTypes && spec.evaluateArgs !== false) {
          validatedArgs = this.validateArguments(args, spec.argTypes, spec.name);
        }

        // Call implementation with validated values
        return spec.implementation(validatedArgs, validatedInput, context);
      }
    };
  }

  /**
   * Validate input based on type specification
   */
  private static validateInput(input: any[], type: ArgumentType, functionName: string): any {
    switch (type) {
      case 'string':
        return InputValidators.requireStringInput(input, functionName);
      
      case 'integer':
      case 'decimal':
        return InputValidators.requireNumberInput(input, functionName);
      
      case 'boolean':
        return InputValidators.requireBooleanInput(input, functionName);
      
      case 'collection':
        return InputValidators.requireNonEmptyInput(input, functionName);
      
      case 'any':
      default:
        return input;
    }
  }

  /**
   * Validate arguments based on specifications
   */
  private static validateArguments(args: any[], specs: ArgumentSpec[], functionName: string): any[] {
    const validated: any[] = [];

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (spec) {
        const value = this.validateArgument(args, i, spec, functionName);
        validated.push(value);
      }
    }

    return validated;
  }

  /**
   * Validate a single argument
   */
  private static validateArgument(args: any[], position: number, spec: ArgumentSpec, functionName: string): any {
    const { name, type, optional } = spec;

    if (optional) {
      switch (type) {
        case 'string':
          return ArgumentValidators.optionalString(args, position, functionName, name);
        case 'integer':
          return ArgumentValidators.optionalInteger(args, position, functionName, name);
        case 'decimal':
          return ArgumentValidators.optionalDecimal(args, position, functionName, name);
        case 'boolean':
          return ArgumentValidators.optionalBoolean(args, position, functionName, name);
        case 'collection':
          return args[position] || [];
        case 'any':
        default:
          return args[position];
      }
    } else {
      switch (type) {
        case 'string':
          return ArgumentValidators.requireString(args, position, functionName, name);
        case 'integer':
          return ArgumentValidators.requireInteger(args, position, functionName, name);
        case 'decimal':
          return ArgumentValidators.requireDecimal(args, position, functionName, name);
        case 'boolean':
          return ArgumentValidators.requireBoolean(args, position, functionName, name);
        case 'collection':
          return ArgumentValidators.requireCollection(args, position, functionName, name);
        case 'any':
        default:
          return ArgumentValidators.requireSingleton(args, position, functionName, name);
      }
    }
  }
}