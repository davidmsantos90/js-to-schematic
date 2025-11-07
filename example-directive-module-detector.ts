/**
 * Example usage of isDirective and isModuleDeclaration type guards
 */
import type { Directive, ModuleDeclaration, Node, Statement } from "estree";

import {
  getNodeCategory,
  isDeclaration,
  isDirective,
  isExpression,
  isModuleDeclaration,
  isStatement,
} from "./src/compile/utils/nodeTypeDetector.js";

// Example 1: Checking for directives
function handleDirective(node: Node): void {
  if (isDirective(node)) {
    // node is typed as Directive here
    console.log(`Found directive: "${node.directive}"`);
    console.log(`Expression: ${JSON.stringify(node.expression)}`);
  }
}

// Example 2: Checking for module declarations
function handleModuleDeclaration(node: Node): void {
  if (isModuleDeclaration(node)) {
    // node is typed as ModuleDeclaration here
    switch (node.type) {
      case "ImportDeclaration":
        console.log("Import:", node.source.value);
        break;
      case "ExportNamedDeclaration":
        console.log("Named export");
        break;
      case "ExportDefaultDeclaration":
        console.log("Default export");
        break;
      case "ExportAllDeclaration":
        console.log("Export all from:", node.source.value);
        break;
    }
  }
}

// Example 3: Complete node handling with all type guards
function compileNode(node: Node): void {
  // Check in order of specificity
  if (isDirective(node)) {
    console.log(`Directive: ${node.directive}`);
    return;
  }

  if (isModuleDeclaration(node)) {
    console.log(`Module declaration: ${node.type}`);
    return;
  }

  if (isDeclaration(node)) {
    console.log(`Declaration: ${node.type}`);
    return;
  }

  if (isStatement(node)) {
    console.log(`Statement: ${node.type}`);
    return;
  }

  if (isExpression(node)) {
    console.log(`Expression: ${node.type}`);
    return;
  }

  console.log(`Unknown node type: ${node.type}`);
}

// Example 4: Using getNodeCategory
function routeByCategory(node: Node): void {
  const category = getNodeCategory(node);

  switch (category) {
    case "directive":
      handleDirective(node as Directive);
      break;

    case "module-declaration":
      handleModuleDeclaration(node as ModuleDeclaration);
      break;

    case "declaration":
      console.log("Compiling declaration");
      break;

    case "statement":
      console.log("Compiling statement");
      break;

    case "expression":
      console.log("Compiling expression");
      break;

    case "unknown":
      throw new Error(`Unknown node type: ${(node as any).type}`);
  }
}

// Example 5: Program body processing
function processProgram(body: Array<Directive | Statement | ModuleDeclaration>): void {
  for (const node of body) {
    if (isDirective(node)) {
      console.log(`Directive at top: ${node.directive}`);
      continue;
    }

    if (isModuleDeclaration(node)) {
      console.log(`Module import/export: ${node.type}`);
      continue;
    }

    if (isStatement(node)) {
      console.log(`Statement: ${node.type}`);
      continue;
    }
  }
}

export { compileNode, handleDirective, handleModuleDeclaration, processProgram, routeByCategory };
