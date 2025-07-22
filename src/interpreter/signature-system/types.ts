import type { ASTNode } from '../../parser/ast';
import type { Context, EvaluationResult } from '../types';
import type { Interpreter } from '../interpreter';

export type ArgumentType = 'string' | 'integer' | 'decimal' | 'boolean' | 'collection' | 'expression' | 'any';

export interface ArgumentDefinition {
  name: string;
  type: ArgumentType;
  optional?: boolean;
  evaluationMode?: 'eager' | 'lazy' | 'type-only';
  evaluationContext?: 'input' | '$this' | 'original';
  validator?: (value: any) => boolean;
  defaultValue?: any;
}

export interface FunctionDefinition {
  name: string;
  arguments?: ArgumentDefinition[];
  inputType?: ArgumentType;
  outputType?: ArgumentType;
  propagateEmptyInput?: boolean;
  typeSignature?: import('../../analyzer/types').FunctionTypeSignature;
  evaluate: (
    interpreter: Interpreter,
    context: Context,
    input: any[],
    ...args: any[]
  ) => EvaluationResult;
}

export interface EvaluatedArguments {
  values: any[];
  ast: ASTNode[];
  metadata: {
    types: string[];
    evaluationModes: string[];
    contexts: Context[];
  };
}