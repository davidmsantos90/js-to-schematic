import { DoWhileStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import { compileBinaryExpression } from "../../expression";

const beforeCompile = (node: DoWhileStatement) => {

};

const afterCompile = (node: DoWhileStatement) => {

};
const compileDoWhileStatement = function (this: CompilerContext, node: DoWhileStatement): void {
  const labels = this.newLabel("doWhile");

  this.breakHandlerStack.push(labels.after);
  this.continueHandlerStack.push(labels.body);

  this.emitLabel(labels.body);
  this.compileNode(node.body);

  this.emitLabel(labels.start);
  if (node.test.type === "BinaryExpression") {
    compileBinaryExpression.call(this, node.test, {
      trueLabel: labels.body,
      falseLabel: labels.after,
    });
  }

  this.emitLabel(labels.after);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();
};

export default function (this: CompilerContext, node: DoWhileStatement): void {
  assertCompilerContext(this);

  registers.enterScope();

  compileDoWhileStatement.call(this, node);

  registers.exitScope();
}
