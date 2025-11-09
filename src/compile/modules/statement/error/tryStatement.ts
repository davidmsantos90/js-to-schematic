import type { TryStatement } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext, LabelType } from "../../../../types/compile";
import { STACK_POINTER_REGISTER } from "../../../../types/ISA";
import registers from "../../../memory/registers";

const compileCatchBlock = function (
  this: CompilerContext,
  node: TryStatement,
  labels: Record<string, LabelType | string>,
): void {
  if (!node.handler) return;

  this.emitLabel(labels.catch);

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
    if (node.finalizer != null) {
      this.emitInstruction("JUMP", [labels.finally], null, "Jump to finally");
    } else {
      this.emitInstruction("JUMP", [labels.after], null, "Exit try-catch");
    }
}

const compileFinallyBlock = function (
  this: CompilerContext,
  node: TryStatement,
  labels: Record<string, LabelType | string>,
): void {
  if (!node.finalizer) return;

  this.emitLabel(labels.finally);

  registers.enterScope(); // Enter finally scope

  // Compile finally block body
  this.compileNode(node.finalizer);

  registers.exitScope(); // Exit finally scope
};

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
  const labels = this.newLabel("try");

  // Push catch handler onto error handler stack
  if (node.handler) {
    this.errorHandlerStack.push(labels.catch);
  }

  // Compile try block
  this.emitLabel(labels.start);
  this.compileNode(node.block);

  // Pop error handler - we're past the try block
  if (node.handler) {
    this.errorHandlerStack.pop();
  }

  // If no error occurred, skip catch and go to finally (or after)
  if (node.finalizer != null) {
    this.emitInstruction("JUMP", [labels.finally], null, "No exception, skip to finally");
  } else {
    this.emitInstruction("JUMP", [labels.after], null, "No exception, skip catch");
  }

  // Compile catch block
  compileCatchBlock.call(this, node, labels);

  // Compile finally block
  compileFinallyBlock.call(this, node, labels);

  this.emitLabel(labels.after);
};

export default function (this: CompilerContext, node: TryStatement): void {
  assertCompilerContext(this);
  
  registers.enterScope();

  compileTryStatement.call(this, node);

  registers.exitScope();
}
