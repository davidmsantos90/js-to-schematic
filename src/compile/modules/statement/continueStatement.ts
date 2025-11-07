import { assertCompilerContext, CompilerContext } from "../../../types/compile";

const compileContinueStatement = function (this: CompilerContext): void {
  assertCompilerContext(this);

  const label = this.continueHandlerStack.peek();
  this.emitInstruction("JUMP", [label]);
};

export default compileContinueStatement;
