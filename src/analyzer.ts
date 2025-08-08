import type { 
  ASTNode, 
  BinaryNode, 
  IdentifierNode, 
  LiteralNode, 
  FunctionNode, 
  Diagnostic, 
  AnalysisResult, 
  UnaryNode, 
  IndexNode, 
  CollectionNode, 
  MembershipTestNode, 
  TypeCastNode, 
  TypeInfo, 
  ModelProvider,
  VariableNode,
  TypeName,
  TypeOrIdentifierNode,
  ErrorNode
} from './types';
import { NodeType, DiagnosticSeverity } from './types';
import { registry } from './registry';
import { Errors, toDiagnostic } from './errors';


export class Analyzer {
  private diagnostics: Diagnostic[] = [];
  private variables: Set<string> = new Set(['$this', '$index', '$total', 'context', 'resource', 'rootResource']);
  private modelProvider?: ModelProvider;
  private userVariableTypes: Map<string, TypeInfo> = new Map();
  private systemVariableTypes: Map<string, TypeInfo> = new Map();

  constructor(modelProvider?: ModelProvider) {
    this.modelProvider = modelProvider;
  }

  analyze(ast: ASTNode, userVariables?: Record<string, any>, inputType?: TypeInfo): AnalysisResult {
    this.diagnostics = [];
    this.userVariableTypes.clear();
    
    if (userVariables) {
      Object.keys(userVariables).forEach(name => {
        this.variables.add(name);
        // Try to infer types from values
        const value = userVariables[name];
        if (value !== undefined && value !== null) {
          this.userVariableTypes.set(name, this.inferValueType(value));
        }
      });
    }
    
    // Annotate AST with type information
    this.annotateAST(ast, inputType);
    
    // Perform validation with type checking
    this.visitNode(ast);
    
    return {
      diagnostics: this.diagnostics,
      ast
    };
  }

  private visitNode(node: ASTNode): void {
    // Handle error nodes - process them for diagnostics but don't traverse
    if (node.type === 'Error') {
      // Diagnostics already added in annotateAST
      return;
    }
    
    switch (node.type) {
      case NodeType.Binary:
        this.visitBinaryOperator(node as BinaryNode);
        break;
      case NodeType.Identifier:
        this.visitIdentifier(node as IdentifierNode);
        break;
      case NodeType.Function:
        this.visitFunctionCall(node as FunctionNode);
        break;
      case NodeType.Index:
        const indexNode = node as IndexNode;
        this.visitNode(indexNode.expression);
        this.visitNode(indexNode.index);
        break;
      case NodeType.Collection:
        (node as CollectionNode).elements.forEach(el => this.visitNode(el));
        break;
      case NodeType.Unary:
        this.visitNode((node as UnaryNode).operand);
        break;
      case NodeType.MembershipTest:
        this.visitMembershipTest(node as MembershipTestNode);
        break;
      case NodeType.TypeCast:
        this.visitTypeCast(node as TypeCastNode);
        break;
      case NodeType.Variable:
        this.validateVariable((node as VariableNode).name, node);
        break;
      case NodeType.Literal:
      case NodeType.TypeOrIdentifier:
      case NodeType.TypeReference:
        // These are always valid
        break;
    }
  }

  private visitBinaryOperator(node: BinaryNode): void {
    this.visitNode(node.left);
    
    // Track defineVariable for validation - collect all variables defined in the chain
    if (node.operator === '.') {
      const definedVars = this.collectDefinedVariables(node.left);
      if (definedVars.size > 0) {
        // Track which variables were already known
        const previouslyKnown = new Set<string>();
        definedVars.forEach(varName => {
          if (this.variables.has(varName)) {
            previouslyKnown.add(varName);
          }
          this.variables.add(varName);
        });
        
        // Visit right side with new variables in scope
        this.visitNode(node.right);
        
        // Restore previous state
        definedVars.forEach(varName => {
          if (!previouslyKnown.has(varName)) {
            this.variables.delete(varName);
          }
        });
        return;
      }
    }
    
    // Special handling for dot operator with function on right side
    if (node.operator === '.' && node.right.type === NodeType.Function) {
      const funcNode = node.right as FunctionNode;
      if (funcNode.name.type === NodeType.Identifier) {
        const funcName = (funcNode.name as IdentifierNode).name;
        const func = registry.getFunction(funcName);
        if (func && func.signature.input && node.left.typeInfo) {
          if (!this.isTypeCompatible(node.left.typeInfo, func.signature.input)) {
            const inputTypeStr = this.typeToString(node.left.typeInfo);
            const expectedTypeStr = this.typeToString(func.signature.input);
            
            // Check if this is specifically a singleton/collection mismatch
            const inputIsCollection = !node.left.typeInfo.singleton;
            const expectedIsSingleton = func.signature.input.singleton;
            
            // Check if the base types are compatible (same type or subtype)
            const typesCompatible = node.left.typeInfo.type === func.signature.input.type ||
                                   this.isSubtypeOf(node.left.typeInfo.type, func.signature.input.type);
            
            if (inputIsCollection && expectedIsSingleton && typesCompatible) {
              // Compatible base types but collection vs singleton mismatch
              this.diagnostics.push(
                toDiagnostic(Errors.singletonTypeRequired(funcName, inputTypeStr, funcNode.range))
              );
            } else {
              // General type mismatch
              this.diagnostics.push(
                toDiagnostic(Errors.typeNotAssignable(inputTypeStr, expectedTypeStr, funcNode.range))
              );
            }
          }
        }
      }
    }
    
    this.visitNode(node.right);
    
    // For dot operator, we don't need to check operator types
    if (node.operator === '.') {
      return;
    }
    
    const op = registry.getOperatorDefinition(node.operator);
    if (!op) {
      this.diagnostics.push(
        toDiagnostic(Errors.unknownOperator(node.operator, node.range))
      );
      return;
    }
    
    // Type check if we have type information
    if (node.left.typeInfo && node.right.typeInfo) {
      this.checkBinaryOperatorTypes(node, op);
    }
  }

