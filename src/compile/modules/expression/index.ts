import type { Expression } from "estree";

import { assertCompilerContext, CompilerContext, ExpressionCompiler } from "../../../types/compile";
import compileAssignmentExpression from "./assignmentExpression";
import compileBinaryExpression from "./binaryExpression";
import { compileCallExpression } from "./callExpression";
import compileValue from "./compileValue";
import compileUpdateExpression from "./updateExpression";

export {
  compileValue,
  compileBinaryExpression,
  compileAssignmentExpression,
  compileUpdateExpression,
  compileCallExpression,
};

export type CreateExpressionCompiler = (context: CompilerContext) => ExpressionCompiler;

export default function compile(this: CompilerContext, node: Expression): void {
  // assertCompilerContext(this);
  // switch (node.type) {
  //   case "BinaryExpression":
  //     compileBinaryExpression.call(this, node);
  //     break;
  //   // Add more cases for different expression types as needed
  //   default:
  //     throw new Error(`Unknown expression type: ${node.type}`);
  // }
}
