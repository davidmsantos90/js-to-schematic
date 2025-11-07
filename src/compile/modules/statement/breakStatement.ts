import { assertCompilerContext, CompilerContext } from "../../../types/compile";

const compileBreakStatement = function (this: CompilerContext): void {
  assertCompilerContext(this);

  const label = this.breakHandlerStack.peek();
  this.emitInstruction("JUMP", [label]);
};

export default compileBreakStatement;
