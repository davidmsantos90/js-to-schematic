/**
 * INTEGRATION EXAMPLE: How to use node type detection in your compiler
 *
 * This file shows practical examples of integrating the node type detector
 * utilities into your existing compiler architecture.
 */
import type { Declaration, Expression, Node, Statement } from "estree";

import {
  getNodeCategory,
  isDeclaration,
  isExpression,
  isStatement,
} from "./src/compile/utils/nodeTypeDetector.js";
import type { CompilerContext } from "./src/types/compile.js";

// ============================================================================
// Example 1: Generic compile function that routes to the correct compiler
// ============================================================================

export function compileAnyNode(context: CompilerContext, node: Node): void {
  if (isStatement(node)) {
    // All statements (including declarations) go here
    if (!context.compileNode) {
      throw new Error("Statement compiler not initialized");
    }
    context.compileNode(node as Statement);
  } else if (isExpression(node)) {
    // All expressions go here
    if (!context.expression) {
      throw new Error("Expression compiler not initialized");
    }
    context.expression.compileValue(node as Expression);
  } else {
    throw new Error(`Unsupported node type: ${node.type}`);
  }
}

// ============================================================================
// Example 2: Separate handling for declarations vs other statements
// ============================================================================

export function compileWithDeclarationHandling(context: CompilerContext, node: Node): void {
  // Handle declarations separately if needed
  if (isDeclaration(node)) {
    const declaration = node as Declaration;

    switch (declaration.type) {
      case "FunctionDeclaration":
        console.log("Compiling function declaration:", declaration.id?.name);
        break;
      case "VariableDeclaration":
        console.log("Compiling variable declaration:", declaration.kind);
        break;
      case "ClassDeclaration":
        console.log("Compiling class declaration:", declaration.id?.name);
        break;
    }

    if (context.compileNode) {
      context.compileNode(declaration);
    }
  } else if (isStatement(node)) {
    // Handle other statements
    if (context.compileNode) {
      context.compileNode(node as Statement);
    }
  } else if (isExpression(node)) {
    // Handle expressions
    if (context.expression) {
      context.expression.compileValue(node as Expression);
    }
  } else {
    throw new Error(`Unknown node type: ${node.type}`);
  }
}

// ============================================================================
// Example 3: Using getNodeCategory for cleaner switch statements
// ============================================================================

export function compileUsingCategory(context: CompilerContext, node: Node): void {
  const category = getNodeCategory(node);

  switch (category) {
    case "declaration":
      // Handle declarations specifically
      console.log(`📝 Declaration: ${node.type}`);
      if (context.compileNode) {
        context.compileNode(node as Declaration);
      }
      break;

    case "statement":
      // Handle other statements
      console.log(`🔧 Statement: ${node.type}`);
      if (context.compileNode) {
        context.compileNode(node as Statement);
      }
      break;

    case "expression":
      // Handle expressions
      console.log(`💡 Expression: ${node.type}`);
      if (context.expression) {
        context.expression.compileValue(node as Expression);
      }
      break;

    case "unknown":
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

// ============================================================================
// Example 4: Array processing with type detection
// ============================================================================

export function compileNodeArray(context: CompilerContext, nodes: Node[]): void {
  const stats = {
    declarations: 0,
    statements: 0,
    expressions: 0,
  };

  for (const node of nodes) {
    // Gather statistics
    if (isDeclaration(node)) {
      stats.declarations++;
    } else if (isStatement(node)) {
      stats.statements++;
    } else if (isExpression(node)) {
      stats.expressions++;
    }

    // Compile the node
    compileAnyNode(context, node);
  }

  console.log("Compilation statistics:", stats);
}

// ============================================================================
// Example 5: Validation before compilation
// ============================================================================

export function validateAndCompile(context: CompilerContext, node: Node): void {
  // Validate node type before compilation
  if (!isStatement(node) && !isExpression(node)) {
    throw new Error(
      `Cannot compile node of type '${node.type}'. ` +
        `Only statements and expressions are supported.`,
    );
  }

  // Check if required compilers are available
  if (isExpression(node) && !context.expression) {
    throw new Error("Expression compiler is required but not initialized");
  }

  if (isStatement(node) && !context.compileNode) {
    throw new Error("Statement compiler is required but not initialized");
  }

  // Proceed with compilation
  compileAnyNode(context, node);
}

// ============================================================================
// Example 6: Type-safe helper for AST traversal
// ============================================================================

export function* walkNodes(node: Node): Generator<Node> {
  yield node;

  // Walk through different node structures
  if (isStatement(node)) {
    const stmt = node as Statement;

    switch (stmt.type) {
      case "BlockStatement":
        for (const child of stmt.body) {
          yield* walkNodes(child as Node);
        }
        break;

      case "IfStatement":
        yield* walkNodes(stmt.test as Node);
        yield* walkNodes(stmt.consequent as Node);
        if (stmt.alternate) {
          yield* walkNodes(stmt.alternate as Node);
        }
        break;

      // Add more cases as needed
    }
  }

  if (isExpression(node)) {
    const expr = node as Expression;

    switch (expr.type) {
      case "BinaryExpression":
        yield* walkNodes(expr.left as Node);
        yield* walkNodes(expr.right as Node);
        break;

      case "CallExpression":
        yield* walkNodes(expr.callee as Node);
        for (const arg of expr.arguments) {
          yield* walkNodes(arg as Node);
        }
        break;

      // Add more cases as needed
    }
  }
}

// Example usage of walkNodes
export function analyzeAST(rootNode: Node): void {
  const typeCount: Record<string, number> = {};

  for (const node of walkNodes(rootNode)) {
    typeCount[node.type] = (typeCount[node.type] || 0) + 1;
  }

  console.log("AST Node Type Distribution:");
  for (const [type, count] of Object.entries(typeCount)) {
    console.log(`  ${type}: ${count}`);
  }
}
