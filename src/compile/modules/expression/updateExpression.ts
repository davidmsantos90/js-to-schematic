import { UpdateExpression } from "estree";

import { assertIdentifier } from "../../../types/assembly";
import { CompilerContext } from "../../../types/compile";
import registers from "../../memory/registers";

const compileUpdateExpression = function (this: CompilerContext, node: UpdateExpression): void {
  assertIdentifier(node.argument);

  const reg = registers.get(node.argument.name);

  switch (node.operator) {
    case "++":
      this.emitInstruction("ADDI", [reg, "1"], node);
      break;

    case "--":
      this.emitInstruction("SUBI", [reg, "1"], node);
      break;

    default:
      throw new Error("Unsupported update operator: " + node.operator);
  }
};

export default compileUpdateExpression;
