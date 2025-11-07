import { WhileStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import { compileBinaryExpression } from "../../expression";

const compileWhileStatement = function (this: CompilerContext, node: WhileStatement): void {
  assertCompilerContext(this);

  const { key, startLabel, endLabel } = this.newLabel("while", true);
  const bodyLabel = `${key}_body`;

  registers.enterScope(); // Enter loop scope

  this.breakHandlerStack.push(endLabel);
  this.continueHandlerStack.push(startLabel);

  this.emitLabel(startLabel);
  if (node.test.type === "BinaryExpression") {
    compileBinaryExpression.call(this, node.test, { trueLabel: bodyLabel, falseLabel: endLabel });
  }

  this.emitLabel(bodyLabel);
  this.compileNode(node.body);
  this.emitInstruction("JUMP", [startLabel]);

  this.emitLabel(endLabel);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.exitScope(); // Exit loop scope
};

export default compileWhileStatement;
