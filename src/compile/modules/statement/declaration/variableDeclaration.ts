import { Expression, VariableDeclaration } from "estree";

import { assertIdentifier } from "../../../../types/assembly";
import { assertCompilerContext, CompilerContext } from "../../../../types/compile";
import registers from "../../../memory/registers";
import compileAssignmentExpression from "../../expression/assignmentExpression";

const compileConstDeclaration = function (
  this: CompilerContext,
  name: string,
  init: Expression,
): void {
  assertCompilerContext(this);

  // Only support literal values for const
  if (init.type !== "Literal") {
    throw new Error(`Const '${name}' must be initialized with a literal value`);
  }

  // Register the const with its value
  const value = init.value as string | number;
  registers.setConst(name, value);

  // Emit define directive
  this.emitDefine(name, value);
};

const compileVariableDeclaration = function (
  this: CompilerContext,
  node: VariableDeclaration,
): void {
  assertCompilerContext(this);

  const isConst = node.kind === "const";

  for (const { id, init } of node.declarations) {
    assertIdentifier(id);

    if (isConst) {
      // Const variables are defined at compile-time
      compileConstDeclaration.call(this, id.name, init!);
    } else {
      // Let variables use registers (current behavior)
      compileAssignmentExpression.call(this, init!, id.name);
    }
  }
};

export default compileVariableDeclaration;