  private visitIdentifier(node: IdentifierNode): void {
    this.validateVariable(node.name, node);
  }

  private visitFunctionCall(node: FunctionNode): void {
    if (node.name.type === NodeType.Identifier) {
      const funcName = (node.name as IdentifierNode).name;
      
      // Check if this is a type operation that requires ModelProvider
      if (funcName === 'ofType' && !this.modelProvider) {
        // Check if the type argument is a primitive type
        const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
        let isPrimitive = false;
        
        if (node.arguments.length > 0) {
          const typeArg = node.arguments[0]!;
          if (typeArg.type === NodeType.Identifier) {
            isPrimitive = primitiveTypes.includes((typeArg as IdentifierNode).name);
          } else if ((typeArg as any).type === NodeType.TypeOrIdentifier || (typeArg as any).type === NodeType.TypeReference) {
            isPrimitive = primitiveTypes.includes((typeArg as any).name);
          }
        }
        
        if (!isPrimitive) {
          this.diagnostics.push(
            toDiagnostic(Errors.modelProviderRequired('ofType', node.range))
          );
        }
      }
      
      // Check ofType with union types
      if (funcName === 'ofType' && node.typeInfo) {
        const inputType = node.typeInfo;
        if (node.arguments.length > 0 && inputType.modelContext && 
            typeof inputType.modelContext === 'object' &&
            'isUnion' in inputType.modelContext && 
            inputType.modelContext.isUnion &&
            'choices' in inputType.modelContext &&
            Array.isArray(inputType.modelContext.choices)) {
          
          // Extract target type from argument
          let targetType: string | undefined;
          const typeArg = node.arguments[0]!;
          if (typeArg.type === NodeType.Identifier) {
            targetType = (typeArg as IdentifierNode).name;
          } else if ((typeArg as any).type === NodeType.TypeOrIdentifier || (typeArg as any).type === NodeType.TypeReference) {
            targetType = (typeArg as any).name;
          }
          
          if (targetType) {
            const validChoice = inputType.modelContext.choices.find((choice: any) => 
              choice.type === targetType || choice.code === targetType
            );
            
            if (!validChoice) {
              this.diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                code: 'invalid-type-filter',
                message: `Type '${targetType}' is not present in the union type. Available types: ${
                  inputType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
                }`,
                range: node.range
              });
            }
          }
        }
      }
      
      const func = registry.getFunction(funcName);
      
