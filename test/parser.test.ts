import { describe, it, expect } from 'bun:test';
import { parse, pprint } from '../src/parser';
import { NodeType } from '../src/parser/ast';
import { TokenType } from '../src/lexer/token';

describe('FHIRPath Parser', () => {
  
  describe('Literals', () => {
    it('parses number literals', () => {
      const ast = parse('42');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(42);
      expect((ast as any).valueType).toBe('number');
    });
    
    it('parses string literals', () => {
      const ast = parse("'hello'");
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe('hello');
      expect((ast as any).valueType).toBe('string');
    });
    
    it('parses boolean literals', () => {
      const ast1 = parse('true');
      expect(ast1.type).toBe(NodeType.Literal);
      expect((ast1 as any).value).toBe(true);
      expect((ast1 as any).valueType).toBe('boolean');
      
      const ast2 = parse('false');
      expect(ast2.type).toBe(NodeType.Literal);
      expect((ast2 as any).value).toBe(false);
    });
    
    it('parses empty collection', () => {
      const ast = parse('{}');
      expect(ast.type).toBe(NodeType.Collection);
      expect((ast as any).elements).toHaveLength(0);
    });
    
    it('parses collection with elements', () => {
      const ast = parse('{1, 2, 3}');
      expect(ast.type).toBe(NodeType.Collection);
      expect((ast as any).elements).toHaveLength(3);
      expect((ast as any).elements[0].value).toBe(1);
      expect((ast as any).elements[1].value).toBe(2);
      expect((ast as any).elements[2].value).toBe(3);
    });
  });
  
  describe('Variables', () => {
    it('parses special variables', () => {
      const ast1 = parse('$this');
      expect(ast1.type).toBe(NodeType.Variable);
      expect((ast1 as any).name).toBe('$this');
      
      const ast2 = parse('$index');
      expect(ast2.type).toBe(NodeType.Variable);
      expect((ast2 as any).name).toBe('$index');
      
      const ast3 = parse('$total');
      expect(ast3.type).toBe(NodeType.Variable);
      expect((ast3 as any).name).toBe('$total');
    });
    
    it('parses environment variables', () => {
      const ast = parse('%context');
      expect(ast.type).toBe(NodeType.Variable);
      expect((ast as any).name).toBe('context');
    });
  });
  
  describe('Identifiers', () => {
    it('parses lowercase identifiers', () => {
      const ast = parse('name');
      expect(ast.type).toBe(NodeType.Identifier);
      expect((ast as any).name).toBe('name');
    });
    
    it('parses uppercase identifiers as TypeOrIdentifier', () => {
      const ast = parse('Patient');
      expect(ast.type).toBe(NodeType.TypeOrIdentifier);
      expect((ast as any).name).toBe('Patient');
    });
    
    it('distinguishes types in navigation chains', () => {
      const ast = parse('Patient.name');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      expect((ast as any).left.type).toBe(NodeType.TypeOrIdentifier);
      expect((ast as any).left.name).toBe('Patient');
      expect((ast as any).right.type).toBe(NodeType.Identifier);
      expect((ast as any).right.name).toBe('name');
    });
  });
  
  describe('Unary Operators', () => {
    it('parses unary plus', () => {
      const ast = parse('+5');
      expect(ast.type).toBe(NodeType.Unary);
      expect((ast as any).operator).toBe(TokenType.PLUS);
      expect((ast as any).operand.value).toBe(5);
    });
    
    it('parses unary minus', () => {
      const ast = parse('-5');
      expect(ast.type).toBe(NodeType.Unary);
      expect((ast as any).operator).toBe(TokenType.MINUS);
      expect((ast as any).operand.value).toBe(5);
    });
    
    it('parses not operator', () => {
      const ast = parse('not true');
      expect(ast.type).toBe(NodeType.Unary);
      expect((ast as any).operator).toBe(TokenType.NOT);
      expect((ast as any).operand.value).toBe(true);
    });
  });
  
  describe('Binary Operators', () => {
    it('parses arithmetic operators', () => {
      const ast = parse('2 + 3');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.PLUS);
      expect((ast as any).left.value).toBe(2);
      expect((ast as any).right.value).toBe(3);
    });
    
    it('parses comparison operators', () => {
      const ast = parse('5 > 3');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.GT);
    });
    
    it('parses logical operators', () => {
      const ast = parse('true and false');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.AND);
    });
    
    it('parses dot operator', () => {
      const ast = parse('patient.name');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      expect((ast as any).left.name).toBe('patient');
      expect((ast as any).right.name).toBe('name');
    });
  });
  
  describe('Precedence', () => {
    it('multiplication before addition', () => {
      const ast = parse('2 + 3 * 4');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.PLUS);
      expect((ast as any).left.value).toBe(2);
      expect((ast as any).right.type).toBe(NodeType.Binary);
      expect((ast as any).right.operator).toBe(TokenType.STAR);
      expect((ast as any).right.left.value).toBe(3);
      expect((ast as any).right.right.value).toBe(4);
    });
    
    it('dot has highest precedence', () => {
      const ast = parse('Patient.name.given | Patient.name.family');
      expect(ast.type).toBe(NodeType.Union);
      const operands = (ast as any).operands;
      expect(operands).toHaveLength(2);
      
      // First operand: Patient.name.given
      expect(operands[0].type).toBe(NodeType.Binary);
      expect(operands[0].operator).toBe(TokenType.DOT);
      
      // Second operand: Patient.name.family
      expect(operands[1].type).toBe(NodeType.Binary);
      expect(operands[1].operator).toBe(TokenType.DOT);
    });
    
    it('handles parentheses correctly', () => {
      const ast = parse('(2 + 3) * 4');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.STAR);
      expect((ast as any).left.type).toBe(NodeType.Binary);
      expect((ast as any).left.operator).toBe(TokenType.PLUS);
      expect((ast as any).right.value).toBe(4);
    });
  });
  
  describe('Functions', () => {
    it('parses function calls with no arguments', () => {
      const ast = parse('count()');
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('count');
      expect((ast as any).arguments).toHaveLength(0);
    });
    
    it('parses function calls with arguments', () => {
      const ast = parse('substring(0, 5)');
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('substring');
      expect((ast as any).arguments).toHaveLength(2);
      expect((ast as any).arguments[0].value).toBe(0);
      expect((ast as any).arguments[1].value).toBe(5);
    });
    
    it('parses function calls after dot', () => {
      const ast = parse('name.substring(0)');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      expect((ast as any).left.name).toBe('name');
      expect((ast as any).right.type).toBe(NodeType.Function);
      expect((ast as any).right.name.name).toBe('substring');
      expect((ast as any).right.arguments).toHaveLength(1);
      expect((ast as any).right.arguments[0].value).toBe(0);
    });
    
    it('parses ofType with special handling', () => {
      const ast = parse('ofType(Patient)');
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('ofType');
      expect((ast as any).arguments).toHaveLength(1);
      expect((ast as any).arguments[0].type).toBe(NodeType.TypeReference);
      expect((ast as any).arguments[0].typeName).toBe('Patient');
    });
  });
  
  describe('Type Operators', () => {
    it('parses is operator', () => {
      const ast = parse('value is Patient');
      expect(ast.type).toBe(NodeType.MembershipTest);
      expect((ast as any).expression.name).toBe('value');
      expect((ast as any).targetType).toBe('Patient');
    });
    
    it('parses as operator', () => {
      const ast = parse('value as Patient');
      expect(ast.type).toBe(NodeType.TypeCast);
      expect((ast as any).expression.name).toBe('value');
      expect((ast as any).targetType).toBe('Patient');
    });
  });
  
  describe('Union Operator', () => {
    it('parses simple union', () => {
      const ast = parse('a | b');
      expect(ast.type).toBe(NodeType.Union);
      expect((ast as any).operands).toHaveLength(2);
      expect((ast as any).operands[0].name).toBe('a');
      expect((ast as any).operands[1].name).toBe('b');
    });
    
    it('parses union chains', () => {
      const ast = parse('a | b | c | d');
      expect(ast.type).toBe(NodeType.Union);
      expect((ast as any).operands).toHaveLength(4);
      expect((ast as any).operands[0].name).toBe('a');
      expect((ast as any).operands[1].name).toBe('b');
      expect((ast as any).operands[2].name).toBe('c');
      expect((ast as any).operands[3].name).toBe('d');
    });
  });
  
  describe('Indexing', () => {
    it('parses indexing', () => {
      const ast = parse('items[0]');
      expect(ast.type).toBe(NodeType.Index);
      expect((ast as any).expression.name).toBe('items');
      expect((ast as any).index.value).toBe(0);
    });
    
    it('parses chained indexing', () => {
      const ast = parse('matrix[0][1]');
      expect(ast.type).toBe(NodeType.Index);
      expect((ast as any).expression.type).toBe(NodeType.Index);
      expect((ast as any).index.value).toBe(1);
    });
  });
  
  describe('Complex Expressions', () => {
    it('parses navigation with where clause', () => {
      const ast = parse("Patient.name.where(use = 'official').given");
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      
      // The structure is now: DOT(DOT(Patient, name), DOT(where(...), given))
      // The left side is Patient.name
      expect((ast as any).left.type).toBe(NodeType.Binary);
      expect((ast as any).left.operator).toBe(TokenType.DOT);
      expect((ast as any).left.left.name).toBe('Patient');
      expect((ast as any).left.right.name).toBe('name');
      
      // The right side is where(...).given
      expect((ast as any).right.type).toBe(NodeType.Binary);
      expect((ast as any).right.operator).toBe(TokenType.DOT);
      expect((ast as any).right.right.name).toBe('given');
      
      // The where function call
      const whereCall = (ast as any).right.left;
      expect(whereCall.type).toBe(NodeType.Function);
      expect(whereCall.name.name).toBe('where');
      expect(whereCall.arguments).toHaveLength(1);
      expect(whereCall.arguments[0].type).toBe(NodeType.Binary);
      expect(whereCall.arguments[0].operator).toBe(TokenType.EQ);
    });
    
    it('parses nested function calls', () => {
      const ast = parse("name.substring(indexOf('.'), length())");
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      expect((ast as any).right.type).toBe(NodeType.Function);
      
      const args = (ast as any).right.arguments;
      expect(args).toHaveLength(2);
      
      // First argument is a function call
      expect(args[0].type).toBe(NodeType.Function);
      expect(args[0].name.name).toBe('indexOf');
      
      // Second argument is also a function call
      expect(args[1].type).toBe(NodeType.Function);
      expect(args[1].name.name).toBe('length');
    });
  });
  
  describe('Error Handling', () => {
    it('reports missing closing paren', () => {
      expect(() => parse('(1 + 2')).toThrow("Expected ')' after expression at line 1, column 7");
    });
    
    it('reports unexpected token', () => {
      expect(() => parse('1 +')).toThrow('Expected expression at line 1, column 4');
    });
    
    it('reports invalid type operator usage', () => {
      expect(() => parse('value is')).toThrow('Expected type name at line 1, column 9');
    });
  });
  
  describe('Edge Cases', () => {
    it('parses empty collection', () => {
      const ast = parse('{}');
      expect(ast.type).toBe(NodeType.Collection);
      expect((ast as any).elements).toHaveLength(0);
    });
    
    it('handles deeply nested expressions', () => {
      const ast = parse('((((((1))))))');
      expect(ast.type).toBe(NodeType.Literal);
      expect((ast as any).value).toBe(1);
    });


    
    it('parses complex navigation chain', () => {
      const ast = parse('Bundle.entry.resource.ofType(Patient).name.given');
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      
      // Verify the chain structure exists
      let current = ast;
      let depth = 0;
      while ((current as any).left && depth < 10) {
        if ((current as any).left.type === NodeType.Binary) {
          current = (current as any).left;
          depth++;
        } else {
          break;
        }
      }
      expect(depth).toBeGreaterThan(0);
    });
  });

  describe('Playground', () => {
    it('handles groups', () => {
      //'name.select( given.first().substring(0, 1) + family)'
      const expr = "defineVariable('sc', code).property.all((code = 'alternateCode') implies defineVariable('ac', value).%resource.repeat(concept).where(code = %ac).exists(property.where(code = 'alternateCode').value = %sc))";
      const ast = parse(expr);
      //console.log(pprint(ast, true));
    });
  });
  
  describe('Context-Sensitive Keywords', () => {
    it('parses contains at expression start', () => {
      const ast = parse("contains.version.exists()");
      expect(ast.type).toBe(NodeType.Binary);
      expect((ast as any).operator).toBe(TokenType.DOT);
      expect((ast as any).left.type).toBe(NodeType.Binary);
      expect((ast as any).left.left.name).toBe('contains');
    });
    
    it('parses as function syntax', () => {
      const ast = parse("as(uri)");
      expect(ast.type).toBe(NodeType.Function);
      expect((ast as any).name.name).toBe('as');
      expect((ast as any).arguments).toHaveLength(1);
    });
    
    it('parses operator keywords as properties', () => {
      const ast1 = parse("div.property");
      expect(ast1.type).toBe(NodeType.Binary);
      expect((ast1 as any).left.name).toBe('div');
      
      const ast2 = parse("mod.value");
      expect(ast2.type).toBe(NodeType.Binary);
      expect((ast2 as any).left.name).toBe('mod');
    });
    
    it('still parses operators correctly', () => {
      const ast1 = parse("'hello' contains 'ell'");
      expect(ast1.type).toBe(NodeType.Binary);
      expect((ast1 as any).operator).toBe(TokenType.CONTAINS);
      
      const ast2 = parse("value as Patient");
      expect(ast2.type).toBe(NodeType.TypeCast);
      
      const ast3 = parse("10 div 3");
      expect(ast3.type).toBe(NodeType.Binary);
      expect((ast3 as any).operator).toBe(TokenType.DIV);
    });
  });
});