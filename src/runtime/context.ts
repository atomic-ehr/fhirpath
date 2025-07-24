
/**
 * Unified runtime context that works with both interpreter and compiler.
 * Uses prototype-based inheritance for efficient context copying.
 * 
 * Variable Storage Convention:
 * - Special variables: $this, $index, $total (prefixed with $)
 * - Environment variables: %context, %resource, %rootResource (stored with % prefix)
 * - User-defined variables: stored with % prefix (e.g., %x, %y)
 */
export interface RuntimeContext {
  input: any[];
  focus: any[];
  variables: Record<string, any>;
}

/**
 * Runtime context manager that provides efficient prototype-based context operations
 * for both interpreter and compiler.
 */
export class RuntimeContextManager {
  /**
   * Create a new runtime context
   */
  static create(input: any[], initialVariables?: Record<string, any>): RuntimeContext {
    const context = Object.create(null) as RuntimeContext;
    
    context.input = input;
    context.focus = input;
    
    // Create variables object with null prototype to avoid pollution
    context.variables = Object.create(null);
    
    // Set root context variables with % prefix
    context.variables['%context'] = input;
    context.variables['%resource'] = input;
    context.variables['%rootResource'] = input;
    
    // Add any initial variables (with % prefix for user-defined)
    if (initialVariables) {
      for (const [key, value] of Object.entries(initialVariables)) {
        // Add % prefix if not already present and not a special variable
        const varKey = key.startsWith('$') || key.startsWith('%') ? key : `%${key}`;
        context.variables[varKey] = value;
      }
    }
    
    return context;
  }

  /**
   * Create a child context using prototype inheritance
   * O(1) operation - no copying needed
   */
  static copy(context: RuntimeContext): RuntimeContext {
    // Create child context with parent as prototype
    const newContext = Object.create(context) as RuntimeContext;
    
    // Create child variables that inherit from parent's variables
    newContext.variables = Object.create(context.variables);
    
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
   * Set special variable ($this, $index, $total)
   */
  static setSpecialVariable(context: RuntimeContext, name: string, value: any): RuntimeContext {
    const newContext = this.copy(context);
    const varKey = `$${name}`;
    newContext.variables[varKey] = value;
    
    // Update input/focus for $this
    if (name === 'this' && Array.isArray(value) && value.length === 1) {
      newContext.input = value;
      newContext.focus = value;
    }
    
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
    let newContext = this.setSpecialVariable(context, 'this', [item]);
    newContext = this.setSpecialVariable(newContext, 'index', index);
    return newContext;
  }

  /**
   * Set a user-defined variable in the context
   */
  static setVariable(context: RuntimeContext, name: string, value: any[], allowRedefinition: boolean = false): RuntimeContext {
    // Check for system variables
    const systemVariables = ['context', 'resource', 'rootResource', 'ucum', 'sct', 'loinc'];
    if (systemVariables.includes(name)) {
      // Silently return original context for system variable redefinition
      return context;
    }
    
    // Add % prefix for user-defined variables
    const varKey = name.startsWith('%') ? name : `%${name}`;
    
    // Check if variable already exists (unless redefinition is allowed)
    if (!allowRedefinition && context.variables && Object.prototype.hasOwnProperty.call(context.variables, varKey)) {
      // Silently return original context for variable redefinition
      return context;
    }
    
    const newContext = this.copy(context);
    newContext.variables[varKey] = value;
    return newContext;
  }

  /**
   * Get a variable from context
   */
  static getVariable(context: RuntimeContext, name: string): any | undefined {
    // Handle special cases
    if (name === '$this' || name === '$index' || name === '$total') {
      return context.variables[name];
    }
    
    // Handle environment variables (with or without % prefix)
    if (name === 'context' || name === '%context') {
      return context.variables['%context'];
    }
    if (name === 'resource' || name === '%resource') {
      return context.variables['%resource'];
    }
    if (name === 'rootResource' || name === '%rootResource') {
      return context.variables['%rootResource'];
    }
    
    // Handle user-defined variables (add % prefix if not present)
    const varKey = name.startsWith('%') ? name : `%${name}`;
    return context.variables[varKey];
  }

}