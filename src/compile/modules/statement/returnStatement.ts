import type { ReturnStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../types/compile";
import { STACK_POINTER_REGISTER } from "../../../types/ISA";
import compileValue from "../expression/compileValue";

const compileReturnStatement = function (this: CompilerContext, statement?: ReturnStatement): void {
  assertCompilerContext(this);

  if (statement?.argument) {
    const valueReg = compileValue.call(this, statement.argument);

    // Store return value at [r15 + 1] (r15 = STACK_POINTER), showing the expression being stored
    this.emitInstruction(
      "STORE",
      [STACK_POINTER_REGISTER, valueReg, "1"],
      statement.argument,
      `mem[SP + 1] <- `,
    );
  }

  // Put the return comment only on the RET instruction (astToSource already adds "return")
  this.emitInstruction("RET", [], statement);
};

export default compileReturnStatement;
