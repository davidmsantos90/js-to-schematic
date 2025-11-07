import type { BinaryExpression, Expression } from "estree";

import {
  assertCompilerContext,
  CompileBinaryExpression,
  CompilerContext,
} from "../../../types/compile";
import registers from "../../memory/registers";
import compileValue from "./compileValue";

const beforeCompile = (node: BinaryExpression) => {
  let left = node.left as Expression;
  let right = node.right;
  let operator = node.operator;

  switch (operator) {
    case "===":
    case "==":
      operator = "==";
      break;

    case "!==":
    case "!=":
      operator = "!=";
      break;

    // Transform A <= B into B >= A
    case "<=":
      [left, right] = [right, left];
      operator = ">=";
      break;

    case ">=":
      break;

    // Transform A > B into B < A
    case ">":
      [left, right] = [right, left];
      operator = "<";
      break;

    case "<":
      break;

    default:
      throw new Error("Unsupported test operator: " + operator);
  }

  return { left, right, operator };
};

const compileBinaryExpression: CompileBinaryExpression = function (
  this: CompilerContext,
  node,
  labels,
): void {
  assertCompilerContext(this);

  const { left, right, operator } = beforeCompile(node);
  const { trueLabel, falseLabel } = labels;

  const leftReg = compileValue.call(this, left);
  const rightReg = compileValue.call(this, right);

  this.emitInstruction("CMP", [leftReg, rightReg], node);
  this.emitInstruction("BRANCH", [operator, trueLabel], null); // No comment - already on CMP
  this.emitInstruction("JUMP", [falseLabel]);

  // Free temporary registers used in comparison
  // Don't free if they're variables (Identifiers) - those need to persist
  if (left.type !== "Identifier") {
    registers.free(leftReg);
  }

  if (right.type !== "Identifier") {
    registers.free(rightReg);
  }
};

export default compileBinaryExpression;
