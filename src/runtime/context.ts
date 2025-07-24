import type { Context } from '../interpreter/types';

/**
 * Unified runtime context that works with both interpreter and compiler.
 * Uses prototype-based inheritance for efficient context copying.
 */
export interface RuntimeContext {
  input: any[];
  focus: any[];
  env: {
    $this?: any[];
    $index?: number;
    $total?: any[];
    $context?: any[];
    $resource?: any[];
    $rootResource?: any[];
    [key: string]: any;
  };
  variables?: Record<string, any[]>;
}

/**
 * Runtime context manager that provides efficient prototype-based context operations
 * for both interpreter and compiler.
 */
export class RuntimeContextManager {
  /**
   * Create a new runtime context
   */
  static create(input: any[], initialEnv?: Record<string, any>): RuntimeContext {
    const context = Object.create(null) as RuntimeContext;
    
    context.input = input;
    context.focus = input;
    
    // Create env with null prototype to avoid pollution
    context.env = Object.create(null);
    if (initialEnv) {
      Object.assign(context.env, initialEnv);
    }
    
    // Set root context variables
    context.env.$context = input;
    context.env.$resource = input;
    context.env.$rootResource = input;
    
    // Create variables object
    context.variables = Object.create(null);
    
    return context;
  }

  /**
   * Create a child context using prototype inheritance
   * O(1) operation - no copying needed
   */
  static copy(context: RuntimeContext): RuntimeContext {
    // Create child context with parent as prototype
    const newContext = Object.create(context) as RuntimeContext;
    
    // Create child env that inherits from parent's env
    newContext.env = Object.create(context.env);
    
    // Create child variables that inherit from parent's variables
    if (context.variables) {
      newContext.variables = Object.create(context.variables);
    }
    
    // input and focus are inherited through prototype chain
    // Only set them if they need to change
    
    return newContext;
  }

  /**
   * Create a new context with updated input/focus
   */
  static withInput(context: RuntimeContext, input: any[], focus?: any[]): RuntimeContext {
    const newContext = this.copy(context);
    newContext.input = input;
    newContext.focus = focus ?? input;
    return newContext;
  }

  /**
   * Set iterator context ($this, $index)
   */
  static withIterator(
    context: RuntimeContext, 
    item: any, 
    index: number
  ): RuntimeContext {
    const newContext = this.copy(context);
    newContext.env.$this = [item];
    newContext.env.$index = index;
    newContext.input = [item];
    newContext.focus = [item];
    return newContext;
  }

  /**
   * Set a variable in the context
   */
  static setVariable(context: RuntimeContext, name: string, value: any[]): RuntimeContext {
    const newContext = this.copy(context);
    if (!newContext.variables) {
      newContext.variables = Object.create(null);
    }
    newContext.variables![name] = value;
    return newContext;
  }

  /**
   * Get a variable from context (handles special variables too)
   */
  static getVariable(context: RuntimeContext, name: string): any[] | undefined {
    // Remove % prefix if present
    const varName = name.startsWith('%') ? name.substring(1) : name;
    
    // Check special variables first
    switch (varName) {
      case 'context':
        return context.env.$context || context.input;
      case 'resource':
        return context.env.$resource || context.input;
      case 'rootResource':
        return context.env.$rootResource || context.input;
      default:
        // Check user-defined variables
        return context.variables?.[varName];
    }
  }

  /**
   * Convert from interpreter Context to RuntimeContext
   */
  static fromContext(context: Context, input: any[]): RuntimeContext {
    const rtContext = this.create(input);
    
    // Copy variables
    if (context.variables) {
      rtContext.variables = Object.create(context.variables);
    }
    
    // Copy environment
    Object.assign(rtContext.env, context.env);
    
    // Copy root variables
    if ((context as any).$context) rtContext.env.$context = (context as any).$context;
    if ((context as any).$resource) rtContext.env.$resource = (context as any).$resource;
    if ((context as any).$rootResource) rtContext.env.$rootResource = (context as any).$rootResource;
    
    return rtContext;
  }

  /**
   * Convert from RuntimeContext to interpreter Context
   */
  static toContext(rtContext: RuntimeContext): Context {
    const context = Object.create(null) as Context;
    
    // Copy variables
    context.variables = rtContext.variables || Object.create(null);
    
    // Extract env variables
    context.env = {
      $this: rtContext.env.$this,
      $index: rtContext.env.$index,
      $total: rtContext.env.$total
    };
    
    // Extract root variables
    (context as any).$context = rtContext.env.$context;
    (context as any).$resource = rtContext.env.$resource;
    (context as any).$rootResource = rtContext.env.$rootResource;
    
    return context;
  }
}