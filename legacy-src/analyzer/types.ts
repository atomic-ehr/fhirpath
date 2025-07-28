/**
 * Type system interfaces for FHIRPath type analysis
 * 
 * Uses opaque type references to allow flexible implementation
 */

// Opaque type reference - implementation details hidden from analyzer
export type TypeRef = unknown;

/**
 * Information about a property on a type
 */
export interface PropertyInfo {
  type: TypeRef;
  isSingleton: boolean;
}

/**
 * Model provider interface for type resolution and navigation
 */
export interface ModelProvider {
  /**
   * Resolve a type name to an opaque type reference
   */
  resolveType(typeName: string): TypeRef | undefined;
  
  /**
   * Get property type from an opaque type reference
   */
  getPropertyType(type: TypeRef, propertyName: string): PropertyInfo | undefined;
  
  /**
   * Check if one type is assignable to another
   */
  isAssignable(from: TypeRef, to: TypeRef): boolean;
  
  /**
   * Get a human-readable name for a type (for error messages)
   */
  getTypeName(type: TypeRef): string;
  
  /**
   * Check if a type is a collection type
   */
  isCollectionType?(type: TypeRef): boolean;
  
  /**
   * Get common base type for union types
   */
  getCommonType?(types: TypeRef[]): TypeRef | undefined;
}

/**
 * Parameter type information for functions
 */
export interface ParameterTypeInfo {
  type?: TypeRef | 'expression' | 'any';
  requiresSingleton?: boolean;
  optional?: boolean;
}

/**
 * Function type signature
 */
export interface FunctionTypeSignature {
  // Input requirements
  requiresSingleton: boolean;
  propagateEmptyInput?: boolean;
  requiresInputType?: string; // Required input type (e.g., 'string' for string functions)
  
  // Parameter type information
  parameters?: ParameterTypeInfo[];
  
  // Return type calculation
  returnType: (
    inputType: TypeRef | undefined,
    paramTypes: (TypeRef | undefined)[],
    provider: ModelProvider
  ) => TypeRef | undefined;
  
  // Return cardinality calculation
  returnsSingleton: (
    inputIsSingleton: boolean,
    paramAreSingleton: boolean[]
  ) => boolean;
}

/**
 * Operator type signature
 */
export interface OperatorTypeSignature {
  requiresLeftSingleton: boolean;
  requiresRightSingleton: boolean;
  
  // For simple operators with fixed types
  acceptedTypes?: Array<{
    left: string;
    right: string;
    result: string;
  }> | 'any';
  
  // For complex operators that need custom logic
  returnType?: (
    leftType: TypeRef | undefined,
    rightType: TypeRef | undefined,
    provider: ModelProvider
  ) => TypeRef | undefined;
  
  returnsSingleton: boolean | ((left: boolean, right: boolean) => boolean);
}

/**
 * Type analysis mode
 */
export enum AnalysisMode {
  Strict = 'strict',   // Type mismatches are errors
  Lenient = 'lenient' // Type mismatches are warnings, continue with Any
}

/**
 * Type analysis result
 */
export interface TypeAnalysisResult {
  // Annotated AST with type information
  ast: import('../parser/ast').ASTNode;
  
  // Any errors or warnings encountered
  diagnostics: TypeDiagnostic[];
  
  // Overall result type
  resultType?: TypeRef;
  resultIsSingleton?: boolean;
}

/**
 * Type diagnostic (error or warning)
 */
export interface TypeDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  position?: import('../parser/ast').Position;
}