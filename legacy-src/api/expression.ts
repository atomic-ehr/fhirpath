import type { ASTNode } from '../parser/ast';
import type { 
  FHIRPathExpression as IFHIRPathExpression,
  CompiledExpression,
  EvaluationContext,
  CompileOptions,
  AnalyzeOptions,
  AnalysisResult
} from './types';
import { Interpreter } from '../interpreter/interpreter';
import { Compiler } from '../compiler/compiler';
import { analyzeFHIRPath } from '../analyzer/analyzer';
import { RuntimeContextManager } from '../runtime/context';
import { pprint } from '../parser/pprint';

export class FHIRPathExpression implements IFHIRPathExpression {
  constructor(
    public readonly ast: ASTNode,
    private readonly originalExpression: string
  ) {}
  
  evaluate(input?: any, context?: EvaluationContext): any[] {
    const interpreter = new Interpreter();
    const inputArray = input === undefined ? [] : Array.isArray(input) ? input : [input];
    const ctx = this.createContext(context, inputArray);
    
    const result = interpreter.evaluate(this.ast, inputArray, ctx);
    
    return result.value;
  }
  
  compile(options?: CompileOptions): CompiledExpression {
    const compiler = new Compiler();
    const compiled = compiler.compile(this.ast);
    
    // Create the compiled function
    const fn = (input?: any, context?: EvaluationContext): any[] => {
      const inputArray = input === undefined ? [] : Array.isArray(input) ? input : [input];
      const ctx = this.createContext(context, inputArray);
      
      return compiled.fn(ctx);
    };
    
    // Add source property
    Object.defineProperty(fn, 'source', {
      value: options?.sourceMap ? this.originalExpression : this.toString(),
      writable: false,
      enumerable: true
    });
    
    return fn as CompiledExpression;
  }
  
  analyze(options?: AnalyzeOptions): AnalysisResult {
    try {
      // Create analyzer-compatible model provider
      const analyzerModelProvider = options?.modelProvider ? {
        resolveType: options.modelProvider.resolveType.bind(options.modelProvider),
        getPropertyType: (type: any, propName: string) => {
          const props = options.modelProvider!.getProperties(options.modelProvider!.getTypeName ? options.modelProvider!.getTypeName(type) : String(type));
          const prop = props.find(p => p.name === propName);
          if (!prop) return undefined;
          return {
            type: options.modelProvider!.resolveType(prop.type),
            isSingleton: !prop.isCollection
          };
        },
        isAssignable: (from: any, to: any) => {
          const hierarchy = options.modelProvider!.getTypeHierarchy(options.modelProvider!.getTypeName ? options.modelProvider!.getTypeName(from) : String(from));
          const toName = options.modelProvider!.getTypeName ? options.modelProvider!.getTypeName(to) : String(to);
          return hierarchy.includes(toName);
        },
        getTypeName: (type: any) => String(type)
      } : {
        resolveType: () => undefined,
        getPropertyType: () => undefined,
        isAssignable: () => false,
        getTypeName: () => 'unknown'
      };
      
      const result = analyzeFHIRPath(this.ast, analyzerModelProvider);
      
      return {
        type: result.resultType || { kind: 'unknown' },
        isSingleton: result.resultIsSingleton || false,
        errors: result.diagnostics.filter(d => d.severity === 'error').map(d => ({
          message: d.message,
          location: d.position ? {
            line: d.position.line,
            column: d.position.column,
            offset: d.position.offset,
            length: 1 // We don't have length info in Position
          } : undefined,
          code: 'ANALYSIS_ERROR'
        })),
        warnings: result.diagnostics.filter(d => d.severity === 'warning').map(d => ({
          message: d.message,
          location: d.position ? {
            line: d.position.line,
            column: d.position.column,
            offset: d.position.offset,
            length: 1
          } : undefined,
          code: 'ANALYSIS_WARNING'
        }))
      };
    } catch (error) {
      return {
        type: { kind: 'unknown' },
        isSingleton: false,
        errors: [{
          message: error instanceof Error ? error.message : String(error),
          code: 'ANALYSIS_ERROR'
        }],
        warnings: []
      };
    }
  }
  
  toString(): string {
    return pprint(this.ast);
  }
  
  private createContext(evalContext?: EvaluationContext, input: any[] = []) {
    let ctx = RuntimeContextManager.create(input);
    
    if (evalContext?.variables) {
      for (const [name, value] of Object.entries(evalContext.variables)) {
        ctx = RuntimeContextManager.setVariable(ctx, name, Array.isArray(value) ? value : [value]);
      }
    }
    
    if (evalContext?.environment) {
      // Environment variables are stored as regular variables with appropriate prefix
      for (const [name, value] of Object.entries(evalContext.environment)) {
        if (name.startsWith('$')) {
          // Special environment variables
          const varName = name.substring(1); // Remove $ prefix
          ctx = RuntimeContextManager.setSpecialVariable(ctx, varName, Array.isArray(value) ? value : [value]);
        } else {
          // Regular environment variables
          ctx = RuntimeContextManager.setVariable(ctx, name, Array.isArray(value) ? value : [value]);
        }
      }
    }
    
    // Store custom functions in context for interpreter to access
    if (evalContext?.customFunctions) {
      // TODO: Custom functions need to be implemented through the registry
      // For now, we'll store them in env
      (ctx as any).customFunctions = evalContext.customFunctions;
    }
    
    return ctx;
  }
}