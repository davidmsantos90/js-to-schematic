import type { TryStatement } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import { STACK_POINTER_REGISTER } from "../../../../types/ISA";
import registers from "../../../memory/registers";

/**
 * Compiles a try-catch-finally statement
 * Structure:
 * - try block: normal execution
 * - catch block: executed if exception is thrown
 * - finally block: always executed (optional)
 *
 * Exception values are passed via the stack at [SP + 1] (same location as return values)
 */
const compileTryStatement = function (this: CompilerContext, node: TryStatement): void {
  assertCompilerContext(this);

  const { key, startLabel, endLabel } = this.newLabel("try", true);
  const catchLabel = `${key}_catch`;
  const finallyLabel = node.finalizer ? `${key}_finally` : null;
  const afterLabel = `${key}_after`;

  registers.enterScope(); // Enter try scope

  // Push catch handler onto error handler stack
  if (node.handler) {
    this.errorHandlerStack.push(catchLabel);
  }

  // Compile try block
  this.emitLabel(startLabel);
  this.compileNode(node.block);

  // Pop error handler - we're past the try block
  if (node.handler) {
    this.errorHandlerStack.pop();
  }

  // If no error occurred, skip catch and go to finally (or after)
  if (finallyLabel) {
    this.emitInstruction("JUMP", [finallyLabel], null, "No exception, skip to finally");
  } else {
    this.emitInstruction("JUMP", [afterLabel], null, "No exception, skip catch");
  }

  // Compile catch block
  if (node.handler) {
    this.emitLabel(catchLabel);

    registers.enterScope(); // Enter catch scope

    // Bind the exception to the catch parameter
    if (node.handler.param) {
      assertIdentifier(node.handler.param);
      const paramName = node.handler.param.name;

      // Load exception value from stack at [SP + 1]
      const paramReg = registers.set(paramName);
      this.emitInstruction(
        "LOAD",
        [STACK_POINTER_REGISTER, paramReg, "1"],
        null,
        `${paramName} <- mem[SP + 1] (exception)`,
      );
    }

    // Compile catch block body
    this.compileNode(node.handler.body);

    registers.exitScope(); // Exit catch scope

    // After catch, jump to finally (or after)
    if (finallyLabel) {
      this.emitInstruction("JUMP", [finallyLabel], null, "Jump to finally");
    } else {
      this.emitInstruction("JUMP", [afterLabel], null, "Exit try-catch");
    }
  }

  // Compile finally block
  if (node.finalizer && finallyLabel) {
    this.emitLabel(finallyLabel);

    registers.enterScope(); // Enter finally scope

    // Compile finally block body
    this.compileNode(node.finalizer);

    registers.exitScope(); // Exit finally scope
  }

  this.emitLabel(afterLabel);
  this.emitLabel(endLabel);

  registers.exitScope(); // Exit try scope
};

export default compileTryStatement;
