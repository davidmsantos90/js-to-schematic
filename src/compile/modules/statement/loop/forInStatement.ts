import type { ForInStatement } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";

const compileForInStatement = function (this: CompilerContext, node: ForInStatement): void {
  const { left: variable, right: iterable } = node;
  if (variable.type !== "VariableDeclaration") {
    throw new Error("for-in loop variable must be a VariableDeclaration");
  }

  const labels = this.newLabel("forIn");
  this.breakHandlerStack.push(labels.after);
  this.continueHandlerStack.push(labels.update);

  const [declarator] = variable.declarations;
  assertIdentifier(declarator.id);

  const loopVarName = declarator.id.name;

  // For arrays, we iterate over indices (0, 1, 2, ...)
  // For now, we only support iterating over array indices
  assertIdentifier(iterable);
  const arrayInfo = registers.getArray(iterable.name);
  if (!arrayInfo) {
    throw new Error(`for-in requires an array, got ${iterable.name}`);
  }

  // Initialize loop variable to 0
  const indexReg = registers.set(loopVarName);
  this.emitInstruction("LDI", [indexReg, "0"], null, `${loopVarName} = 0`);

  // Get array length
  const lengthReg = registers.next();
  this.emitInstruction("LDI", [lengthReg, `${arrayInfo.size}`], null, `${iterable.name}.length`);

  this.emitLabel(labels.start);

  // Check if index < length
  const compareReg = registers.next();
  this.emitInstruction(
    "SUB",
    [indexReg, lengthReg, compareReg],
    null,
    `${loopVarName} < ${iterable.name}.length`,
  );
  this.emitInstruction("BLT", [compareReg, "$zero", labels.body]);
  this.emitInstruction("JUMP", [labels.after]);

  this.emitLabel(labels.body);
  this.compileNode(node.body);

  this.emitLabel(labels.update); // Increment index
  this.emitInstruction("ADDI", [indexReg, "1", indexReg], null, `${loopVarName}++`);
  this.emitInstruction("JUMP", [labels.start]);

  this.emitLabel(labels.after);
  this.breakHandlerStack.pop();
  this.continueHandlerStack.pop();

  registers.free(indexReg);
  registers.free(lengthReg);
  registers.free(compareReg);
};

export default function (this: CompilerContext, node: ForInStatement): void {
  assertCompilerContext(this);

  registers.enterScope();

  compileForInStatement.call(this, node);

  registers.exitScope();
}
