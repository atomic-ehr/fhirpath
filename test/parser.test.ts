import { describe, it, expect } from "bun:test";
import { Parser, NodeType, pprint } from "../src/parser";
import type {
  ASTNode,
  LiteralNode,
  BinaryNode,
  UnaryNode,
  CollectionNode,
  IdentifierNode,
  TypeOrIdentifierNode,
  FunctionNode,
  IndexNode,
  VariableNode,
  MembershipTestNode,
  TypeCastNode,
} from "../src/parser";

describe("FHIRPath Parser", () => {
  function parse(expr: string) {
    const parser = new Parser(expr);
    const result = parser.parse();
    if (result.errors.length > 0) {
      throw new Error(result.errors[0]!.message);
    }
    return result.ast;
  }

  describe("Literals", () => {
    it("should parse numbers", async () => {
      const ast = parse("42") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(42);
      expect(ast.valueType).toBe("number");
    });

    it("should parse decimal numbers", async () => {
      const ast = parse("3.14") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(3.14);
      expect(ast.valueType).toBe("number");
    });

    it("should parse strings with single quotes", async () => {
      const ast = parse("'hello world'") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe("hello world");
      expect(ast.valueType).toBe("string");
    });

    it("should parse strings with double quotes", async () => {
      const ast = parse('"hello world"') as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe("hello world");
      expect(ast.valueType).toBe("string");
    });

    it("should parse boolean true", async () => {
      const ast = parse("true") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(true);
      expect(ast.valueType).toBe("boolean");
    });

    it("should parse boolean false", async () => {
      const ast = parse("false") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(false);
      expect(ast.valueType).toBe("boolean");
    });

    it("should parse null", async () => {
      const ast = parse("null") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(null);
      expect(ast.valueType).toBe("null");
    });

    it("should parse datetime literals", async () => {
      const ast = parse("@2023-12-25T10:30:00Z") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe("2023-12-25T10:30:00Z");
      expect(ast.valueType).toBe("datetime");
    });

    it("should parse time literals", async () => {
      const ast = parse("@T10:30:00") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe("T10:30:00");
      expect(ast.valueType).toBe("time");
    });

    it("should parse collections", async () => {
      const ast = parse("{1, 2, 3}") as CollectionNode;
      expect(ast.type).toBe(NodeType.Collection);
      expect(ast.elements).toHaveLength(3);
      expect((ast.elements[0] as LiteralNode).value).toBe(1);
      expect((ast.elements[1] as LiteralNode).value).toBe(2);
      expect((ast.elements[2] as LiteralNode).value).toBe(3);
    });

    it("should parse empty collections", async () => {
      const ast = parse("{}") as CollectionNode;
      expect(ast.type).toBe(NodeType.Collection);
      expect(ast.elements).toHaveLength(0);
    });
  });

  describe("Identifiers", () => {
    it("should parse simple identifiers", async () => {
      const ast = parse("name") as IdentifierNode;
      expect(ast.type).toBe(NodeType.Identifier);
      expect(ast.name).toBe("name");
    });

    it("should parse identifiers starting with uppercase as TypeOrIdentifier", async () => {
      const ast = parse("Patient") as TypeOrIdentifierNode;
      expect(ast.type).toBe(NodeType.TypeOrIdentifier);
      expect(ast.name).toBe("Patient");
    });

    it("should parse delimited identifiers", async () => {
      const ast = parse("`special identifier`") as IdentifierNode;
      expect(ast.type).toBe(NodeType.Identifier);
      expect(ast.name).toBe("special identifier");
    });
  });

  describe("Variables", () => {
    it("should parse special identifiers", async () => {
      const ast = parse("$this") as VariableNode;
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe("$this");
    });

    it("should parse $index", async () => {
      const ast = parse("$index") as VariableNode;
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe("$index");
    });

    it("should parse environment variables", async () => {
      const ast = parse("%ucum") as VariableNode;
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe("%ucum");
    });

    it("should parse delimited environment variables", async () => {
      const ast = parse("%`us-zip`") as VariableNode;
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe("%`us-zip`");
    });

    it("should parse string-style environment variables", async () => {
      const ast = parse("%'my-var'") as VariableNode;
      expect(ast.type).toBe(NodeType.Variable);
      expect(ast.name).toBe("%'my-var'");
    });
  });

  describe("Binary Operators", () => {
    describe("Arithmetic", () => {
      it("should parse addition", async () => {
        const ast = parse("5 + 3") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("+");
        expect((ast.left as LiteralNode).value).toBe(5);
        expect((ast.right as LiteralNode).value).toBe(3);
      });

      it("should parse subtraction", async () => {
        const ast = parse("10 - 4") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("-");
        expect((ast.left as LiteralNode).value).toBe(10);
        expect((ast.right as LiteralNode).value).toBe(4);
      });

      it("should parse multiplication", async () => {
        const ast = parse("6 * 7") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("*");
        expect((ast.left as LiteralNode).value).toBe(6);
        expect((ast.right as LiteralNode).value).toBe(7);
      });

      it("should parse division", async () => {
        const ast = parse("20 / 4") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("/");
        expect((ast.left as LiteralNode).value).toBe(20);
        expect((ast.right as LiteralNode).value).toBe(4);
      });

      it("should parse div operator", async () => {
        const ast = parse("20 div 3") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("div");
        expect((ast.left as LiteralNode).value).toBe(20);
        expect((ast.right as LiteralNode).value).toBe(3);
      });

      it("should parse mod operator", async () => {
        const ast = parse("20 mod 3") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("mod");
        expect((ast.left as LiteralNode).value).toBe(20);
        expect((ast.right as LiteralNode).value).toBe(3);
      });
    });

    describe("Comparison", () => {
      it("should parse less than", async () => {
        const ast = parse("a < b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("<");
      });

      it("should parse greater than", async () => {
        const ast = parse("a > b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe(">");
      });

      it("should parse less than or equal", async () => {
        const ast = parse("a <= b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("<=");
      });

      it("should parse greater than or equal", async () => {
        const ast = parse("a >= b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe(">=");
      });

      it("should parse equality", async () => {
        const ast = parse("a = b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("=");
      });

      it("should parse inequality", async () => {
        const ast = parse("a != b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("!=");
      });

      it("should parse similarity", async () => {
        const ast = parse("a ~ b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("~");
      });

      it("should parse not similar", async () => {
        const ast = parse("a !~ b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("!~");
      });
    });

    describe("Logical", () => {
      it("should parse and operator", async () => {
        const ast = parse("true and false") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("and");
      });

      it("should parse or operator", async () => {
        const ast = parse("true or false") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("or");
      });

      it("should parse xor operator", async () => {
        const ast = parse("true xor false") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("xor");
      });

      it("should parse implies operator", async () => {
        const ast = parse("a implies b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("implies");
      });
    });

    describe("Membership", () => {
      it("should parse in operator", async () => {
        const ast = parse("5 in list") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("in");
      });

      it("should parse contains operator", async () => {
        const ast = parse("list contains 5") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("contains");
      });
    });

    describe("Other", () => {
      it("should parse pipe operator", async () => {
        const ast = parse("a | b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("|");
      });

      it("should parse ampersand operator", async () => {
        const ast = parse("a & b") as BinaryNode;
        expect(ast.type).toBe(NodeType.Binary);
        expect(ast.operator).toBe("&");
      });
    });
  });

  describe("Unary Operators", () => {
    it("should parse unary plus", async () => {
      const ast = parse("+5") as UnaryNode;
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe("+");
      expect((ast.operand as LiteralNode).value).toBe(5);
    });

    it("should parse unary minus", async () => {
      const ast = parse("-5") as UnaryNode;
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe("-");
      expect((ast.operand as LiteralNode).value).toBe(5);
    });

    it("should parse not operator", async () => {
      const ast = parse("not active") as UnaryNode;
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe("not");
      expect((ast.operand as IdentifierNode).name).toBe("active");
    });

    it("should parse unary on identifiers", async () => {
      const ast = parse("-value") as UnaryNode;
      expect(ast.type).toBe(NodeType.Unary);
      expect(ast.operator).toBe("-");
      expect((ast.operand as IdentifierNode).type).toBe(NodeType.Identifier);
      expect((ast.operand as IdentifierNode).name).toBe("value");
    });
  });

  describe("Navigation", () => {
    it("should parse simple navigation", async () => {
      const ast = parse("Patient.name") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      expect((ast.left as TypeOrIdentifierNode).name).toBe("Patient");
      expect((ast.right as IdentifierNode).name).toBe("name");
    });

    it("should parse chained navigation", async () => {
      const ast = parse("Patient.name.given") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      expect((ast.left as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.left as BinaryNode).operator).toBe(".");
      expect((ast.right as IdentifierNode).name).toBe("given");
    });

    it("should parse navigation with environment variables", async () => {
      const ast = parse("Patient.%resource") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      expect((ast.left as TypeOrIdentifierNode).name).toBe("Patient");
      expect((ast.right as VariableNode).type).toBe(NodeType.Variable);
      expect((ast.right as VariableNode).name).toBe("%resource");
    });
  });

  describe("Functions", () => {
    it("should parse function calls with no arguments", async () => {
      const ast = parse("count()") as FunctionNode;
      expect(ast.type).toBe(NodeType.Function);
      expect((ast.name as IdentifierNode).name).toBe("count");
      expect(ast.arguments).toHaveLength(0);
    });

    it("should parse function calls with arguments", async () => {
      const ast = parse("substring(0, 5)") as FunctionNode;
      expect(ast.type).toBe(NodeType.Function);
      expect((ast.name as IdentifierNode).name).toBe("substring");
      expect(ast.arguments).toHaveLength(2);
      expect((ast.arguments[0] as LiteralNode).value).toBe(0);
      expect((ast.arguments[1] as LiteralNode).value).toBe(5);
    });

    it("should parse method syntax", async () => {
      const ast = parse("name.first()") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      expect((ast.right as FunctionNode).type).toBe(NodeType.Function);
      expect(((ast.right as FunctionNode).name as IdentifierNode).name).toBe(
        "first",
      );
    });

    it("should parse functions with complex arguments", async () => {
      const ast = parse('where(use = "official")') as FunctionNode;
      expect(ast.type).toBe(NodeType.Function);
      expect((ast.name as IdentifierNode).name).toBe("where");
      expect(ast.arguments).toHaveLength(1);
      expect((ast.arguments[0] as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.arguments[0] as BinaryNode).operator).toBe("=");
    });
  });

  describe("Type Operators", () => {
    it("should parse is operator", async () => {
      const ast = parse("value is String") as MembershipTestNode;
      expect(ast.type).toBe(NodeType.MembershipTest);
      expect((ast.expression as IdentifierNode).name).toBe("value");
      expect(ast.targetType).toBe("String");
    });

    it("should parse as operator", async () => {
      const ast = parse("value as String") as TypeCastNode;
      expect(ast.type).toBe(NodeType.TypeCast);
      expect((ast.expression as IdentifierNode).name).toBe("value");
      expect(ast.targetType).toBe("String");
    });
  });

  describe("Indexing", () => {
    it("should parse array indexing", async () => {
      const ast = parse("items[0]") as IndexNode;
      expect(ast.type).toBe(NodeType.Index);
      expect((ast.expression as IdentifierNode).name).toBe("items");
      expect((ast.index as LiteralNode).value).toBe(0);
    });

    it("should parse indexing with expressions", async () => {
      const ast = parse("items[index + 1]") as IndexNode;
      expect(ast.type).toBe(NodeType.Index);
      expect((ast.expression as IdentifierNode).name).toBe("items");
      expect((ast.index as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.index as BinaryNode).operator).toBe("+");
    });

    it("should parse chained indexing", async () => {
      const ast = parse("matrix[0][1]") as IndexNode;
      expect(ast.type).toBe(NodeType.Index);
      expect((ast.expression as IndexNode).type).toBe(NodeType.Index);
      expect((ast.index as LiteralNode).value).toBe(1);
    });
  });

  describe("Precedence", () => {
    it("should respect arithmetic precedence", async () => {
      const ast = parse("2 + 3 * 4") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("+");
      expect((ast.left as LiteralNode).value).toBe(2);
      expect((ast.right as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.right as BinaryNode).operator).toBe("*");
      expect(((ast.right as BinaryNode).left as LiteralNode).value).toBe(3);
      expect(((ast.right as BinaryNode).right as LiteralNode).value).toBe(4);
    });

    it("should respect comparison vs logical precedence", async () => {
      const ast = parse("a < b and c > d") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("and");
      expect((ast.left as BinaryNode).operator).toBe("<");
      expect((ast.right as BinaryNode).operator).toBe(">");
    });

    it("should respect parentheses", async () => {
      const ast = parse("(2 + 3) * 4") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("*");
      expect((ast.left as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.left as BinaryNode).operator).toBe("+");
    });

    it("should handle right associativity of implies", async () => {
      const ast = parse("a implies b implies c") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("implies");
      expect((ast.left as IdentifierNode).name).toBe("a");
      expect((ast.right as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.right as BinaryNode).operator).toBe("implies");
    });

    it("should give dot highest precedence", async () => {
      const ast = parse("a.b + c.d") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("+");
      expect((ast.left as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.left as BinaryNode).operator).toBe(".");
      expect((ast.right as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.right as BinaryNode).operator).toBe(".");
    });
  });

  describe("Complex Expressions", () => {
    it("should parse navigation with filtering", async () => {
      const ast = parse(
        'Patient.name.where(use = "official").given',
      ) as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      const whereCall = (ast.left as BinaryNode).right as FunctionNode;
      expect(whereCall.type).toBe(NodeType.Function);
      expect((whereCall.name as IdentifierNode).name).toBe("where");
    });

    it("should parse nested function calls", async () => {
      const ast = parse('name.substring(0, indexOf(" "))') as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      const substring = ast.right as FunctionNode;
      expect(substring.type).toBe(NodeType.Function);
      expect((substring.arguments[1] as FunctionNode).type).toBe(
        NodeType.Function,
      );
      expect(
        ((substring.arguments[1] as FunctionNode).name as IdentifierNode).name,
      ).toBe("indexOf");
    });

    it("should parse complex boolean expressions", async () => {
      const ast = parse(
        'age >= 18 and status = "active" or priority = 1',
      ) as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("or");
      expect((ast.left as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.left as BinaryNode).operator).toBe("and");
    });

    it("should parse union expressions", async () => {
      const ast = parse("name | alias | nickname") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("|");
      expect((ast.right as IdentifierNode).name).toBe("nickname");
      expect((ast.left as BinaryNode).type).toBe(NodeType.Binary);
      expect((ast.left as BinaryNode).operator).toBe("|");
    });
  });

  describe("Error Handling", () => {
    it("should throw on unexpected tokens", async () => {
      expect(() => parse("5 +")).toThrow();
    });

    it("should throw on unclosed parentheses", async () => {
      expect(() => parse("(5 + 3")).toThrow();
    });

    it("should throw on unclosed brackets", async () => {
      expect(() => parse("items[0")).toThrow();
    });

    it("should throw on invalid characters", async () => {
      expect(() => parse("5 # 3")).toThrow();
    });

    it("should throw on trailing tokens", async () => {
      expect(() => parse("5 + 3 )")).toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should parse deeply nested parentheses", async () => {
      const ast = parse("((((5))))") as LiteralNode;
      expect(ast.type).toBe(NodeType.Literal);
      expect(ast.value).toBe(5);
    });

    it("should parse expressions with lots of whitespace", async () => {
      const ast = parse("  5   +   3  ") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe("+");
    });

    it("should parse single character identifiers", async () => {
      const ast = parse("a") as IdentifierNode;
      expect(ast.type).toBe(NodeType.Identifier);
      expect(ast.name).toBe("a");
    });
  });

  describe("Keywords as Identifiers", () => {
    it("should allow keywords as property names", async () => {
      const ast = parse("Patient.where") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      expect((ast.right as IdentifierNode).name).toBe("where");
    });

    it("should allow keywords after dot", async () => {
      const ast = parse("obj.and") as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      expect(ast.operator).toBe(".");
      expect((ast.right as IdentifierNode).name).toBe("and");
    });

    it("should distinguish keyword operators from identifiers", async () => {
      const ast1 = parse("a and b") as BinaryNode;
      expect(ast1.type).toBe(NodeType.Binary);
      expect(ast1.operator).toBe("and");

      const ast2 = parse("and") as IdentifierNode;
      expect(ast2.type).toBe(NodeType.Identifier);
      expect(ast2.name).toBe("and");
    });
  });

  describe("manaula", () => {
    it('should parse (max = "*") or iif(max != "*", min <= max.toInteger())', () => {
      const ast = parse(
        '(max = "*") or iif(max != "*", min <= max.toInteger())',
      ) as BinaryNode;
      expect(ast.type).toBe(NodeType.Binary);
      // console.log(pprint(ast));
      // console.log(JSON.stringify(ast, null, 2));
    });
  });
});
