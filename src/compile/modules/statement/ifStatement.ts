import { IfStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../types/compile";
import compileBinaryExpression from "../expression/binaryExpression";

const compileIfStatement = function (this: CompilerContext, node: IfStatement): void {
  assertCompilerContext(this);

  const { key, startLabel, endLabel } = this.newLabel("if", true);
  const elseLabel = `${key}_else`;

  if (node.test.type === "BinaryExpression") {
    const falseLabel = node.alternate ? elseLabel : endLabel;
    compileBinaryExpression.call(this, node.test, { trueLabel: startLabel, falseLabel });
  }

  this.emitLabel(startLabel);
  this.compileNode(node.consequent);

  if (node.alternate) {
    this.emitInstruction("JUMP", [endLabel]);
    this.emitLabel(elseLabel);
    this.compileNode(node.alternate);
  }

  this.emitLabel(endLabel);
};

export default compileIfStatement;
