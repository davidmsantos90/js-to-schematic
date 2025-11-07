/**
 * Example test file demonstrating the node type detector utilities
 *
 * This file shows how to detect if a node is a statement, expression, or declaration
 */
import * as acorn from "acorn";
import type { Node } from "estree";

import {
  getNodeCategory,
  isDeclaration,
  isExpression,
  isStatement,
} from "./src/compile/utils/nodeTypeDetector.js";

// Parse some example JavaScript code
const code = `
  const x = 5;           // VariableDeclaration (declaration)
  x + 10;                // BinaryExpression (expression)
  if (x > 0) {}          // IfStatement (statement)
  function foo() {}      // FunctionDeclaration (declaration)
  foo();                 // CallExpression (expression)
`;

const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" });

console.log("=== Node Type Detection Examples ===\n");

ast.body.forEach((node, index) => {
  // Cast acorn node to estree Node (they are compatible at runtime)
  const estreeNode = node as any as Node;

  console.log(`Node ${index + 1}: ${node.type}`);
  console.log(`  - Is Statement: ${isStatement(estreeNode)}`);
  console.log(`  - Is Expression: ${isExpression(estreeNode)}`);
  console.log(`  - Is Declaration: ${isDeclaration(estreeNode)}`);
  console.log(`  - Category: ${getNodeCategory(estreeNode)}`);
  console.log();
});

// Example: Check specific nodes
const expressionStatement = ast.body[1]; // x + 10;
if (expressionStatement.type === "ExpressionStatement") {
  const expression = (expressionStatement as any).expression as Node;
  console.log("=== Checking the 'x + 10' expression ===");
  console.log(`Expression type: ${expression.type}`);
  console.log(`Is Expression: ${isExpression(expression)}`);
  console.log(`Is Statement: ${isStatement(expression)}`);
  console.log(`Category: ${getNodeCategory(expression)}`);
}
