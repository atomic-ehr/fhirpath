import type {
  ASTNode,
  LiteralNode,
  IdentifierNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  VariableNode,
  CollectionNode,
  IndexNode,
  MembershipTestNode,
  TypeCastNode,
  QuantityNode
} from './types';
import { NodeType } from './types';
import { Registry } from './registry';
import * as operations from './operations';
import type { EvaluationResult, FunctionEvaluator, NodeEvaluator, OperationEvaluator, RuntimeContext, TypeInfo } from './types';
import { createQuantity } from './complex-types/quantity-value';
import { box, unbox, ensureBoxed, type FHIRPathValue } from './interpreter/boxing';
import { Errors } from './errors';
import { detectChoiceValues, getPrimitiveElement, maybeParseTemporal, reboxResource } from './interpreter/navigator';
import { RuntimeContextManager } from './interpreter/runtime-context';
import { Analyzer } from './analyzer';
import { DiagnosticSeverity } from './types';
import { FHIRPathError, ErrorCodes } from './errors';
import { toTemporalString } from './complex-types/temporal';

/**
 * Runtime context manager that provides efficient prototype-based context operations
 * for both interpreter and compiler.
 */
// RuntimeContextManager moved to './runtime-context'

export class Interpreter {
  private registry: Registry;
  private nodeEvaluators: Record<NodeType, NodeEvaluator>;
  private operationEvaluators: Map<string, OperationEvaluator>;
  private functionEvaluators: Map<string, FunctionEvaluator>;
  private modelProvider?: import('./types').ModelProvider<any>;

  constructor(registry?: Registry, modelProvider?: import('./types').ModelProvider<any>) {
    this.registry = registry || new Registry();
    this.modelProvider = modelProvider;
    this.operationEvaluators = new Map();
    this.functionEvaluators = new Map();
    
    // Initialize node evaluators using object dispatch pattern
    this.nodeEvaluators = {
      [NodeType.Literal]: this.evaluateLiteral.bind(this),
      [NodeType.TemporalLiteral]: this.evaluateTemporalLiteral.bind(this),
      [NodeType.Identifier]: this.evaluateIdentifier.bind(this),
      [NodeType.Binary]: this.evaluateBinary.bind(this),
      [NodeType.Unary]: this.evaluateUnary.bind(this),
      [NodeType.Function]: this.evaluateFunction.bind(this),
      [NodeType.Variable]: this.evaluateVariable.bind(this),
      [NodeType.Collection]: this.evaluateCollection.bind(this),
      [NodeType.Index]: this.evaluateIndex.bind(this),
      [NodeType.MembershipTest]: this.evaluateMembershipTest.bind(this),
      [NodeType.TypeCast]: this.evaluateTypeCast.bind(this),
      [NodeType.Quantity]: this.evaluateQuantity.bind(this),
      [NodeType.EOF]: async () => ({ value: [], context: {} as RuntimeContext }),
      [NodeType.TypeReference]: async () => ({ value: [], context: {} as RuntimeContext })
    };

    // Register operation evaluators
    this.registerOperationEvaluators();
  }

  private registerOperationEvaluators(): void {
    // Register evaluators from operations modules
    for (const [name, operation] of Object.entries(operations)) {
      if (typeof operation === 'object' && 'evaluate' in operation) {
        if ('symbol' in operation) {
          // It's an operator
          // Skip unary operators here - they're handled differently
          if (name === 'unaryMinusOperator' || name === 'unaryPlusOperator') {
            continue;
          }
          this.operationEvaluators.set(operation.symbol, operation.evaluate);
        } else if ('signatures' in operation && !('symbol' in operation)) {
          // It's a function
          this.functionEvaluators.set(operation.name, operation.evaluate);
        }
      }
    }
  }

  // Main evaluate method
  async evaluate(node: ASTNode, input: any[] = [], context?: RuntimeContext): Promise<EvaluationResult> {
    // Initialize context if not provided
    if (!context) {
      context = this.createInitialContext(input);
    }

    // Ensure input is always an array
    if (!Array.isArray(input)) {
      input = input === null || input === undefined ? [] : [input];
    }

    // Box the initial input values
    const boxedInput = input.map(value => ensureBoxed(value));

    // Set current node in context
    const contextWithNode = RuntimeContextManager.copy(context);
    contextWithNode.currentNode = node;

    // Dispatch to appropriate evaluator
    const evaluator = this.nodeEvaluators[node.type];
    if (!evaluator) {
      throw Errors.unknownNodeType(node.type);
    }

    return await evaluator(node, boxedInput, contextWithNode);
  }

