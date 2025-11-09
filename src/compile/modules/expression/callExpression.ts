import { CallExpression, Expression } from "estree";

import { assertIdentifier } from "../../../types/assembly";
import { assertCompilerContext, CompilerContext, LabelType } from "../../../types/compile";
import { STACK_POINTER_REGISTER } from "../../../types/ISA";
import registers from "../../memory/registers";
import compileValue from "./compileValue";

export const compileCallExpression = function (
  this: CompilerContext,
  expression: CallExpression,
): void {
  assertCompilerContext(this);

  const { callee } = expression;
  assertIdentifier(callee);

  // Store each argument to stack (r15 is already set to STACK_POINTER)
  // First arg at [r15+0], second at [r15-1], third at [r15-2], etc.
  for (let i = 0; i < expression.arguments.length; i++) {
    const arg = expression.arguments[i];
    const argReg = compileValue.call(this, arg as Expression);

    // STORE arg to stack, showing the expression being stored
    const operands = [STACK_POINTER_REGISTER, argReg];
    if (i > 0) {
      operands.push(`-${i}`);
    }

    const comment = `mem[SP${i > 0 ? " - " + i : ""}] <- `;

    this.emitInstruction("STORE", operands, arg as Expression, comment);

    // Free the register - it's no longer needed
    if (arg.type !== "Identifier") {
      registers.free(argReg);
    }
  }

  const labels = this.newLabel(callee.name as LabelType, false);
  this.emitInstruction("CALL", [labels.start], expression);
};

export default compileCallExpression;
