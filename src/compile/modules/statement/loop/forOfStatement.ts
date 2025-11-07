import type { ForOfStatement } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";

const compileForOfStatement = function (this: CompilerContext, node: ForOfStatement): void {
  assertCompilerContext(this);

  registers.enterScope(); // Enter for-of loop scope

  const { key, startLabel, endLabel } = this.newLabel("for_of", true);
  const bodyLabel = `${key}_body`;
  const updateLabel = `${key}_update`;

  this.breakHandlerStack.push(endLabel);
  this.continueHandlerStack.push(updateLabel); // continue jumps to update section

  // Get the loop variable
  if (node.left.type !== "VariableDeclaration") {
    throw new Error("for-of loop variable must be a VariableDeclaration");
  }

  const [declarator] = node.left.declarations;
  assertIdentifier(declarator.id);

  const loopVarName = declarator.id.name;

  // For arrays, we iterate over values (arr[0], arr[1], arr[2], ...)
  assertIdentifier(node.right);
  const arrayInfo = registers.getArray(node.right.name);
  if (!arrayInfo) {
    throw new Error(`for-of requires an array, got ${node.right.name}`);
  }

  // Create an index register (not exposed to user)
  const indexReg = registers.next();
  this.emitInstruction("LDI", [indexReg, "0"], null, `index = 0`);

  // Get array length
  const lengthReg = registers.next();
  this.emitInstruction("LDI", [lengthReg, `${arrayInfo.size}`], null, `${node.right.name}.length`);

  // Allocate register for loop variable (this will hold the array value)
  const valueReg = registers.set(loopVarName);

  this.emitLabel(startLabel);

  // Check if index < length
  const compareReg = registers.next();
  this.emitInstruction(
    "SUB",
    [indexReg, lengthReg, compareReg],
    null,
    `index < ${node.right.name}.length`,
  );
  this.emitInstruction("BLT", [compareReg, "$zero", bodyLabel]);
  this.emitInstruction("JUMP", [endLabel]);

  this.emitLabel(bodyLabel);

  // Load array[index] into loop variable
  const baseReg = registers.next();
  this.emitInstruction("LDI", [baseReg, `${arrayInfo.base}`], null, `base of ${node.right.name}`);

  const offsetReg = registers.next();
  this.emitInstruction("ADD", [baseReg, indexReg, offsetReg], null, `${node.right.name} + index`);
  this.emitInstruction(
    "LOAD",
    [offsetReg, valueReg, "0"],
    node.right,
    `${loopVarName} = ${node.right.name}[index]`,
  );

  registers.free(baseReg);
  registers.free(offsetReg);

  // Execute loop body
  this.compileNode(node.body);

  this.emitLabel(updateLabel);

  // Increment index
  this.emitInstruction("ADDI", [indexReg, "1", indexReg], null, `index++`);
  this.emitInstruction("JUMP", [startLabel]);

  this.emitLabel(endLabel);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.free(indexReg);
  registers.free(lengthReg);
  registers.free(compareReg);

  registers.exitScope(); // Exit for-of loop scope
};

export default compileForOfStatement;