  private createInitialContext(input: any[]): RuntimeContext {
    const context = RuntimeContextManager.create(input);
    // Set $this to initial input
    context.variables['$this'] = input;
    // Add model provider if available
    if (this.modelProvider) {
      context.modelProvider = this.modelProvider;
    }
    return context;
  }

  /**
   * Parse, analyze and evaluate a FHIRPath expression with optional
   * model provider, variables and input type. Returns unboxed values
   * with temporal values formatted as FHIRPath literals.
   */
  async evaluateExpression(
    expression: string,
    options: {
      input?: unknown;
      variables?: Record<string, unknown>;
      inputType?: TypeInfo;
      modelProvider?: import('./types').ModelProvider;
      now?: Date;
    } = {}
  ): Promise<any[]> {
    // Analyze expression first (ensures type info and diagnostics)
    const analysis = await Analyzer.analyzeExpression(expression, {
      variables: options.variables,
      modelProvider: options.modelProvider ?? this.modelProvider,
      inputType: options.inputType,
      errorRecovery: false,
    });

    const errors = analysis.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
    if (errors.length > 0) {
      const first = errors[0]!;
      const code = typeof first.code === 'string' && first.code.length > 0 ? first.code : ErrorCodes.INVALID_OPERATION;
      throw new FHIRPathError(code, first.message, first.range);
    }

    // Bootstrap runtime context and boxed input
    const { context, input } = await RuntimeContextManager.bootstrapContext(options.input, {
      modelProvider: options.modelProvider ?? this.modelProvider,
      variables: options.variables,
      now: options.now,
    });

    // Evaluate using analyzed AST and BOXED input
    const result = await this.evaluate(analysis.ast, input as any[], context);

    // Unbox and format temporal outputs for API parity
    return result.value.map((boxedValue) => {
      const value = unbox(boxedValue);
      if (value && typeof value === 'object' && 'kind' in value) {
        if ((value as any).kind === 'FHIRDate' || (value as any).kind === 'FHIRDateTime') {
          return '@' + toTemporalString(value as any);
        } else if ((value as any).kind === 'FHIRTime') {
          return '@T' + toTemporalString(value as any);
        }
      }
      return value;
    });
  }

  // Helper: classify a boolean operand for short-circuit decisions
  private getBooleanKind(values: FHIRPathValue[]): 'empty' | 'true' | 'false' | 'other' {
    if (values.length === 0) {
      return 'empty';
    }
    const v = unbox(values[0]!);
    if (v === true) {
      return 'true';
    }
    if (v === false) {
      return 'false';
    }
    return 'other';
  }

  private boxBoolean(b: boolean): FHIRPathValue {
    return box(b, { type: 'Boolean', singleton: true });
  }

  // TemporalLiteral node evaluator
  private async evaluateTemporalLiteral(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const temporal = node as import('./types').TemporalLiteralNode;
    
    // The value is already parsed in the parser
    let typeInfo: import('./types').TypeInfo;
    
    if (temporal.valueType === 'date') {
      typeInfo = { type: 'Date', singleton: true };
    } else if (temporal.valueType === 'datetime') {
      typeInfo = { type: 'DateTime', singleton: true };
    } else {
      typeInfo = { type: 'Time', singleton: true };
    }
    
    return {
      value: [box(temporal.value, typeInfo)],
      context
    };
  }

