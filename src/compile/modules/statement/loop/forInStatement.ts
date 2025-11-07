import type { ForInStatement } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";

const compileForInStatement = function (this: CompilerContext, node: ForInStatement): void {
  assertCompilerContext(this);

  registers.enterScope(); // Enter for-in loop scope

  const { key, startLabel, endLabel } = this.newLabel("for_in", true);
  const bodyLabel = `${key}_body`;
  const updateLabel = `${key}_update`;

  this.breakHandlerStack.push(endLabel);
  this.continueHandlerStack.push(updateLabel); // continue jumps to update section

  // Get the loop variable
  if (node.left.type !== "VariableDeclaration") {
    throw new Error("for-in loop variable must be a VariableDeclaration");
  }

  const declarator = node.left.declarations[0];
  assertIdentifier(declarator.id);
  const loopVarName = declarator.id.name;

  // For arrays, we iterate over indices (0, 1, 2, ...)
  // For now, we only support iterating over array indices
  assertIdentifier(node.right);
  const arrayInfo = registers.getArray(node.right.name);
  if (!arrayInfo) {
    throw new Error(`for-in requires an array, got ${node.right.name}`);
  }

  // Initialize loop variable to 0
  const indexReg = registers.set(loopVarName);
  this.emitInstruction("LDI", [indexReg, "0"], null, `${loopVarName} = 0`);

  // Get array length
  const lengthReg = registers.next();
  this.emitInstruction("LDI", [lengthReg, `${arrayInfo.size}`], null, `${node.right.name}.length`);

  this.emitLabel(startLabel);

  // Check if index < length
  const compareReg = registers.next();
  this.emitInstruction(
    "SUB",
    [indexReg, lengthReg, compareReg],
    null,
    `${loopVarName} < ${node.right.name}.length`,
  );
  this.emitInstruction("BLT", [compareReg, "$zero", bodyLabel]);
  this.emitInstruction("JUMP", [endLabel]);

  this.emitLabel(bodyLabel);
  this.compileNode(node.body);

  this.emitLabel(updateLabel);
  // Increment index
  this.emitInstruction("ADDI", [indexReg, "1", indexReg], null, `${loopVarName}++`);
  this.emitInstruction("JUMP", [startLabel]);

  this.emitLabel(endLabel);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.free(indexReg);
  registers.free(lengthReg);
  registers.free(compareReg);
  registers.exitScope(); // Exit for-in loop scope
};

export default compileForInStatement;