      if (!func) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownFunction(funcName, node.range))
        );
      } else {
        // Check argument count based on signature
        const params = func.signature.parameters;
        const requiredParams = params.filter(p => !p.optional).length;
        const maxParams = params.length;
        
        if (node.arguments.length < requiredParams) {
          this.diagnostics.push(
            toDiagnostic(Errors.wrongArgumentCount(funcName, requiredParams, node.arguments.length, node.range))
          );
        } else if (node.arguments.length > maxParams) {
          this.diagnostics.push(
            toDiagnostic(Errors.wrongArgumentCount(funcName, maxParams, node.arguments.length, node.range))
          );
        }
        
        // Type check arguments if we have type information
        if (node.typeInfo || node.arguments.some(arg => arg.typeInfo)) {
          this.checkFunctionArgumentTypes(node, func);
        }
      }
    }
    
    node.arguments.forEach(arg => this.visitNode(arg));
  }

  private visitMembershipTest(node: MembershipTestNode): void {
    // Check if ModelProvider is required
    // Basic primitive types can be checked without ModelProvider
    const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (!this.modelProvider && !primitiveTypes.includes(node.targetType)) {
      this.diagnostics.push(
        toDiagnostic(Errors.modelProviderRequired('is', node.range))
      );
    }
    
    // Check 'is' with union types
    if (node.expression.typeInfo) {
      const leftType = node.expression.typeInfo;
      if (leftType.modelContext && 
          typeof leftType.modelContext === 'object' &&
          'isUnion' in leftType.modelContext && 
          leftType.modelContext.isUnion &&
          'choices' in leftType.modelContext &&
          Array.isArray(leftType.modelContext.choices)) {
        
        const targetTypeName = node.targetType;
        const validChoice = leftType.modelContext.choices.find((choice: any) =>
          choice.type === targetTypeName || choice.code === targetTypeName
        );
        
        if (!validChoice) {
          this.diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            code: 'invalid-type-test',
            message: `Type test 'is ${targetTypeName}' will always be false. Type '${targetTypeName}' is not in the union. Available types: ${
              leftType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
            }`,
            range: node.range
          });
        }
      }
    }
    
    this.visitNode(node.expression);
  }

  private visitTypeCast(node: TypeCastNode): void {
    // Check if ModelProvider is required
    // Basic primitive types can be checked without ModelProvider
    const primitiveTypes = ['String', 'Integer', 'Decimal', 'Boolean', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (!this.modelProvider && !primitiveTypes.includes(node.targetType)) {
      this.diagnostics.push(
        toDiagnostic(Errors.modelProviderRequired('as', node.range))
      );
    }
    
    // Check 'as' with union types
    if (node.expression.typeInfo) {
      const leftType = node.expression.typeInfo;
      if (leftType.modelContext && 
          typeof leftType.modelContext === 'object' &&
          'isUnion' in leftType.modelContext && 
          leftType.modelContext.isUnion &&
          'choices' in leftType.modelContext &&
          Array.isArray(leftType.modelContext.choices)) {
        
        const targetTypeName = node.targetType;
        const validChoice = leftType.modelContext.choices.find((choice: any) =>
          choice.type === targetTypeName || choice.code === targetTypeName
        );
        
        if (!validChoice) {
          this.diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            code: 'invalid-type-cast',
            message: `Type cast 'as ${targetTypeName}' may fail. Type '${targetTypeName}' is not guaranteed in the union. Available types: ${
              leftType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
            }`,
            range: node.range
          });
        }
      }
    }
    
    this.visitNode(node.expression);
  }

  // Unified variable validation to eliminate duplication
  private validateVariable(name: string, node: ASTNode): void {
    if (name.startsWith('$')) {
      if (!this.variables.has(name)) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownVariable(name, node.range))
        );
      }
    } else if (name.startsWith('%')) {
      const varName = name.substring(1);
      if (!this.variables.has(varName)) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownUserVariable(name, node.range))
        );
      }
    }
  }
  
  private collectDefinedVariables(node: ASTNode): Set<string> {
    const vars = new Set<string>();
    
    // If this is a defineVariable call, extract the variable name
    if (node.type === NodeType.Function) {
      const funcNode = node as FunctionNode;
      if (funcNode.name.type === NodeType.Identifier && 
          (funcNode.name as IdentifierNode).name === 'defineVariable' &&
          funcNode.arguments.length >= 1) {
        const nameArg = funcNode.arguments[0];
        if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
          vars.add(nameArg.value as string);
        }
      }
    }
    
    // If this is a binary dot operator, collect from left side recursively
    if (node.type === NodeType.Binary) {
      const binaryNode = node as BinaryNode;
      if (binaryNode.operator === '.') {
        // Collect from left side
        const leftVars = this.collectDefinedVariables(binaryNode.left);
        leftVars.forEach(v => vars.add(v));
        
        // Check if right side is also defineVariable
        if (binaryNode.right.type === NodeType.Function) {
          const rightFunc = binaryNode.right as FunctionNode;
          if (rightFunc.name.type === NodeType.Identifier && 
              (rightFunc.name as IdentifierNode).name === 'defineVariable' &&
              rightFunc.arguments.length >= 1) {
            const nameArg = rightFunc.arguments[0];
            if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
              vars.add(nameArg.value as string);
            }
          }
        }
      }
    }
    
    return vars;
  }
  
  private collectDefinedVariablesWithTypes(node: ASTNode): Map<string, TypeInfo> {
    const varsWithTypes = new Map<string, TypeInfo>();
    
    // If this is a defineVariable call, extract the variable name and type
    if (node.type === NodeType.Function) {
      const funcNode = node as FunctionNode;
      if (funcNode.name.type === NodeType.Identifier && 
          (funcNode.name as IdentifierNode).name === 'defineVariable' &&
          funcNode.arguments.length >= 1) {
        const nameArg = funcNode.arguments[0];
        if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
          const varName = nameArg.value as string;
          let varType: TypeInfo;
          
          if (funcNode.arguments.length >= 2 && funcNode.arguments[1]!.typeInfo) {
            // Has value expression - use its type
            varType = funcNode.arguments[1]!.typeInfo;
          } else if (node.typeInfo) {
            // No value expression - uses input as value (defineVariable returns input)
            varType = node.typeInfo;
          } else {
            varType = { type: 'Any', singleton: false };
          }
          
          varsWithTypes.set(varName, varType);
        }
      }
    }
    
    // If this is a binary dot operator, collect from entire chain
    if (node.type === NodeType.Binary) {
      const binaryNode = node as BinaryNode;
      if (binaryNode.operator === '.') {
        // Collect from left side recursively
        const leftVars = this.collectDefinedVariablesWithTypes(binaryNode.left);
        leftVars.forEach((type, name) => varsWithTypes.set(name, type));
        
        // Check if right side is also defineVariable
        if (binaryNode.right.type === NodeType.Function) {
          const rightFunc = binaryNode.right as FunctionNode;
          if (rightFunc.name.type === NodeType.Identifier && 
              (rightFunc.name as IdentifierNode).name === 'defineVariable' &&
              rightFunc.arguments.length >= 1) {
            const nameArg = rightFunc.arguments[0];
            if (nameArg && nameArg.type === NodeType.Literal && nameArg.valueType === 'string') {
              const varName = nameArg.value as string;
              let varType: TypeInfo;
              
              if (rightFunc.arguments.length >= 2 && rightFunc.arguments[1]!.typeInfo) {
                varType = rightFunc.arguments[1]!.typeInfo;
              } else if (binaryNode.typeInfo) {
                varType = binaryNode.typeInfo;
              } else {
                varType = { type: 'Any', singleton: false };
              }
              
              varsWithTypes.set(varName, varType);
            }
          }
        }
      }
    }
    
    return varsWithTypes;
  }


  // Type inference methods
  private inferType(node: ASTNode, inputType?: TypeInfo): TypeInfo {
    // Handle error nodes
    if (node.type === 'Error') {
      return this.inferErrorNodeType(node as ErrorNode, inputType);
    }
    
    switch (node.type) {
      case NodeType.Literal:
        return this.inferLiteralType(node as LiteralNode);
        
      case NodeType.Binary:
        return this.inferBinaryType(node as BinaryNode, inputType);
        
      case NodeType.Unary:
        return this.inferUnaryType(node as UnaryNode);
        
      case NodeType.Function:
        return this.inferFunctionType(node as FunctionNode, inputType);
        
      case NodeType.Identifier:
        return this.inferIdentifierType(node as IdentifierNode, inputType);
        
      case NodeType.Variable:
        return this.inferVariableType(node as VariableNode);
        
      case NodeType.Collection:
        return this.inferCollectionType(node as CollectionNode);
        
      case NodeType.TypeCast:
        return this.inferTypeCastType(node as TypeCastNode);
        
      case NodeType.MembershipTest:
        return { type: 'Boolean', singleton: true };
        
      case NodeType.TypeOrIdentifier:
        return this.inferTypeOrIdentifierType(node as TypeOrIdentifierNode, inputType);
        
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  private inferErrorNodeType(errorNode: ErrorNode, inputType?: TypeInfo): TypeInfo {
    // For error nodes, return a generic type that allows partial analysis to continue
    // This enables type checking for valid parts of broken expressions
    return { type: 'Any', singleton: false };
  }
  
  private inferLiteralType(node: LiteralNode): TypeInfo {
    switch (node.valueType) {
      case 'string':
        return { type: 'String', singleton: true };
      case 'number':
        const num = node.value as number;
        return { 
          type: Number.isInteger(num) ? 'Integer' : 'Decimal', 
          singleton: true 
        };
      case 'boolean':
        return { type: 'Boolean', singleton: true };
      case 'date':
        return { type: 'Date', singleton: true };
      case 'datetime':
        return { type: 'DateTime', singleton: true };
      case 'time':
        return { type: 'Time', singleton: true };
      case 'null':
        return { type: 'Any', singleton: false }; // Empty collection
      default:
        return { type: 'Any', singleton: true };
    }
  }
  
  private inferBinaryType(node: BinaryNode, inputType?: TypeInfo): TypeInfo {
    const operator = registry.getOperatorDefinition(node.operator);
    if (!operator) {
      return { type: 'Any', singleton: false };
    }
    
    // For navigation (dot operator), we need special handling
    if (node.operator === '.') {
      return this.inferNavigationType(node, inputType);
    }
    
    // Infer types of operands
    const leftType = this.inferType(node.left, inputType);
    const rightType = this.inferType(node.right, inputType);
    
    // Find matching signature
    for (const sig of operator.signatures) {
      if (this.isTypeCompatible(leftType, sig.left) && 
          this.isTypeCompatible(rightType, sig.right)) {
        return this.resolveResultType(sig.result, inputType, leftType, rightType);
      }
    }
    
    // Default to first signature's result type
    const defaultResult = operator.signatures[0]?.result || { type: 'Any', singleton: false };
    return this.resolveResultType(defaultResult, inputType, leftType, rightType);
  }
  
  private inferNavigationType(node: BinaryNode, inputType?: TypeInfo): TypeInfo {
    const leftType = this.inferType(node.left, inputType);
    
    // If the right side is a function, return the function's type
    if (node.right.type === NodeType.Function) {
      return this.inferType(node.right, leftType);
    }
    
    // If we have a model provider and the right side is an identifier
    if (this.modelProvider && node.right.type === NodeType.Identifier) {
      const propertyName = (node.right as IdentifierNode).name;
      
      // Use getElementType to navigate the property
      const resultType = this.modelProvider.getElementType(leftType, propertyName);
      if (resultType) {
        return resultType;
      }
      
      // If property not found and we have a concrete type from model provider, report error
      // Skip diagnostics for union types - they may have dynamic properties
      if (leftType.namespace && leftType.name && leftType.modelContext && 
          !(leftType.modelContext as any).isUnion) {
        this.diagnostics.push(
          toDiagnostic(Errors.unknownProperty(propertyName, `${leftType.namespace}.${leftType.name}`, node.right.range))
        );
      }
    }
    
    // Default navigation behavior
    return { type: 'Any', singleton: false };
  }
  
  private inferUnaryType(node: UnaryNode): TypeInfo {
    const operator = registry.getOperatorDefinition(node.operator);
    if (!operator) {
      return { type: 'Any', singleton: false };
    }
    
    // Unary operators typically have one signature
    const signature = operator.signatures[0];
    if (signature && typeof signature.result === 'object') {
      return signature.result;
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferFunctionType(node: FunctionNode, inputType?: TypeInfo): TypeInfo {
    if (node.name.type !== NodeType.Identifier) {
      return { type: 'Any', singleton: false };
    }
    
    const funcName = (node.name as IdentifierNode).name;
    const func = registry.getFunction(funcName);
    
    if (!func) {
      return { type: 'Any', singleton: false };
    }
    
    // Special handling for iif function
    if (funcName === 'iif') {
      // iif returns the common type of the true and false branches
      if (node.arguments.length >= 2) {
        const trueBranchType = this.inferType(node.arguments[1]!, inputType);
        if (node.arguments.length >= 3) {
          const falseBranchType = this.inferType(node.arguments[2]!, inputType);
          // If both branches have the same type, use that
          if (trueBranchType.type === falseBranchType.type && 
              trueBranchType.singleton === falseBranchType.singleton) {
            return trueBranchType;
          }
          // If types are the same but singleton differs, return as collection
          if (trueBranchType.type === falseBranchType.type) {
            // One is singleton, one is collection - result must be collection
            return { type: trueBranchType.type, singleton: false };
          }
          // Otherwise, check if one is a subtype of the other
          if (this.isTypeCompatible(trueBranchType, falseBranchType)) {
            return falseBranchType;
          }
          if (this.isTypeCompatible(falseBranchType, trueBranchType)) {
            return trueBranchType;
          }
        } else {
          // Only true branch, result can be that type or empty
          return { ...trueBranchType, singleton: false };
        }
      }
      return { type: 'Any', singleton: false };
    }
    
    // Special handling for defineVariable function
    if (funcName === 'defineVariable') {
      // defineVariable returns its input type unchanged
      return inputType || { type: 'Any', singleton: false };
    }
    
    // Special handling for aggregate function
    if (funcName === 'aggregate') {
      // If init parameter is provided, use its type to infer result type
      if (node.arguments.length >= 2) {
        const initType = this.inferType(node.arguments[1]!, inputType);
        // The result type is the same as init type
        return initType;
      }
      // Without init, we can't fully infer the type without running annotation
      // This is a limitation - the actual type will be set during annotateAST
      if (node.arguments.length >= 1) {
        // We could try to infer, but it would require setting up system variables
        // For now, return Any and let annotateAST handle proper typing
        return { type: 'Any', singleton: false };
      }
      // No arguments at all
      return { type: 'Any', singleton: false };
    }
    
    // Special handling for children function
    if (funcName === 'children') {
      if (inputType && this.modelProvider && 'getChildrenType' in this.modelProvider) {
        const childrenType = this.modelProvider.getChildrenType(inputType);
        if (childrenType) {
          return childrenType;
        }
      }
      // Fallback to Any collection
      return { type: 'Any', singleton: false };
    }
    
    // Special handling for descendants function
    // Returns Any type due to combinatorial explosion of possible types
    if (funcName === 'descendants') {
      return { type: 'Any', singleton: false };
    }
    
    // Special handling for functions with dynamic result types
    if (func.signature.result === 'inputType') {
      // Functions like where() return the same type as input but always as collection
      return inputType ? { ...inputType, singleton: false } : { type: 'Any', singleton: false };
    } else if (func.signature.result === 'inputTypeSingleton') {
      // Functions like first(), last() return the same type as input but as singleton
      return inputType ? { ...inputType, singleton: true } : { type: 'Any', singleton: true };
    } else if (func.signature.result === 'parameterType' && node.arguments.length > 0) {
      // Functions like select() return the type of the first parameter expression as collection
      const paramType = this.inferType(node.arguments[0]!, inputType);
      return { ...paramType, singleton: false };
    } else if (typeof func.signature.result === 'object') {
      return func.signature.result;
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferIdentifierType(node: IdentifierNode, inputType?: TypeInfo): TypeInfo {
    // First, try to navigate from input type (most common case)
    if (inputType && this.modelProvider) {
      const elementType = this.modelProvider.getElementType(inputType, node.name);
      if (elementType) {
        return elementType;
      }
    }
    
    // Only check if it's a type name if it starts with uppercase (FHIR convention)
    // or if there's no input type context
    if (this.modelProvider && (!inputType || /^[A-Z]/.test(node.name))) {
      const typeInfo = this.modelProvider.getType(node.name);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferTypeOrIdentifierType(node: TypeOrIdentifierNode, inputType?: TypeInfo): TypeInfo {
    // TypeOrIdentifier can be either a type name or a property navigation
    
    // First, try navigation from input type (most common case)
    if (inputType && this.modelProvider) {
      const elementType = this.modelProvider.getElementType(inputType, node.name);
      if (elementType) {
        return elementType;
      }
    }
    
    // Then check if it's a type name (only for uppercase names or no input context)
    if (this.modelProvider && (!inputType || /^[A-Z]/.test(node.name))) {
      const typeInfo = this.modelProvider.getType(node.name);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferVariableType(node: VariableNode): TypeInfo {
    // System variables - check temporary context
    if (node.name.startsWith('$')) {
      const systemType = this.systemVariableTypes.get(node.name);
      if (systemType) {
        return systemType;
      }
      // Fallback defaults for system variables
      switch (node.name) {
        case '$this':
          return { type: 'Any', singleton: false };
        case '$index':
          return { type: 'Integer', singleton: true };
        case '$total':
          return { type: 'Any', singleton: false };
        default:
          return { type: 'Any', singleton: false };
      }
    }
    
    // Special FHIRPath environment variables
    if (node.name === '%context' || node.name === '%resource' || node.name === '%rootResource') {
      return { type: 'Any', singleton: false }; // These return the original input
    }
    
    // User-defined variables - check with or without % prefix
    let varName = node.name;
    if (varName.startsWith('%')) {
      varName = varName.substring(1);
    }
    
    const userType = this.userVariableTypes.get(varName);
    if (userType) {
      return userType;
    }
    
    return { type: 'Any', singleton: true };
  }
  
  private inferCollectionType(node: CollectionNode): TypeInfo {
    if (node.elements.length === 0) {
      return { type: 'Any', singleton: false };
    }
    
    // Infer types of all elements
    const elementTypes = node.elements.map(el => this.inferType(el));
    
    // If all elements have the same type, use that
    const firstType = elementTypes[0];
    if (firstType) {
      const allSameType = elementTypes.every(t => 
        t.type === firstType.type && 
        t.namespace === firstType.namespace && 
        t.name === firstType.name
      );
      
      if (allSameType) {
        return { ...firstType, singleton: false };
      }
    }
    
    // Otherwise, it's a heterogeneous collection
    return { type: 'Any', singleton: false };
  }
  
  private inferTypeCastType(node: TypeCastNode): TypeInfo {
    const targetType = node.targetType;
    
    // If we have a model provider, try to get the type info
    if (this.modelProvider) {
      const typeInfo = this.modelProvider.getType(targetType);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    // Otherwise, check if it's a FHIRPath primitive type
    const fhirPathTypes = ['String', 'Boolean', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (fhirPathTypes.includes(targetType)) {
      return { type: targetType as TypeName, singleton: true };
    }
    
    return { type: 'Any', singleton: true };
  }
  
  private isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean {
    // Exact match
    if (source.type === target.type && source.singleton === target.singleton) {
      return true;
    }
    
    // Any is compatible with everything
    if (source.type === 'Any' || target.type === 'Any') {
      return true;
    }
    
    // Singleton can be promoted to collection
    if (source.singleton && !target.singleton && source.type === target.type) {
      return true;
    }
    
    // Type hierarchy compatibility
    if (this.isSubtypeOf(source.type, target.type)) {
      // Check singleton compatibility
      if (source.singleton === target.singleton || (source.singleton && !target.singleton)) {
        return true;
      }
    }
    
    // Numeric type compatibility
    if (this.isNumericType(source.type) && this.isNumericType(target.type)) {
      // Integer can be used where Decimal is expected
      if (source.type === 'Integer' && target.type === 'Decimal') {
        return source.singleton !== undefined && target.singleton !== undefined && 
               (source.singleton === target.singleton || (source.singleton && !target.singleton));
      }
    }
    
    return false;
  }
  
  private isSubtypeOf(source: TypeName, target: TypeName): boolean {
    // Basic subtyping rules
    if (source === target) return true;
    if (target === 'Any') return true;
    
    // Integer is a subtype of Decimal
    if (source === 'Integer' && target === 'Decimal') return true;
    
    // Model-specific subtyping would be checked via ModelProvider
    // For now, we don't have other subtyping rules
    return false;
  }
  
  private isNumericType(type: TypeName): boolean {
    return type === 'Integer' || type === 'Decimal' || type === 'Quantity';
  }
  
  private inferValueType(value: any): TypeInfo {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { type: 'Any', singleton: false };
      }
      // Infer from first element
      const elementType = this.inferValueType(value[0]);
      return { ...elementType, singleton: false };
    }
    
    if (typeof value === 'string') {
      return { type: 'String', singleton: true };
    } else if (typeof value === 'number') {
      return { type: Number.isInteger(value) ? 'Integer' : 'Decimal', singleton: true };
    } else if (typeof value === 'boolean') {
      return { type: 'Boolean', singleton: true };
    } else if (value instanceof Date) {
      return { type: 'DateTime', singleton: true };
    } else {
      return { type: 'Any', singleton: true };
    }
  }
  
  private resolveResultType(
    resultSpec: TypeInfo | 'inputType' | 'leftType' | 'rightType',
    inputType?: TypeInfo,
    leftType?: TypeInfo,
    rightType?: TypeInfo
  ): TypeInfo {
    if (typeof resultSpec !== 'string') {
      return resultSpec;
    }
    
    switch (resultSpec) {
      case 'inputType':
        return inputType || { type: 'Any', singleton: false };
      case 'leftType':
        // For union-like operators, result is always a collection
        return leftType ? { ...leftType, singleton: false } : { type: 'Any', singleton: false };
      case 'rightType':
        return rightType ? { ...rightType, singleton: false } : { type: 'Any', singleton: false };
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  private checkBinaryOperatorTypes(node: BinaryNode, operator: import('./types').OperatorDefinition): void {
    const leftType = node.left.typeInfo!;
    const rightType = node.right.typeInfo!;
    
    // Find if any signature matches
    let foundMatch = false;
    for (const sig of operator.signatures) {
      if (this.isTypeCompatible(leftType, sig.left) && 
          this.isTypeCompatible(rightType, sig.right)) {
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      const leftTypeStr = this.typeToString(leftType);
      const rightTypeStr = this.typeToString(rightType);
      this.diagnostics.push(
        toDiagnostic(Errors.operatorTypeMismatch(node.operator, leftTypeStr, rightTypeStr, node.range))
      );
    }
  }
  
  private checkFunctionArgumentTypes(node: FunctionNode, func: import('./types').FunctionDefinition): void {
    const params = func.signature.parameters;
    
    for (let i = 0; i < Math.min(node.arguments.length, params.length); i++) {
      const arg = node.arguments[i]!;
      const param = params[i]!;
      
      if (arg.typeInfo && !param.expression) {
        // For non-expression parameters, check type compatibility
        if (!this.isTypeCompatible(arg.typeInfo, param.type)) {
          const argTypeStr = this.typeToString(arg.typeInfo);
          const paramTypeStr = this.typeToString(param.type);
          this.diagnostics.push(
            toDiagnostic(Errors.argumentTypeMismatch(i + 1, func.name, paramTypeStr, argTypeStr, arg.range))
          );
        }
      }
    }
  }
  
  private typeToString(type: TypeInfo): string {
    const singletonStr = type.singleton ? '' : '[]';
    if (type.namespace && type.name) {
      return `${type.namespace}.${type.name}${singletonStr}`;
    }
    return `${type.type}${singletonStr}`;
  }
  
  /**
   * Annotate AST with type information
   */
  private annotateAST(node: ASTNode, inputType?: TypeInfo): void {
    // Handle error nodes
    if (node.type === 'Error') {
      const errorNode = node as ErrorNode;
      // Infer a reasonable type for error nodes
      node.typeInfo = this.inferErrorNodeType(errorNode, inputType);
      // Add diagnostic for the error
      this.diagnostics.push({
        severity: errorNode.severity || DiagnosticSeverity.Error,
        message: errorNode.message,
        range: errorNode.range,
        code: errorNode.code?.toString() || 'FP5003',
        source: 'fhirpath'
      });
      return;
    }
    
    // Infer and attach type info
    node.typeInfo = this.inferType(node, inputType);

    // Recursively annotate children
    switch (node.type) {
      case NodeType.Binary:
        const binaryNode = node as BinaryNode;
        this.annotateAST(binaryNode.left, inputType);
        
        // For navigation, pass the left's type as input to the right
        if (binaryNode.operator === '.') {
          // Collect all variables defined in the left side chain
          const definedVarsWithTypes = this.collectDefinedVariablesWithTypes(binaryNode.left);
          
          if (definedVarsWithTypes.size > 0) {
            // Save current variable types
            const savedTypes = new Map<string, TypeInfo>();
            definedVarsWithTypes.forEach((type, varName) => {
              const currentType = this.userVariableTypes.get(varName);
              if (currentType) {
                savedTypes.set(varName, currentType);
              }
              this.userVariableTypes.set(varName, type);
            });
            
            // Annotate right side with new variables in scope
            this.annotateAST(binaryNode.right, binaryNode.left.typeInfo);
            
            // Restore previous types
            definedVarsWithTypes.forEach((_, varName) => {
              const savedType = savedTypes.get(varName);
              if (savedType) {
                this.userVariableTypes.set(varName, savedType);
              } else {
                this.userVariableTypes.delete(varName);
              }
            });
          } else {
            // No defineVariable in chain, proceed normally
            this.annotateAST(binaryNode.right, binaryNode.left.typeInfo);
          }
        } else {
          this.annotateAST(binaryNode.right, inputType);
        }
        break;
        
      case NodeType.Unary:
        const unaryNode = node as UnaryNode;
        this.annotateAST(unaryNode.operand, inputType);
        break;
        
      case NodeType.Function:
        const funcNode = node as FunctionNode;
        this.annotateAST(funcNode.name, inputType);
        
        // Special handling for aggregate function arguments
        if (funcNode.name.type === NodeType.Identifier && 
            (funcNode.name as IdentifierNode).name === 'aggregate') {
          // Aggregate establishes both $this and $total
          if (funcNode.arguments.length >= 1) {
            const itemType = inputType ? { ...inputType, singleton: true } : { type: 'Any' as TypeName, singleton: true };
            
            // Save current system variable context
            const savedThis = this.systemVariableTypes.get('$this');
            const savedTotal = this.systemVariableTypes.get('$total');
            
            // Set $this for iteration
            this.systemVariableTypes.set('$this', itemType);
            
            if (funcNode.arguments.length >= 2) {
              // Has init parameter - evaluate it first
              this.annotateAST(funcNode.arguments[1]!, inputType);
              const initType = funcNode.arguments[1]!.typeInfo;
              
              // Set $total to init type
              if (initType) {
                this.systemVariableTypes.set('$total', initType);
              } else {
                this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
              }
              
              // Process aggregator with both variables set
              this.annotateAST(funcNode.arguments[0]!, inputType);
              
              // Process remaining arguments
              funcNode.arguments.slice(2).forEach(arg => this.annotateAST(arg, inputType));
            } else {
              // No init - first pass to infer aggregator type
              this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
              this.annotateAST(funcNode.arguments[0]!, inputType);
              
              // Second pass with inferred type
              const aggregatorType = funcNode.arguments[0]!.typeInfo;
              if (aggregatorType) {
                this.systemVariableTypes.set('$total', aggregatorType);
                // Re-annotate with proper $total type
                this.annotateAST(funcNode.arguments[0]!, inputType);
              }
            }
            
            // Restore previous context
            if (savedThis) {
              this.systemVariableTypes.set('$this', savedThis);
            } else {
              this.systemVariableTypes.delete('$this');
            }
            if (savedTotal) {
              this.systemVariableTypes.set('$total', savedTotal);
            } else {
              this.systemVariableTypes.delete('$total');
            }
          }
        } else {
          // Special handling for functions that pass their input as context to arguments
          const funcName = funcNode.name.type === NodeType.Identifier ? 
            (funcNode.name as IdentifierNode).name : null;
          
          if (funcName && ['where', 'select', 'all', 'exists'].includes(funcName)) {
            // These functions establish $this as each element of the input collection
            const elementType = inputType ? { ...inputType, singleton: true } : { type: 'Any' as TypeName, singleton: true };
            
            // Save current system variable context
            const savedThis = this.systemVariableTypes.get('$this');
            const savedIndex = this.systemVariableTypes.get('$index');
            
            // Set system variables for expression evaluation
            this.systemVariableTypes.set('$this', elementType);
            this.systemVariableTypes.set('$index', { type: 'Integer', singleton: true });
            
            // Process arguments with system variables in scope
            funcNode.arguments.forEach(arg => this.annotateAST(arg, inputType));
            
            // Restore previous context
            if (savedThis) {
              this.systemVariableTypes.set('$this', savedThis);
            } else {
              this.systemVariableTypes.delete('$this');
            }
            if (savedIndex) {
              this.systemVariableTypes.set('$index', savedIndex);
            } else {
              this.systemVariableTypes.delete('$index');
            }
          } else {
            // Regular function argument annotation
            funcNode.arguments.forEach(arg => this.annotateAST(arg, inputType));
          }
        }
        break;
        
      case NodeType.Collection:
        const collNode = node as CollectionNode;
        collNode.elements.forEach(el => this.annotateAST(el, inputType));
        break;
        
      case NodeType.TypeCast:
        const castNode = node as TypeCastNode;
        this.annotateAST(castNode.expression, inputType);
        break;
        
      case NodeType.MembershipTest:
        const memberNode = node as MembershipTestNode;
        this.annotateAST(memberNode.expression, inputType);
        break;
        
      case NodeType.Index:
        const indexNode = node as IndexNode;
        this.annotateAST(indexNode.expression, inputType);
        this.annotateAST(indexNode.index, inputType);
        break;
        
      case NodeType.TypeOrIdentifier:
        // TypeOrIdentifier doesn't have children to annotate
        break;
    }
  }
}