  // Literal node evaluator
  private async evaluateLiteral(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const literal = node as LiteralNode;
    
    // Box the literal value with appropriate type info
    let typeInfo: import('./types').TypeInfo | undefined;
    let value: any = literal.value;
    
    // Handle temporal literals (backwards compatibility - should not reach here with new parser)
    if (literal.valueType === 'date' || literal.valueType === 'datetime' || literal.valueType === 'time') {
      // Import temporal parsing function
      const { parseTemporalLiteral } = await import('./complex-types/temporal');
      // Parse the temporal literal (add @ back since it was stripped by parser)
      const temporalValue = parseTemporalLiteral('@' + literal.value);
      
      // Set appropriate type info
      if (literal.valueType === 'date') {
        typeInfo = { type: 'Date', singleton: true };
      } else if (literal.valueType === 'datetime') {
        typeInfo = { type: 'DateTime', singleton: true };
      } else if (literal.valueType === 'time') {
        typeInfo = { type: 'Time', singleton: true };
      }
      
      value = temporalValue;
    } else if (typeof value === 'string') {
      typeInfo = { type: 'String', singleton: true };
    } else if (typeof value === 'number') {
      // Use the valueType from the literal node to determine if it's integer or decimal
      // This preserves the distinction between 1.0 (decimal) and 1 (integer)
      typeInfo = literal.valueType === 'decimal' ? 
        { type: 'Decimal', singleton: true } : 
        { type: 'Integer', singleton: true };
    } else if (typeof value === 'boolean') {
      typeInfo = { type: 'Boolean', singleton: true };
    }
    
    return {
      value: [box(value, typeInfo)],
      context
    };
  }

  // Helper: Handle extension elements
  private handleExtension(
    boxedItem: FHIRPathValue, 
    nodeTypeInfo?: TypeInfo
  ): FHIRPathValue[] {
    const results: FHIRPathValue[] = [];
    if (boxedItem.primitiveElement?.extension) {
      for (const ext of boxedItem.primitiveElement.extension) {
        results.push(box(ext, nodeTypeInfo || { type: 'Any', singleton: false }));
      }
    }
    return results;
  }

  // Helper: Handle FHIR choice types (e.g., value[x])
  private async handleChoiceTypes(
    item: object,
    name: string,
    context: RuntimeContext
  ): Promise<FHIRPathValue[]> {
    const results: FHIRPathValue[] = [];
    const choiceHits = await detectChoiceValues(item as Record<string, unknown>, name, context.modelProvider);
    for (const hit of choiceHits) {
      results.push(box(hit.value, hit.typeInfo, hit.primitiveElement));
    }
    return results;
  }

  // Helper: Handle union type choices
  private handleUnionChoices(
    item: object,
    nodeTypeInfo?: TypeInfo
  ): FHIRPathValue[] {
    const results: FHIRPathValue[] = [];
    if (
      nodeTypeInfo?.modelContext &&
      typeof nodeTypeInfo.modelContext === 'object' &&
      'isUnion' in nodeTypeInfo.modelContext &&
      (nodeTypeInfo.modelContext as any).isUnion &&
      'choices' in nodeTypeInfo.modelContext &&
      Array.isArray((nodeTypeInfo.modelContext as any).choices)
    ) {
      for (const choice of (nodeTypeInfo.modelContext as any).choices) {
        const choiceName = choice.choiceName;
        if (choiceName && choiceName in (item as any)) {
          const value = (item as any)[choiceName];
          const primitiveElement = getPrimitiveElement(item as Record<string, unknown>, choiceName);
          const choiceTypeInfo = { type: choice.type, singleton: !Array.isArray(value), modelContext: choice } as any;
          if (Array.isArray(value)) {
            for (const v of value) {
              results.push(box(v, { ...choiceTypeInfo, singleton: true }, primitiveElement));
            }
          } else if (value !== null && value !== undefined) {
            results.push(box(value, choiceTypeInfo, primitiveElement));
          }
        }
      }
    }
    return results;
  }

  // Helper: Handle standard property access
  private async handleStandardProperty(
    item: object,
    name: string,
    nodeTypeInfo: TypeInfo | undefined,
    context: RuntimeContext
  ): Promise<FHIRPathValue[]> {
    const results: FHIRPathValue[] = [];
    if (name in (item as any)) {
      const value = (item as any)[name];
      const primitiveElement = getPrimitiveElement(item as Record<string, unknown>, name);

      if (Array.isArray(value)) {
        const elementTypeInfo = nodeTypeInfo ? { ...nodeTypeInfo, singleton: true } : undefined;
        for (const v of value) {
          if (
            v && typeof v === 'object' && 'resourceType' in (v as any) && typeof (v as any).resourceType === 'string'
          ) {
            // Always re-box FHIR resources to get proper type information from ModelProvider
            const boxed = await reboxResource(v, true, context.modelProvider);
            results.push(boxed);
          } else {
            const val = await maybeParseTemporal(v, elementTypeInfo, context.modelProvider);
            results.push(box(val, elementTypeInfo, primitiveElement));
          }
        }
      } else if (value !== null && value !== undefined) {
        if (
          value && typeof value === 'object' && 'resourceType' in (value as any) && typeof (value as any).resourceType === 'string'
        ) {
          // Always re-box FHIR resources to get proper type information from ModelProvider
          const boxed = await reboxResource(value, true, context.modelProvider);
          results.push(boxed);
        } else {
          const val = await maybeParseTemporal(value, nodeTypeInfo, context.modelProvider);
          results.push(box(val, nodeTypeInfo, primitiveElement));
        }
      }
    }
    return results;
  }

