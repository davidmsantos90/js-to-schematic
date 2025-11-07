import { FunctionDeclaration } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import { STACK_POINTER_REGISTER } from "../../../../types/ISA";
import registers from "../../../memory/registers";
import compileReturnStatement from "../returnStatement";

const compileFunctionDeclaration = function (
  this: CompilerContext,
  node: FunctionDeclaration,
): void {
  assertCompilerContext(this);

  const fnName = node.id!.name;
  const { startLabel, endLabel } = this.newLabel(fnName);

  this.emitInstruction("JUMP", [endLabel]); // don't execute function body on declaration

  this.emitLabel(startLabel);

  // Load parameters from stack into registers (r15 = STACK_POINTER)
  // First param at [r15+0], second at [r15-1], third at [r15-2], etc.
  node.params.forEach((param, index) => {
    assertIdentifier(param);
    const paramName = param.name;
    const paramReg = registers.set(paramName);

    // Calculate offset: first param at 0, second at -1, etc.
    const operands = [STACK_POINTER_REGISTER, paramReg];
    if (index > 0) {
      operands.push(`-${index}`);
    }

    const comment = `${paramName} <- mem[SP${index > 0 ? " - " + index : ""}]`;

    this.emitInstruction("LOAD", operands, null, comment);
  });

  this.compileNode(node.body);

  if (node.body.body.every(({ type }) => type !== "ReturnStatement")) {
    compileReturnStatement.call(this);
  }

  this.emitLabel(endLabel);
};

export default compileFunctionDeclaration;
