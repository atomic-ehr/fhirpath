import type {
  FHIRPathBuilder,
  FHIRPathAPI,
  ModelProvider,
  CustomFunction,
  FHIRPathExpression,
  CompiledExpression,
  AnalysisResult,
  EvaluationContext,
  CompileOptions,
  AnalyzeOptions,
  InspectResult,
  InspectOptions
} from './types';
import { parseLegacy, evaluate, compile, analyze, inspect } from './index';
import { PublicRegistryAPI } from './registry';
import { Registry } from '../registry/registry';
import { invalidArgument } from './errors';

export class FHIRPath {
  static builder(): FHIRPathBuilder {
    return new Builder();
  }
}

class Builder implements FHIRPathBuilder {
  private modelProvider?: ModelProvider;
  private customFunctions: Map<string, CustomFunction> = new Map();
  private variables: Map<string, any> = new Map();
  
  withModelProvider(provider: ModelProvider): this {
    this.modelProvider = provider;
    return this;
  }
  
  withCustomFunction(name: string, fn: CustomFunction): this {
    // Validate function name
    if (!name || typeof name !== 'string') {
      throw invalidArgument('Function name must be a non-empty string');
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw invalidArgument(`Invalid function name: ${name}. Must start with letter or underscore, followed by letters, numbers, or underscores`);
    }
    
    // Check for conflicts with built-ins
    if (Registry.get(name)) {
      throw invalidArgument(`Cannot override built-in operation: ${name}`);
    }
    
    this.customFunctions.set(name, fn);
    return this;
  }
  
  withVariable(name: string, value: any): this {
    if (!name || typeof name !== 'string') {
      throw invalidArgument('Variable name must be a non-empty string');
    }
    
    this.variables.set(name, value);
    return this;
  }
  
  build(): FHIRPathAPI {
    return new BuiltAPI(
      this.modelProvider,
      this.customFunctions,
      this.variables
    );
  }
}

class BuiltAPI implements FHIRPathAPI {
  public readonly registry: PublicRegistryAPI;
  
  constructor(
    private readonly modelProvider: ModelProvider | undefined,
    private readonly customFunctions: Map<string, CustomFunction>,
    private readonly defaultVariables: Map<string, any>
  ) {
    // Create a registry wrapper that includes custom functions
    this.registry = new BuiltRegistryAPI(this.customFunctions);
  }
  
  parse(expression: string): FHIRPathExpression {
    return parseLegacy(expression);
  }
  
  evaluate(expression: string | FHIRPathExpression, input?: any): any[] {
    const context = this.createContext();
    return evaluate(expression, input, context);
  }
  
  compile(expression: string | FHIRPathExpression, options?: CompileOptions): CompiledExpression {
    // TODO: Integrate custom functions into compiled code
    return compile(expression, options);
  }
  
  analyze(expression: string | FHIRPathExpression, options?: AnalyzeOptions): AnalysisResult {
    const mergedOptions: AnalyzeOptions = {
      ...options,
      modelProvider: options?.modelProvider || this.modelProvider
    };
    return analyze(expression, mergedOptions);
  }
  
  inspect(expression: string | FHIRPathExpression, input?: any, context?: EvaluationContext, options?: InspectOptions): InspectResult {
    const mergedContext = context ? { ...this.createContext(), ...context } : this.createContext();
    return inspect(expression, input, mergedContext, options);
  }
  
  private createContext(): EvaluationContext {
    const context: EvaluationContext = {};
    
    if (this.modelProvider) {
      context.modelProvider = this.modelProvider;
    }
    
    if (this.defaultVariables.size > 0) {
      context.variables = {};
      for (const [name, value] of this.defaultVariables) {
        context.variables[name] = value;
      }
    }
    
    if (this.customFunctions.size > 0) {
      context.customFunctions = {};
      for (const [name, fn] of this.customFunctions) {
        context.customFunctions[name] = fn;
      }
    }
    
    return context;
  }
}

// Extended registry that includes custom functions
class BuiltRegistryAPI extends PublicRegistryAPI {
  constructor(private customFunctions: Map<string, CustomFunction>) {
    super();
  }
  
  override hasFunction(name: string): boolean {
    return super.hasFunction(name) || this.customFunctions.has(name);
  }
  
  override hasOperation(name: string): boolean {
    return super.hasOperation(name) || this.customFunctions.has(name);
  }
  
  override canRegisterFunction(name: string): boolean {
    // Can't register if it conflicts with built-ins or already registered custom
    return super.canRegisterFunction(name) && !this.customFunctions.has(name);
  }
}