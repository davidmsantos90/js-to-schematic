import type { SwitchStatement } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../types/compile";
import registers from "../../memory/registers";
import compileValue from "../expression/compileValue";

const compileSwitchStatement = function (this: CompilerContext, node: SwitchStatement): void {
  assertCompilerContext(this);

  const { key, startLabel, endLabel } = this.newLabel("switch", true);

  registers.enterScope(); // Enter switch scope

  this.breakHandlerStack.push(endLabel); // break jumps to end

  // Compile the discriminant (the value being switched on)
  const discriminantReg = compileValue.call(this, node.discriminant, "switch");

  this.emitLabel(startLabel);

  // Generate labels for each case
  const caseLabels = node.cases.map((_, index) => `${key}_case_${index}`);
  const defaultLabel = node.cases.some((c) => c.test == null)
    ? caseLabels[node.cases.findIndex((c) => c.test == null)]
    : endLabel;

  // Compare discriminant with each case test
  for (let i = 0; i < node.cases.length; i++) {
    const caseNode = node.cases[i];

    if (caseNode.test != null) {
      // Compile the case test value
      const testReg = compileValue.call(this, caseNode.test);

      // Compare discriminant === test
      const compareReg = registers.next();
      this.emitInstruction("SUB", [discriminantReg, testReg, compareReg]);

      // If equal (result is zero), jump to this case
      this.emitInstruction("BEQ", [compareReg, "$zero", caseLabels[i]]);

      registers.free(testReg);
      registers.free(compareReg);
    }
  }

  // If no case matched, jump to default (or end if no default)
  this.emitInstruction("JUMP", [defaultLabel]);

  // Compile case bodies
  for (let i = 0; i < node.cases.length; i++) {
    const caseNode = node.cases[i];

    this.emitLabel(caseLabels[i]);

    // Compile all consequent statements
    for (const statement of caseNode.consequent) {
      this.compileNode(statement);
    }

    // Fall through to next case (unless there's a break statement)
    if (i < node.cases.length - 1) {
      // If no break was encountered, execution continues to next case
    }
  }

  this.emitLabel(endLabel);
  this.breakHandlerStack.pop();

  registers.free(discriminantReg);
  registers.exitScope(); // Exit switch scope
};

export default compileSwitchStatement;