  // Identifier node evaluator
  private async evaluateIdentifier(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const identifier = node as IdentifierNode;
    const name = identifier.name;
    const nodeTypeInfo = node.typeInfo;
    const results: FHIRPathValue[] = [];

    for (const boxedItem of input) {
      const item = unbox(boxedItem);

      // 1. Handle extension special case
      if (name === 'extension') {
        results.push(...this.handleExtension(boxedItem, nodeTypeInfo));
        continue;
      }

      // Process only objects
      if (item && typeof item === 'object') {
        // 2. Handle FHIR choice types (e.g., value[x])
        const choiceResults = await this.handleChoiceTypes(item, name, context);
        if (choiceResults.length > 0) {
          results.push(...choiceResults);
          continue;
        }

        // 3. Handle union type choices
        const unionResults = this.handleUnionChoices(item, nodeTypeInfo);
        results.push(...unionResults);

        // 4. Handle standard property access
        const propertyResults = await this.handleStandardProperty(item, name, nodeTypeInfo, context);
        results.push(...propertyResults);
      }
    }

    // If no properties matched, try type-filter fallback on resources
    if (results.length === 0) {
      const filtered: FHIRPathValue[] = [];
      for (const boxedItem of input) {
        const item = unbox(boxedItem);
        if (item && typeof item === 'object' && (item as any).resourceType === name) {
          if (context.modelProvider) {
            const typeInfo = await context.modelProvider.getType(name);
            if (typeInfo) {
              filtered.push(box(item, { ...typeInfo, singleton: true }));
            } else {
              filtered.push(boxedItem);
            }
          } else {
            filtered.push(boxedItem);
          }
        }
      }
      if (filtered.length > 0) {
        return { value: filtered, context };
      }
    }

    return { value: results, context };
  }

