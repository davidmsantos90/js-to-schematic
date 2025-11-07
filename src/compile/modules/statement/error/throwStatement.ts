import type { ThrowStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import { STACK_POINTER_REGISTER } from "../../../../types/ISA";
import compileValue from "../../expression/compileValue";

/**
 * Compiles a throw statement
 * If inside a try block, jumps to the nearest catch handler
 * Otherwise, halts execution with error information
 *
 * Exception values are passed via the stack at [SP + 1] (same location as return values)
 */
const compileThrowStatement = function (this: CompilerContext, node: ThrowStatement): void {
  assertCompilerContext(this);

  // Check if we're inside a try block
  if (this.errorHandlerStack.isEmpty()) {
    // No catch handler available - uncaught exception, halt execution
    this.emitInstruction("HALT", [], node.argument, `Uncaught: ${this.astToSource(node.argument)}`);
    return;
  }

  // Evaluate what's being thrown
  const errorValueReg = compileValue.call(this, node.argument);

  const catchLabel = this.errorHandlerStack.peek();

  // Store exception value at [SP + 1] (same as return value location)
  this.emitInstruction(
    "STORE",
    [STACK_POINTER_REGISTER, errorValueReg, "1"],
    node.argument,
    `mem[SP + 1] <- exception: ${this.astToSource(node.argument)}`,
  );

  // Jump to catch handler
  this.emitInstruction("JUMP", [catchLabel], null, "Jump to catch block");
};

export default compileThrowStatement;
