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
  TypeOrIdentifierNode,
  MembershipTestNode,
  TypeCastNode,
  QuantityNode
} from './types';
import { NodeType } from './types';
import { Registry } from './registry';
import * as operations from './operations';
import type { EvaluationResult, FunctionEvaluator, NodeEvaluator, OperationEvaluator, RuntimeContext } from './types';
import { createQuantity } from './quantity-value';
import { box, unbox, ensureBoxed, type FHIRPathValue } from './boxing';
import { Errors } from './errors';
import { detectChoiceValues, getPrimitiveElement, maybeParseTemporal, reboxResource } from './navigator';

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
      [NodeType.TypeOrIdentifier]: this.evaluateTypeOrIdentifier.bind(this),
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
      const { parseTemporalLiteral } = await import('./temporal');
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
      typeInfo = Number.isInteger(value) ? 
        { type: 'Integer', singleton: true } : 
        { type: 'Decimal', singleton: true };
    } else if (typeof value === 'boolean') {
      typeInfo = { type: 'Boolean', singleton: true };
    }
    
    return {
      value: [box(value, typeInfo)],
      context
    };
  }

  // Identifier node evaluator
  private async evaluateIdentifier(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const identifier = node as IdentifierNode;
    const name = identifier.name;

    const results: FHIRPathValue[] = [];
    const nodeTypeInfo = node.typeInfo;

    for (const boxedItem of input) {
      const item = unbox(boxedItem);

      if (name === 'extension' && boxedItem.primitiveElement?.extension) {
        for (const ext of boxedItem.primitiveElement.extension) {
          results.push(box(ext, nodeTypeInfo || { type: 'Any', singleton: false }));
        }
        continue;
      }

      if (item && typeof item === 'object') {
        const choiceHits = await detectChoiceValues(item as Record<string, unknown>, name, context.modelProvider);
        if (choiceHits.length > 0) {
          for (const hit of choiceHits) {
            results.push(box(hit.value, hit.typeInfo, hit.primitiveElement));
          }
          continue;
        }

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

        if (name in (item as any)) {
          const value = (item as any)[name];
          const primitiveElement = getPrimitiveElement(item as Record<string, unknown>, name);

          if (Array.isArray(value)) {
            const elementTypeInfo = nodeTypeInfo ? { ...nodeTypeInfo, singleton: true } : undefined;
            for (const v of value) {
              if (
                v && typeof v === 'object' && 'resourceType' in (v as any) && typeof (v as any).resourceType === 'string' &&
                (!elementTypeInfo || elementTypeInfo.type === 'Any' || (elementTypeInfo as any).type === 'Resource')
              ) {
                results.push(await reboxResource(v, true, context.modelProvider));
              } else {
                const val = await maybeParseTemporal(v, elementTypeInfo, context.modelProvider);
                results.push(box(val, elementTypeInfo, primitiveElement));
              }
            }
          } else if (value !== null && value !== undefined) {
            if (
              value && typeof value === 'object' && 'resourceType' in (value as any) && typeof (value as any).resourceType === 'string' &&
              (!nodeTypeInfo || nodeTypeInfo.type === 'Any' || (nodeTypeInfo as any).type === 'Resource')
            ) {
              results.push(await reboxResource(value, !Array.isArray(value), context.modelProvider));
            } else {
              const val = await maybeParseTemporal(value, nodeTypeInfo, context.modelProvider);
              results.push(box(val, nodeTypeInfo, primitiveElement));
            }
          }
        }
      }
    }

    return { value: results, context };
  }

  // TypeOrIdentifier node evaluator (handles Patient, Observation, etc.)
  private async evaluateTypeOrIdentifier(node: ASTNode, input: FHIRPathValue[], context: RuntimeContext): Promise<EvaluationResult> {
    const typeOrId = node as TypeOrIdentifierNode;
    const name = typeOrId.name;

    // First try as type filter
    const filtered: FHIRPathValue[] = [];
    for (const boxedItem of input) {
      const item = unbox(boxedItem);
      if (item && typeof item === 'object' && item.resourceType === name) {
        // Re-box with proper type info if we have a model provider
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

    // Otherwise treat as identifier
    return await this.evaluateIdentifier(node, input, context);
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
      // Evaluate operands in parallel using same input/context
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
