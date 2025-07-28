import type { 
  ASTNode, 
  IdentifierNode, 
  TypeOrIdentifierNode, 
  VariableNode,
  TypeReferenceNode,
  BinaryNode,
  UnaryNode,
  UnionNode,
  FunctionNode,
  CollectionNode,
  MembershipTestNode,
  TypeCastNode,
  IndexNode,
  LiteralNode
} from './ast';
import { NodeType } from './ast';
import { TokenType } from '../lexer/token';

/**
 * Pretty print an AST node as an S-expression (without position information)
 */
export function pprint(node: ASTNode, multiline: boolean = false, indent: number = 0): string {
  const spaces = multiline ? ' '.repeat(indent) : '';
  const nl = multiline ? '\n' : '';
  const childIndent = indent + 2;
  
  switch (node.type) {
    case NodeType.Literal:
      const lit = node as LiteralNode;
      return `${spaces}(${pprintLiteralValue(lit)}:${lit.valueType})`;
    
    case NodeType.Identifier:
      return `${spaces}(${(node as IdentifierNode).name}:id)`;
    
    case NodeType.TypeOrIdentifier:
      return `${spaces}(${(node as TypeOrIdentifierNode).name}:type-or-id)`;
    
    case NodeType.Variable:
      const varNode = node as VariableNode;
      const varName = varNode.name.startsWith('$') ? varNode.name : `%${varNode.name}`;
      return `${spaces}(${varName}:var)`;
    
    case NodeType.TypeReference:
      return `${spaces}(${(node as TypeReferenceNode).typeName}:type-ref)`;
    
    case NodeType.Binary:
      const binary = node as BinaryNode;
      const op = tokenToOp(binary.operator);
      if (multiline) {
        return `${spaces}(${op}${nl}${pprint(binary.left, multiline, childIndent)}${nl}${pprint(binary.right, multiline, childIndent)})`;
      } else {
        return `(${op} ${pprint(binary.left)} ${pprint(binary.right)})`;
      }
    
    case NodeType.Unary:
      const unary = node as UnaryNode;
      const unaryOp = tokenToOp(unary.operator);
      if (multiline) {
        return `${spaces}(${unaryOp}:unary${nl}${pprint(unary.operand, multiline, childIndent)})`;
      } else {
        return `(${unaryOp}:unary ${pprint(unary.operand)})`;
      }
    
    case NodeType.Union:
      const union = node as UnionNode;
      if (multiline) {
        const operands = union.operands.map(op => pprint(op, multiline, childIndent)).join(nl);
        return `${spaces}(|${nl}${operands})`;
      } else {
        return `(| ${union.operands.map(op => pprint(op)).join(' ')})`;
      }
    
    case NodeType.Function:
      const func = node as FunctionNode;
      const funcName = (func.name as IdentifierNode).name;
      if (multiline && func.arguments.length > 0) {
        const args = func.arguments.map(arg => pprint(arg, multiline, childIndent)).join(nl);
        return `${spaces}(${funcName}:fn${nl}${args})`;
      } else {
        const args = func.arguments.map(arg => pprint(arg)).join(' ');
        return args ? `${spaces}(${funcName}:fn ${args})` : `${spaces}(${funcName}:fn)`;
      }
    
    case NodeType.Collection:
      const coll = node as CollectionNode;
      if (multiline && coll.elements.length > 0) {
        const elements = coll.elements.map(el => pprint(el, multiline, childIndent)).join(nl);
        return `${spaces}({}:collection${nl}${elements})`;
      } else {
        const elements = coll.elements.map(el => pprint(el)).join(' ');
        return elements ? `${spaces}({}:collection ${elements})` : `${spaces}({}:collection)`;
      }
    
    case NodeType.MembershipTest:
      const memberTest = node as MembershipTestNode;
      if (multiline) {
        return `${spaces}(is${nl}${pprint(memberTest.expression, multiline, childIndent)}${nl}${' '.repeat(childIndent)}${memberTest.targetType})`;
      } else {
        return `(is ${pprint(memberTest.expression)} ${memberTest.targetType})`;
      }
    
    case NodeType.TypeCast:
      const typeCast = node as TypeCastNode;
      if (multiline) {
        return `${spaces}(as${nl}${pprint(typeCast.expression, multiline, childIndent)}${nl}${' '.repeat(childIndent)}${typeCast.targetType})`;
      } else {
        return `(as ${pprint(typeCast.expression)} ${typeCast.targetType})`;
      }
    
    case NodeType.Index:
      const index = node as IndexNode;
      if (multiline) {
        return `${spaces}([]${nl}${pprint(index.expression, multiline, childIndent)}${nl}${pprint(index.index, multiline, childIndent)})`;
      } else {
        return `([] ${pprint(index.expression)} ${pprint(index.index)})`;
      }
    
    default:
      return `${spaces}(unknown:${node.type})`;
  }
}

function pprintLiteralValue(node: LiteralNode): string {
  const value = node.value;
  const valueType = node.valueType;
  
  switch (valueType) {
    case 'string':
      return `'${value}'`;
    case 'number':
      return String(value);
    case 'boolean':
      return String(value);
    case 'null':
      return '{}';
    case 'date':
    case 'time':
    case 'datetime':
      return `@${value}`;
    default:
      return String(value);
  }
}

function tokenToOp(token: TokenType): string {
  switch (token) {
    case TokenType.PLUS: return '+';
    case TokenType.MINUS: return '-';
    case TokenType.STAR: return '*';
    case TokenType.DIV: return 'div';
    case TokenType.MOD: return 'mod';
    case TokenType.GT: return '>';
    case TokenType.LT: return '<';
    case TokenType.GTE: return '>=';
    case TokenType.LTE: return '<=';
    case TokenType.EQ: return '=';
    case TokenType.NEQ: return '!=';
    case TokenType.AND: return 'and';
    case TokenType.OR: return 'or';
    case TokenType.XOR: return 'xor';
    case TokenType.IMPLIES: return 'implies';
    case TokenType.NOT: return 'not';
    case TokenType.DOT: return '.';
    case TokenType.CONTAINS: return 'contains';
    case TokenType.IN: return 'in';
    default: return token;
  }
}