  // Binary operator evaluator
  private async evaluateBinary(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const binary = node as BinaryNode;
    const operator = binary.operator;

    // Special handling for dot operator (sequential pipeline)
    if (operator === '.') {
      // Evaluate left with current input/context
      const leftResult = await this.evaluate(binary.left, input, context);
      
      // Use left's output as right's input, and left's context flows to right
      return await this.evaluate(binary.right, leftResult.value, leftResult.context);
    }

    // Special handling for union operator (each side gets fresh context from original)
    if (operator === '|') {
      // Each side of union should have its own variable scope
      // Variables defined on left side should not be visible on right side
      // Evaluate both sides in parallel since both use the same input/context
      const [leftResult, rightResult] = await Promise.all([
        this.evaluate(binary.left, input, context),
        this.evaluate(binary.right, input, context)
      ]);
      
      // Merge the results
      const unionEvaluator = this.operationEvaluators.get('|');
      if (unionEvaluator) {
        return await unionEvaluator(input, context, leftResult.value, rightResult.value);
      }
      // If union evaluator not found, surface a clear error
      throw Errors.noEvaluatorFound('binary operator', '|');
    }

    // Get operation evaluator
    const evaluator = this.operationEvaluators.get(operator);
    if (evaluator) {
      // Short-circuit for logical operators when possible
      if (operator === 'and' || operator === 'or' || operator === 'implies') {
        const leftResult = await this.evaluate(binary.left, input, context);
        const kind = this.getBooleanKind(leftResult.value);

        if (operator === 'and') {
          // false and _ -> false (short-circuit)
          if (kind === 'false') {
            return { value: [this.boxBoolean(false)], context };
          }
          // true and y -> y; empty and false -> false handled by evaluator; need right
          const rightResult = await this.evaluate(binary.right, input, context);
          const operatorDef = this.registry.getOperatorDefinition(operator);
          if (operatorDef && !operatorDef.doesNotPropagateEmpty) {
            if (leftResult.value.length === 0 || rightResult.value.length === 0) {
              return { value: [], context };
            }
          }
          return await evaluator(input, context, leftResult.value, rightResult.value);
        }

        if (operator === 'or') {
          // true or _ -> true (short-circuit)
          if (kind === 'true') {
            return { value: [this.boxBoolean(true)], context };
          }
          // false or y -> y; empty or true -> true handled by evaluator; need right
          const rightResult = await this.evaluate(binary.right, input, context);
          const operatorDef = this.registry.getOperatorDefinition(operator);
          if (operatorDef && !operatorDef.doesNotPropagateEmpty) {
            if (leftResult.value.length === 0 || rightResult.value.length === 0) {
              return { value: [], context };
            }
          }
          return await evaluator(input, context, leftResult.value, rightResult.value);
        }

        if (operator === 'implies') {
          // false implies _ -> true (short-circuit)
          if (kind === 'false') {
            return { value: [this.boxBoolean(true)], context };
          }
          // true implies y -> y; empty implies y -> true if y true else empty; need right
          const rightResult = await this.evaluate(binary.right, input, context);
          const operatorDef = this.registry.getOperatorDefinition(operator);
          if (operatorDef && !operatorDef.doesNotPropagateEmpty) {
            if (leftResult.value.length === 0 || rightResult.value.length === 0) {
              return { value: [], context };
            }
          }
          return await evaluator(input, context, leftResult.value, rightResult.value);
        }
      }

      // Default path: evaluate both operands in parallel
      const [leftResult, rightResult] = await Promise.all([
        this.evaluate(binary.left, input, context),
        this.evaluate(binary.right, input, context)
      ]);

      // Handle empty propagation for operators
      // Rely exclusively on registry metadata
      const operatorDef = this.registry.getOperatorDefinition(operator);
      if (operatorDef && !operatorDef.doesNotPropagateEmpty) {
        // Check if either operand is empty
        if (leftResult.value.length === 0 || rightResult.value.length === 0) {
          return { value: [], context };
        }
      }

      return await evaluator(input, context, leftResult.value, rightResult.value);
    }

    // If no evaluator found, throw error
    throw Errors.noEvaluatorFound('binary operator', operator);
  }

  // Unary operator evaluator
  private async evaluateUnary(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const unary = node as UnaryNode;
    const operator = unary.operator;
    
    const operandResult = await this.evaluate(unary.operand, input, context);

    // Check for unary operation evaluators
    let evaluator: OperationEvaluator | undefined;
    if (operator === '-' && operations.unaryMinusOperator?.evaluate) {
      evaluator = operations.unaryMinusOperator.evaluate;
    } else if (operator === '+' && operations.unaryPlusOperator?.evaluate) {
      evaluator = operations.unaryPlusOperator.evaluate;
    }

    if (evaluator) {
      return await evaluator(input, context, operandResult.value);
    }

    // If no evaluator found, throw error
    throw Errors.noEvaluatorFound('unary operator', operator);
  }

  // Variable evaluator
  private async evaluateVariable(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const variable = node as VariableNode;
    const name = variable.name;

    const value = RuntimeContextManager.getVariable(context, name);
    
    if (value !== undefined) {
      // Ensure value is always an array
      const arrayValue = Array.isArray(value) ? value : [value];
      // Box each value in the array
      const boxedValues = arrayValue.map(v => ensureBoxed(v));
      return { value: boxedValues, context };
    }

    // According to FHIRPath spec: attempting to access an undefined environment variable will result in an error
    throw Errors.variableNotDefined(name);
  }

  // Collection evaluator
  private async evaluateCollection(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const collection = node as CollectionNode;
    const results: FHIRPathValue[] = [];

    for (const element of collection.elements) {
      const result = await this.evaluate(element, input, context);
      results.push(...result.value);
    }

    return { value: results, context };
  }

