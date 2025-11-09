import { IfStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../types/compile";
import compileBinaryExpression from "../expression/binaryExpression";

const compileIfStatement = function (this: CompilerContext, node: IfStatement): void {
  assertCompilerContext(this);

  const labels = this.newLabel("if");

  if (node.test.type === "BinaryExpression") {
    const falseLabel = node.alternate ? labels.else : labels.after;
    compileBinaryExpression.call(this, node.test, { trueLabel: labels.start, falseLabel });
  }

  this.emitLabel(labels.start);
  this.compileNode(node.consequent);

  if (node.alternate) {
    this.emitInstruction("JUMP", [labels.after]);
    this.emitLabel(labels.else);
    this.compileNode(node.alternate);
  }

  this.emitLabel(labels.after);
};

export default compileIfStatement;
