import { Errors } from '../errors';
import type { RuntimeContext } from '../types';
import { box } from './boxing';

// Temporal creators used for deterministic caches
import { createDateTime, createDate, createTime } from '../complex-types/temporal';

export interface BootstrapOptions {
  modelProvider?: import('../types').ModelProvider;
  variables?: Record<string, unknown>;
  now?: Date; // provide deterministic time for tests
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
    
    // Set FHIR-specific system variables (standard URLs for code systems)
    context.variables['%sct'] = 'http://snomed.info/sct';
    context.variables['%loinc'] = 'http://loinc.org';
    context.variables['%ucum'] = 'http://unitsofmeasure.org';
    context.variables['%vs-administrative-gender'] = 'http://hl7.org/fhir/ValueSet/administrative-gender';

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
    const systemVariables = ['context', 'resource', 'rootResource', 'ucum', 'sct', 'loinc', 'vs-administrative-gender'];
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
    if (name === 'sct' || name === '%sct') {
      return context.variables['%sct'];
    }
    if (name === 'loinc' || name === '%loinc') {
      return context.variables['%loinc'];
    }
    if (name === 'ucum' || name === '%ucum') {
      return context.variables['%ucum'];
    }
    if (name === 'vs-administrative-gender' || name === '%vs-administrative-gender' || name === '%`vs-administrative-gender`') {
      return context.variables['%vs-administrative-gender'];
    }

    // Handle user-defined variables (add % prefix if not present)
    const varKey = name.startsWith('%') ? name : `%${name}`;
    // Use 'in' operator to check prototype chain for inherited variables
    if (varKey in context.variables) {
      return context.variables[varKey];
    }
    return undefined;
  }

  /**
   * Bootstrap a runtime context with input, system variables, temporal caches,
   * optional model provider, and user variables. Applies boxing policy for
   * FHIR resources when a model provider is available.
   */
  static async bootstrapContext(
    rawInput: unknown | unknown[],
    options: BootstrapOptions = {}
  ): Promise<{ context: RuntimeContext; input: any[] }> {
    const { modelProvider, variables, now } = options;

    // Normalize input to array
    const inputArray = Array.isArray(rawInput)
      ? rawInput
      : rawInput === undefined || rawInput === null
        ? []
        : [rawInput];

    // Box input with typeInfo when possible (FHIR resources)
    let boxedInput = inputArray as any[];
    if (modelProvider) {
      boxedInput = await Promise.all(
        inputArray.map(async (item) => {
          if (
            item &&
            typeof item === 'object' &&
            'resourceType' in (item as any) &&
            typeof (item as any).resourceType === 'string'
          ) {
            const ti = await modelProvider.getType((item as any).resourceType);
            return ti ? box(item, ti) : item;
          }
          return item;
        })
      );
    }

    // Create context with BOXED input so system vars keep typeInfo
    let context = RuntimeContextManager.create(boxedInput);

    // Set $this to the boxed input (expressions may rely on $this)
    context = RuntimeContextManager.setVariable(context, '$this', boxedInput);

    // Pre-cache temporal values (single timestamp for now/today/timeOfDay)
    const ts = now ?? new Date();
    const dateTime = createDateTime(
      ts.getFullYear(),
      ts.getMonth() + 1,
      ts.getDate(),
      ts.getHours(),
      ts.getMinutes(),
      ts.getSeconds(),
      ts.getMilliseconds(),
      -ts.getTimezoneOffset()
    );
    context = RuntimeContextManager.setVariable(
      context,
      '__fhirpath_now_cache__',
      box(dateTime, { type: 'DateTime', singleton: true })
    );

    const date = createDate(dateTime.year, dateTime.month, dateTime.day);
    context = RuntimeContextManager.setVariable(
      context,
      '__fhirpath_today_cache__',
      box(date, { type: 'Date', singleton: true })
    );

    const time = createTime(
      dateTime.hour!,
      dateTime.minute,
      dateTime.second,
      dateTime.millisecond
    );
    context = RuntimeContextManager.setVariable(
      context,
      '__fhirpath_timeOfDay_cache__',
      box(time, { type: 'Time', singleton: true })
    );

    // Attach model provider to context
    if (modelProvider) {
      context.modelProvider = modelProvider;
    }

    // Add user variables, boxing FHIR resources when modelProvider present
    if (variables) {
      for (const [key, rawVal] of Object.entries(variables)) {
        const values = Array.isArray(rawVal) ? rawVal : [rawVal];
        const maybeBoxed = modelProvider
          ? await Promise.all(
              values.map(async (v) => {
                if (
                  v &&
                  typeof v === 'object' &&
                  'resourceType' in (v as any) &&
                  typeof (v as any).resourceType === 'string'
                ) {
                  const ti = await modelProvider.getType((v as any).resourceType);
                  return ti ? box(v, ti) : v;
                }
                return v;
              })
            )
          : values;
        context = RuntimeContextManager.setVariable(context, key, maybeBoxed);
      }
    }

    return { context, input: boxedInput };
  }
}