  // Function evaluator
  private async evaluateFunction(node: ASTNode, input: any[], context: RuntimeContext): Promise<EvaluationResult> {
    const func = node as FunctionNode;
    const funcName = (func.name as IdentifierNode).name;

    // Get the function definition to check if it propagates empty
    const functionDef = this.registry.getFunction(funcName);
    
    // Check if function is registered with an evaluator
    const functionEvaluator = this.functionEvaluators.get(funcName);
    if (!functionEvaluator) {
      // No function found in registry
      throw Errors.unknownFunction(funcName);
    }
    // Helper: pick a matching signature based on argument count
    const pickSignature = () => {
      if (!functionDef?.signatures || functionDef.signatures.length === 0) {
        return undefined as import('./types').FunctionSignature | undefined;
      }
      const argsCount = func.arguments.length;
      for (const sig of functionDef.signatures) {
        const total = sig.parameters.length;
        const required = sig.parameters.filter(p => !p.optional).length;
        if (argsCount >= required && argsCount <= total) {
          return sig;
        }
      }
      // Fallback to first signature
      return functionDef.signatures[0];
    };

    const signature = pickSignature();

    // Memoized evaluator to avoid duplicate evaluation of arguments
    // Only memoize when both input and context references are identical to this call's input/context.
    const originalInputRef = input;
    const originalContextRef = context;
    const cache = new WeakMap<ASTNode, Promise<EvaluationResult>>();
    const memoEval = async (n: ASTNode, inVals: any[], ctx: RuntimeContext) => {
      if (inVals === originalInputRef && ctx === originalContextRef) {
        const cached = cache.get(n);
        if (cached) {
          return cached;
        }
        const promise = this.evaluate(n, inVals, ctx);
        cache.set(n, promise);
        return promise;
      }
      // Different input or context – do not reuse cached result
      return this.evaluate(n, inVals, ctx);
    };

    // Handle empty propagation centrally (default: propagate)
    if (functionDef && !functionDef.doesNotPropagateEmpty) {
      // If input is empty, propagate empty immediately
      if (input.length === 0) {
        return { value: [], context };
      }

      // Evaluate non-expression, non-typeReference arguments once for emptiness
      for (let i = 0; i < func.arguments.length; i++) {
        const arg = func.arguments[i];
        const param = signature?.parameters[i];
        if (!arg || !param) {
          continue;
        }
        // Skip expression or typeReference params (not evaluated here)
        if (param.expression || param.typeReference) {
          continue;
        }
        // Evaluate with memoization
        const argResult = await memoEval(arg, input, context);
        // If argument is empty and it's a required parameter, propagate empty
        const isRequired = !param.optional;
        if (isRequired && argResult.value.length === 0) {
          return { value: [], context };
        }
      }
    }

    // Call the function evaluator with memoized evaluator
    return await functionEvaluator(input, context, func.arguments, memoEval);
  }

  // Index evaluator
  private async evaluateIndex(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const indexNode = node as IndexNode;
    const exprResult = await this.evaluate(indexNode.expression, input, context);
    const indexResult = await this.evaluate(indexNode.index, input, context);

    if (indexResult.value.length === 0 || exprResult.value.length === 0) {
      return { value: [], context };
    }

    const boxedIndex = indexResult.value[0];
    if (boxedIndex) {
      const index = unbox(boxedIndex);
      if (typeof index === 'number' && index >= 0 && index < exprResult.value.length) {
        const result = exprResult.value[index];
        return { value: result ? [result] : [], context };
      }
    }

    return { value: [], context };
  }

  // Type membership test (is operator)
  private async evaluateMembershipTest(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const test = node as MembershipTestNode;
    const exprResult = await this.evaluate(test.expression, input, context);
    
    // Use the is-operator implementation for consistency
    const isOperator = this.operationEvaluators.get('is');
    if (isOperator) {
      return isOperator(input, context, exprResult.value, [test.targetType]);
    }
    
    // Fallback - shouldn't reach here normally
    return { value: [], context };
  }

  // Type cast (as operator)
  private async evaluateTypeCast(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const cast = node as TypeCastNode;
    const exprResult = await this.evaluate(cast.expression, input, context);
    
    // Use the as-operator implementation for consistency
    const asOperator = this.operationEvaluators.get('as');
    if (asOperator) {
      return asOperator(input, context, exprResult.value, [cast.targetType]);
    }
    
    // Fallback implementation (shouldn't normally reach here)
    return { value: [], context };
  }
  
  private async evaluateQuantity(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const quantity = node as QuantityNode;
    const quantityValue = createQuantity(quantity.value, quantity.unit);
    return {
      value: [box(quantityValue, { type: 'Quantity', singleton: true })],
      context
    };
  }
}
