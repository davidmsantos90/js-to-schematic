import type { BlockStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../types/compile";
import registers from "../../memory/registers";

export default function compile(this: CompilerContext, node: BlockStatement): void {
  assertCompilerContext(this);

  registers.enterScope();
  node.body.forEach(this.compileNode);
  registers.exitScope();
}
