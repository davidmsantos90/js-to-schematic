import { WhileStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import { compileBinaryExpression } from "../../expression";

const compileWhileStatement = function (this: CompilerContext, node: WhileStatement): void {
  const labels = this.newLabel("while");

  this.emitLabel(labels.start);
  this.breakHandlerStack.push(labels.after);
  this.continueHandlerStack.push(labels.start);

  if (node.test.type === "BinaryExpression") {
    compileBinaryExpression.call(this, node.test, {
      trueLabel: labels.body,
      falseLabel: labels.after,
    });
  }

  this.emitLabel(labels.body);
  this.compileNode(node.body);
  this.emitInstruction("JUMP", [labels.start]);

  this.emitLabel(labels.after);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();
};

export default function (this: CompilerContext, node: WhileStatement): void {
  assertCompilerContext(this);

  registers.enterScope();

  compileWhileStatement.call(this, node);

  registers.exitScope();
}
