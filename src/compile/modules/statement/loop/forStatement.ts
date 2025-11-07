import { ForStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import { compileBinaryExpression, compileUpdateExpression } from "../../expression";

const compileForStatement = function (this: CompilerContext, node: ForStatement): void {
  assertCompilerContext(this);

  registers.enterScope(); // Enter for loop scope

  // Compile initialization
  if (node.init) {
    if (node.init.type === "VariableDeclaration") {
      this.compileNode(node.init);
    } else {
      // It's an expression, wrap it in ExpressionStatement
      this.compileNode({ type: "ExpressionStatement", expression: node.init });
    }
  }

  const { key, startLabel, endLabel } = this.newLabel("for", true);
  const bodyLabel = `${key}_body`;
  const updateLabel = `${key}_update`;

  this.breakHandlerStack.push(endLabel);
  this.continueHandlerStack.push(updateLabel); // continue jumps to update section

  this.emitLabel(startLabel);
  if (node.test && node.test.type === "BinaryExpression") {
    compileBinaryExpression.call(this, node.test, { trueLabel: bodyLabel, falseLabel: endLabel });
  }

  this.emitLabel(bodyLabel);
  this.compileNode(node.body);

  this.emitLabel(updateLabel);
  if (node.update) {
    if (node.update.type === "UpdateExpression") {
      compileUpdateExpression.call(this, node.update);
    } else {
      this.compileNode({ type: "ExpressionStatement", expression: node.update });
    }
  }
  this.emitInstruction("JUMP", [startLabel]);

  this.emitLabel(endLabel);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.exitScope(); // Exit for loop scope
};

export default compileForStatement;
