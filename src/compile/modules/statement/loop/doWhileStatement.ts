import { DoWhileStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import { compileBinaryExpression } from "../../expression";

const compileDoWhileStatement = function (this: CompilerContext, node: DoWhileStatement): void {
  assertCompilerContext(this);

  registers.enterScope(); // Enter do-while loop scope

  const { key, startLabel, endLabel } = this.newLabel("dowhile", true);
  const bodyLabel = `${key}_body`;

  this.breakHandlerStack.push(endLabel);
  this.continueHandlerStack.push(bodyLabel); // continue jumps to body start

  this.emitLabel(bodyLabel);
  this.compileNode(node.body);

  this.emitLabel(startLabel);
  if (node.test.type === "BinaryExpression") {
    compileBinaryExpression.call(this, node.test, { trueLabel: bodyLabel, falseLabel: endLabel });
  }

  this.emitLabel(endLabel);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.exitScope(); // Exit do-while loop scope
};

export default compileDoWhileStatement;
