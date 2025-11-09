import type { Program } from "estree";

import { createCompilerContext } from "./CompilerContext";

export default function compile(program: Program): string[] {
  const context = createCompilerContext();

  for (const node of program.body) {
    context.compileNode(node);
  }

  context.emitBlank();
  context.emitInstruction("HALT");

  return context.getAssembly();
}
