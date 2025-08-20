import type { TypeInfo } from './types';

/**
 * Manages lexical scopes for variables within the FHIRPath Analyzer.
 * Provides a stack-based mechanism to enter and leave scopes,
 * ensuring correct variable resolution based on their definition context.
 */
export class ScopeManager<T = TypeInfo> {
  // Each element in the array represents a scope. The last element is the current scope.
  // Each scope is a Map from variable name (e.g., '$this', '$index') to its TypeInfo.
  private scopes: Map<string, T>[] = [new Map()];

  /**
   * Enters a new, empty scope.
   * Variables defined after entering this scope will be local to it.
   */
  enterScope(): void {
    this.scopes.push(new Map());
  }

  /**
   * Leaves the current scope.
   * If there's only one scope left (the global scope), it cannot be left.
   */
  leaveScope(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  /**
   * Sets a variable's type in the current scope.
   * @param name The name of the variable (e.g., '$this').
   * @param type The TypeInfo of the variable.
   */
  set(name: string, type: T): void {
    if (this.scopes.length > 0) {
      (this.scopes[this.scopes.length - 1] as Map<string, T>).set(name, type);
    }
  }

  /**
   * Retrieves a variable's type, searching from the current scope upwards through parent scopes.
   * @param name The name of the variable.
   * @returns The TypeInfo of the variable, or undefined if not found in any active scope.
   */
  get(name: string): T | undefined {
    // Search from the innermost (current) scope outwards to the global scope
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const currentScope = this.scopes[i];
      if (currentScope && currentScope.has(name)) {
        return currentScope.get(name) as T;
      }
    }
    return undefined;
  }
}
