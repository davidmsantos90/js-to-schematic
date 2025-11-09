import type {
  Declaration,
  Directive,
  Expression,
  ModuleDeclaration,
  Node,
  Statement,
} from "estree";

/**
 * Type guard to check if a node is an Expression
 * Expressions include: Identifier, Literal, BinaryExpression, CallExpression,
 * ArrayExpression, ObjectExpression, AssignmentExpression, etc.
 */
export function isExpression(node: Node): node is Expression {
  const expressionTypes = [
    /* a variable or function name */
    "Identifier",

    /* create array */
    "ArrayExpression",
    /* create object */
    "ObjectExpression",

    /* create anonymous (or not) function */
    "FunctionExpression",
    /* create anonymous (or not) arrow function */
    "ArrowFunctionExpression",

    /* numbers, strings, boolean, null ... regexp, bigints (not supported) */
    "Literal",
    /* template strings */
    "TemplateLiteral",
    
    /* Negate (-), Plus (+), Logical Not (!), Bitwise Not (~), ? typeof, void, delete ? */
    "UnaryExpression",
    
    /** increment (++) and decrement (--) */
    "UpdateExpression",

    /**
     * Arithmetic: +, -, *, /, %, **
     * Comparison: ==, ===, !=, !==, <, >, <=, >=
     * Bitwise: AND (&), OR (|), XOR (^), SHL (<<), SHR (>>), USHR (>>>)
     * Special: in, instanceof
     */
    "BinaryExpression",
    /**
     * Assignment: =, +=, -=, *=, /=, %=, **=, &=, |=, ^=, <<=, >>=, >>>=
     * Logical Assignment: &&=, ||=, ??=
     */
    "AssignmentExpression",
    /* &&, ||, ?? */
    "LogicalExpression",

    /* Conditional (ternary) operator */
    "ConditionalExpression",

    /* function call */
    "CallExpression",

    /* member access obj.prop, obj['prop'], obj[index] */
    "MemberExpression",

    // maybe

    /* this.foo */
    "ThisExpression",

    /* a, b, c ... used in loops, so maybe */
    "SequenceExpression",

    /* function`hello world` */
    "TaggedTemplateExpression",

    /* optional chaining obj?.prop?.subprop */
    "ChainExpression",

    // nope
    "MetaProperty",
    "NewExpression",
    "ClassExpression",
    "YieldExpression",
    "AwaitExpression",
    "ImportExpression",
  ];

  return expressionTypes.includes(node.type);
}

/**
 * Type guard to check if a node is a Directive
 * Directives are special ExpressionStatements with a directive property
 * (e.g., "use strict")
 * Note: This checks if the node has a 'directive' property, which is specific to Directive nodes
 */
export function isDirective(node: Node): node is Directive {
  return node.type === "ExpressionStatement" && "directive" in node;
};

/**
 * Type guard to check if a node is a ModuleDeclaration
 * Module declarations include: ImportDeclaration, ExportNamedDeclaration, ExportDefaultDeclaration,
 * ExportAllDeclaration
 */
export function isModuleDeclaration(node: Node): node is ModuleDeclaration {
  const moduleDeclarationTypes = [
    "ImportDeclaration",
    "ExportNamedDeclaration",
    "ExportDefaultDeclaration",
    "ExportAllDeclaration",
  ];

  return moduleDeclarationTypes.includes(node.type);
}

/**
 * Determines the category of a node: 'statement', 'expression', or 'declaration'
 * Note: Declarations are also statements, so this will return 'declaration' for declaration nodes
 * to allow for more specific handling
 */
export function getNodeCategory(
  node: Node,
): "declaration" | "statement" | "expression" | "directive" | "module-declaration" | "unknown" {
  if (isDirective(node)) {
    return "directive";
  }

  if (isModuleDeclaration(node)) {
    return "module-declaration";
  }

  if (isExpression(node)) {
    return "expression";
  }

  return "unknown";
}
