import { CollectionUtils, EvaluationError } from '../types';

/**
 * Argument validation helpers for FHIRPath functions
 * These helpers standardize argument extraction and validation
 */

export class ArgumentValidators {
  /**
   * Require a string argument at specified position
   */
  static requireString(args: any[], position: number, functionName: string, argName: string): string {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      throw new EvaluationError(`${functionName}() requires ${argName} argument`);
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'string') {
      throw new EvaluationError(`${functionName}() ${argName} must be a string`);
    }
    
    return value;
  }

  /**
   * Require an integer argument at specified position
   */
  static requireInteger(args: any[], position: number, functionName: string, argName: string): number {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      throw new EvaluationError(`${functionName}() requires ${argName} argument`);
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new EvaluationError(`${functionName}() ${argName} must be an integer`);
    }
    
    return value;
  }

  /**
   * Require a decimal argument at specified position
   */
  static requireDecimal(args: any[], position: number, functionName: string, argName: string): number {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      throw new EvaluationError(`${functionName}() requires ${argName} argument`);
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'number') {
      throw new EvaluationError(`${functionName}() ${argName} must be a number`);
    }
    
    return value;
  }

  /**
   * Require a boolean argument at specified position
   */
  static requireBoolean(args: any[], position: number, functionName: string, argName: string): boolean {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      throw new EvaluationError(`${functionName}() requires ${argName} argument`);
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'boolean') {
      throw new EvaluationError(`${functionName}() ${argName} must be a boolean`);
    }
    
    return value;
  }

  /**
   * Get an optional string argument at specified position
   */
  static optionalString(args: any[], position: number, functionName: string, argName: string): string | undefined {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      return undefined;
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'string') {
      throw new EvaluationError(`${functionName}() ${argName} must be a string`);
    }
    
    return value;
  }

  /**
   * Get an optional integer argument at specified position
   */
  static optionalInteger(args: any[], position: number, functionName: string, argName: string): number | undefined {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      return undefined;
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new EvaluationError(`${functionName}() ${argName} must be an integer`);
    }
    
    return value;
  }

  /**
   * Get an optional decimal argument at specified position
   */
  static optionalDecimal(args: any[], position: number, functionName: string, argName: string): number | undefined {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      return undefined;
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'number') {
      throw new EvaluationError(`${functionName}() ${argName} must be a number`);
    }
    
    return value;
  }

  /**
   * Get an optional boolean argument at specified position
   */
  static optionalBoolean(args: any[], position: number, functionName: string, argName: string): boolean | undefined {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      return undefined;
    }
    
    const value = CollectionUtils.toSingleton(arg);
    if (typeof value !== 'boolean') {
      throw new EvaluationError(`${functionName}() ${argName} must be a boolean`);
    }
    
    return value;
  }

  /**
   * Require a collection argument without singleton conversion
   */
  static requireCollection(args: any[], position: number, functionName: string, argName: string): any[] {
    const arg = args[position];
    if (!arg) {
      throw new EvaluationError(`${functionName}() requires ${argName} argument`);
    }
    
    return arg;
  }

  /**
   * Require a singleton value from collection argument
   */
  static requireSingleton(args: any[], position: number, functionName: string, argName: string): any {
    const arg = args[position];
    if (!arg || arg.length === 0) {
      throw new EvaluationError(`${functionName}() requires ${argName} argument`);
    }
    
    if (arg.length > 1) {
      throw new EvaluationError(`${functionName}() ${argName} must be a single value`);
    }
    
    return arg[0];
  }
}