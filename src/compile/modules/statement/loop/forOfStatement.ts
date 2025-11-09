import type { ForOfStatement } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";

const compileForOfStatement = function (this: CompilerContext, node: ForOfStatement): void {
  const { left: variable, right: iterable } = node;
  if (variable.type !== "VariableDeclaration") {
    throw new Error("for-of loop variable must be a VariableDeclaration");
  }

  const labels = this.newLabel("forOf");
  this.breakHandlerStack.push(labels.after);
  this.continueHandlerStack.push(labels.update);

  const [declarator] = variable.declarations;
  assertIdentifier(declarator.id);

  const loopVarName = declarator.id.name;

  // For arrays, we iterate over values (arr[0], arr[1], arr[2], ...)
  assertIdentifier(iterable);
  const arrayInfo = registers.getArray(iterable.name);
  if (!arrayInfo) {
    throw new Error(`for-of requires an array, got ${iterable.name}`);
  }

  // Create an index register (not exposed to user)
  const indexReg = registers.next();
  this.emitInstruction("LDI", [indexReg, "0"], null, `index = 0`);

  // Get array length
  const lengthReg = registers.next();
  this.emitInstruction("LDI", [lengthReg, `${arrayInfo.size}`], null, `${iterable.name}.length`);

  // Allocate register for loop variable (this will hold the array value)
  const valueReg = registers.set(loopVarName);

  this.emitLabel(labels.start);

  // Check if index < length
  const compareReg = registers.next();
  this.emitInstruction(
    "SUB",
    [indexReg, lengthReg, compareReg],
    null,
    `index < ${iterable.name}.length`,
  );
  this.emitInstruction("BLT", [compareReg, "$zero", labels.body]);
  this.emitInstruction("JUMP", [labels.after]);

  this.emitLabel(labels.body);

  // Load array[index] into loop variable
  const baseReg = registers.next();
  this.emitInstruction("LDI", [baseReg, `${arrayInfo.base}`], null, `base of ${iterable.name}`);

  const offsetReg = registers.next();
  this.emitInstruction("ADD", [baseReg, indexReg, offsetReg], null, `${iterable.name} + index`);
  this.emitInstruction(
    "LOAD",
    [offsetReg, valueReg, "0"],
    node.right,
    `${loopVarName} = ${iterable.name}[index]`,
  );

  registers.free(baseReg);
  registers.free(offsetReg);

  // Execute loop body
  this.compileNode(node.body);

  this.emitLabel(labels.update);

  // Increment index
  this.emitInstruction("ADDI", [indexReg, "1", indexReg], null, `index++`);
  this.emitInstruction("JUMP", [labels.start]);

  this.emitLabel(labels.after);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.free(indexReg);
  registers.free(lengthReg);
  registers.free(compareReg);
};

export default function (this: CompilerContext, node: ForOfStatement): void {
  assertCompilerContext(this);

  registers.enterScope();

  compileForOfStatement.call(this, node);

  registers.exitScope();
}
