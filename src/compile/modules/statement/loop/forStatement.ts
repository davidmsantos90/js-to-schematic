import { ForStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import { compileBinaryExpression, compileUpdateExpression } from "../../expression";

const compileForStatement = function (this: CompilerContext, node: ForStatement): void {
  if (node.init) {
    if (node.init.type === "VariableDeclaration") {
      this.compileNode(node.init);
    } else {
      // It's an expression, wrap it in ExpressionStatement
      this.compileNode({ type: "ExpressionStatement", expression: node.init });
    }
  }

  const labels = this.newLabel("for");
  this.breakHandlerStack.push(labels.after);
  this.continueHandlerStack.push(labels.update);

  this.emitLabel(labels.start);
  if (node.test && node.test.type === "BinaryExpression") {
    compileBinaryExpression.call(this, node.test, {
      trueLabel: labels.body,
      falseLabel: labels.after,
    });
  }

  this.emitLabel(labels.body);
  this.compileNode(node.body);

  this.emitLabel(labels.update);
  if (node.update) {
    if (node.update.type === "UpdateExpression") {
      compileUpdateExpression.call(this, node.update);
    } else {
      this.compileNode({ type: "ExpressionStatement", expression: node.update });
    }
  }
  this.emitInstruction("JUMP", [labels.start]);

  this.emitLabel(labels.after);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();
};

export default function (this: CompilerContext, node: ForStatement): void {
  assertCompilerContext(this);

  registers.enterScope();

  compileForStatement.call(this, node);

  registers.exitScope();
}
