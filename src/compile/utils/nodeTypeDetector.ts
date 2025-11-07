import type {
  Declaration,
  Directive,
  Expression,
  ModuleDeclaration,
  Node,
  Statement,
} from "estree";

/**
 * Type guard to check if a node is a Statement
 * Statements include: ExpressionStatement, IfStatement, WhileStatement, ForStatement,
 * BlockStatement, ReturnStatement, BreakStatement, ContinueStatement, etc.
 */
export function isStatement(node: Node): node is Statement {
  const statementTypes = [
    "ExpressionStatement", // ? special case for directives
    "DebuggerStatement", // nope
    "WithStatement", // nope
    "LabeledStatement", // nope
    "ThrowStatement", // done
    "TryStatement", // done
    "BlockStatement", // done
    "EmptyStatement", // done
    "ReturnStatement", // done

    "BreakStatement", // done
    "ContinueStatement", // done
    "IfStatement", // done
    "SwitchStatement", // done

    "WhileStatement", // done
    "DoWhileStatement", // done
    "ForStatement", // done
    "ForInStatement", // done
    "ForOfStatement", // done

    "FunctionDeclaration", // done
    "VariableDeclaration", // done
    "ClassDeclaration", // x
  ];

  return statementTypes.includes(node.type);
}

/**
 * Type guard to check if a node is an Expression
 * Expressions include: Identifier, Literal, BinaryExpression, CallExpression,
 * ArrayExpression, ObjectExpression, AssignmentExpression, etc.
 */
export function isExpression(node: Node): node is Expression {
  const expressionTypes = [
    "ThisExpression",
    "ArrayExpression",
    "ObjectExpression",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "YieldExpression",
    "Literal",
    "UnaryExpression",
    "UpdateExpression",
    "BinaryExpression",
    "AssignmentExpression",
    "LogicalExpression",
    "MemberExpression",
    "ConditionalExpression",
    "CallExpression",
    "NewExpression",
    "SequenceExpression",
    "TemplateLiteral",
    "TaggedTemplateExpression",
    "ClassExpression",
    "MetaProperty",
    "Identifier",
    "AwaitExpression",
    "ImportExpression",
    "ChainExpression",
  ];

  return expressionTypes.includes(node.type);
}

/**
 * Type guard to check if a node is a Declaration
 * Declarations include: FunctionDeclaration, VariableDeclaration, ClassDeclaration
 * Note: Declarations are also statements, so a declaration will match both isDeclaration and isStatement
 */
export function isDeclaration(node: Node): node is Declaration {
  const declarationTypes = ["FunctionDeclaration", "VariableDeclaration", "ClassDeclaration"];

  return declarationTypes.includes(node.type);
}

/**
 * Type guard to check if a node is a Directive
 * Directives are special ExpressionStatements with a directive property
 * (e.g., "use strict")
 * Note: This checks if the node has a 'directive' property, which is specific to Directive nodes
 */
export function isDirective(node: Node): node is Directive {
  return node.type === "ExpressionStatement" && "directive" in node;
}

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
  if (isDeclaration(node)) {
    return "declaration";
  }
  if (isStatement(node)) {
    return "statement";
  }
  if (isExpression(node)) {
    return "expression";
  }
  return "unknown";
}
