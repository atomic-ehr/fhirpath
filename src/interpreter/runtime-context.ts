import { Errors } from '../errors';
import type { RuntimeContext } from '../types';

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
   * Set iterator context ($this, $index)
   */
  static withIterator(
    context: RuntimeContext,
    item: any,
    index: number
  ): RuntimeContext {
    let newContext = this.setVariable(context, '$this', [item], true);
    newContext = this.setVariable(newContext, '$index', index, true);
    return newContext;
  }

  /**
   * Set a variable in the context (handles both special $ and user % variables)
   */
  static setVariable(context: RuntimeContext, name: string, value: any, allowRedefinition: boolean = false): RuntimeContext {
    // Ensure value is array for consistency (except for special variables like $index)
    const arrayValue = (name === '$index' || name === '$total') ? value :
                      Array.isArray(value) ? value : [value];

    // Determine variable key based on prefix
    let varKey = name;
    if (!name.startsWith('$') && !name.startsWith('%')) {
      // No prefix - assume user-defined variable, add % prefix
      varKey = `%${name}`;
    }

    // Check for system variables (with or without % prefix)
    const systemVariables = ['context', 'resource', 'rootResource', 'ucum', 'sct', 'loinc'];
    const baseVarName = varKey.startsWith('%') ? varKey.substring(1) : varKey;
    if (systemVariables.includes(baseVarName)) {
      // Throw error when trying to override system variables
      throw Errors.invalidOperation(`Cannot override system variable: ${baseVarName}`);
    }

    // Check if variable already exists (unless redefinition is allowed)
    // Use 'in' operator to check prototype chain (inherited variables)
    // Exclude iteration variables ($this, $index, $total) which can be redefined in nested scopes
    const iterationVariables = ['$this', '$index', '$total'];
    if (!allowRedefinition && context.variables && varKey in context.variables && !iterationVariables.includes(varKey)) {
      // Per FHIRPath spec §1.5.10.3: throw error on variable redefinition
      throw Errors.variableAlreadyDefined(name);
    }

    // Create new context and set variable
    const newContext = this.copy(context);
    newContext.variables[varKey] = arrayValue;

    // Special handling for $this
    if (varKey === '$this' && Array.isArray(arrayValue) && arrayValue.length === 1) {
      newContext.input = arrayValue;
      newContext.focus = arrayValue;
    }

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
    // Use 'in' operator to check prototype chain for inherited variables
    if (varKey in context.variables) {
      return context.variables[varKey];
    }
    return undefined;
  }
}

