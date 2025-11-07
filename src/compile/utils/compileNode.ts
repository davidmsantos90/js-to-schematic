import type { Declaration, Expression, Node, Statement } from "estree";

import type { CompilerContext } from "../../types/compile";
import { getNodeCategory, isDeclaration, isExpression, isStatement } from "./nodeTypeDetector";

/**
 * Example function that compiles a node by detecting its type
 * and calling the appropriate compiler.
 *
 * This demonstrates how to use the type detection utilities.
 */
export function compileNodeByType(this: CompilerContext, node: Node): void {
  // Method 1: Using individual type guards
  if (isDeclaration(node)) {
    // Handle declarations specifically
    console.log("This is a declaration:", node.type);
    if (this.compileNode) {
      this.compileNode(node as Statement);
    }
  } else if (isStatement(node)) {
    // Handle other statements
    console.log("This is a statement:", node.type);
    if (this.compileNode) {
      this.compileNode(node as Statement);
    }
  } else if (isExpression(node)) {
    // Handle expressions
    console.log("This is an expression:", node.type);
    if (this.expression) {
      this.expression.compileValue(node as Expression);
    }
  } else {
    throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Alternative approach using getNodeCategory
 */
export function compileNodeByCategory(this: CompilerContext, node: Node): void {
  const category = getNodeCategory(node);

  switch (category) {
    case "declaration":
      console.log("Compiling declaration:", node.type);
      if (this.compileNode) {
        this.compileNode(node as Declaration);
      }
      break;

    case "statement":
      console.log("Compiling statement:", node.type);
      if (this.compileNode) {
        this.compileNode(node as Statement);
      }
      break;

    case "expression":
      console.log("Compiling expression:", node.type);
      if (this.expression) {
        this.expression.compileValue(node as Expression);
      }
      break;

    case "unknown":
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * More practical example: A generic compile function that routes to the correct compiler
 */
export function compileGenericNode(this: CompilerContext, node: Node): void {
  // Declarations and statements use the statement compiler
  if (isStatement(node)) {
    if (!this.compileNode) {
      throw new Error("Statement compiler not initialized");
    }
    this.compileNode(node as Statement);
    return;
  }

  // Expressions use the expression compiler
  if (isExpression(node)) {
    if (!this.expression) {
      throw new Error("Expression compiler not initialized");
    }
    this.expression.compileValue(node as Expression);
    return;
  }

  throw new Error(`Cannot compile node of type: ${node.type}`);
}
