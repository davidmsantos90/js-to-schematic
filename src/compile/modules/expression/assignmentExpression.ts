import { Expression, Literal } from "estree";

import { assertCompilerContext, CompilerContext } from "../../../types/compile";
import registers from "../../memory/registers";
import compileValue, { compileCallExpressionWithReturn } from "./compileValue";

// context will be bound externally

export function compileStringLiteralAssignment(
  this: CompilerContext,
  expression: Literal,
  name: string,
): void {
  assertCompilerContext(this);

  const { value } = expression;

  if (typeof value !== "string") {
    throw new Error(`Expected string literal for '${name}', got ${typeof value}`);
  }

  if (value.length > 10) {
    throw new Error(`String '${value}' exceeds maximum length of 10 characters`);
  }

  // Treat string as an array of character codes
  const allocation = registers.setString(name, value.length);

  // Load array base address once
  const baseReg = registers.next();
  this.emitInstruction("LDI", [baseReg, `${allocation.base}`], null, `${name}.base`);

  // Allocate a register for character values (reused)
  const valueReg = registers.next();

  // Store each character code using base address + offset
  for (let i = 0; i < allocation.size; i++) {
    const { [i]: char } = value;
    this.emitInstruction("LDI", [valueReg, `"${char}"`], null);

    const offset = i - allocation.offset;

    const operands = [baseReg, valueReg, `${offset}`];
    const comment = `${name}[${offset}] <- '${char}'`;

    this.emitInstruction("STORE", operands, null, comment);
  }

  // Free the registers after all stores
  registers.free(baseReg, valueReg);
}

export default function compileAssignmentExpression(
  this: CompilerContext,
  expression: Expression,
  name: string,
): void {
  assertCompilerContext(this);

  switch (expression.type) {
    case "ArrayExpression": {
      // Array initialization: let arr = [1, 2, 3]
      const elements = expression.elements;
      if (elements.some((el) => el == null)) {
        throw new Error("Sparse arrays are not supported");
      }

      const arrayInfo = registers.setArray(name, elements.length);

      // Load array base address once
      const baseReg = registers.next();
      this.emitInstruction("LDI", [baseReg, `${arrayInfo.base}`], null, `${name}.base`);

      // Allocate a register for element values (reused)
      const valueReg = registers.next();

      // Store each element using base address + offset
      // Hardware supports 4-bit signed offset: -8 to +7
      elements.forEach((element, index) => {
        if (!element) return; // Skip null elements (sparse arrays)

        // Load value into the reused register
        if (element.type === "Identifier") {
          const srcReg = registers.get(element.name);
          this.emitInstruction("MOVE", [srcReg, valueReg], element);
        } else if (element.type === "Literal") {
          // For literals, load directly into valueReg
          this.emitInstruction("LDI", [valueReg, `${element.value}`], null);
        } else {
          // For expressions, compile and move to valueReg
          const tempReg = compileValue.call(this, element as Expression);
          if (tempReg !== valueReg) {
            this.emitInstruction("MOVE", [tempReg, valueReg], null);
            registers.free(tempReg);
          }
        }

        const operands = [baseReg, valueReg, `${index - arrayInfo.offset}`];
        const comment = `${name}[${index}] <- `;

        // Store value at base + offset
        // Use offset directly in STORE instruction (more efficient)
        this.emitInstruction("STORE", operands, element, comment);
      });

      // Free the registers after all stores
      registers.free(baseReg, valueReg);

      break;
    }

    case "CallExpression": {
      compileCallExpressionWithReturn.call(this, expression);

      // Load return value from stack at [r15 + 1] into variable's register (r15 = STACK_POINTER)
      // const destinationReg = registers.set(name);
      // this.emitInstruction(
      //   "LOAD",
      //   [STACK_POINTER_REGISTER, destinationReg, "1"],
      //   expression,
      //   `${name} <- mem[SP + 1]`,
      // );
      break;
    }

    case "Identifier": {
      // caso: x = y or let x = constY
      // Check if source is a const variable (define-based)
      const constInfo = registers.getConst(expression.name);
      if (constInfo != null) {
        // Load const value using define name (assembler will substitute)
        const destinationReg = registers.set(name);
        this.emitInstruction("LDI", [destinationReg, expression.name], expression, `${name} = `);
        break;
      }

      // Regular register variable - will throw if it was a const (out of scope)
      const srcReg = registers.get(expression.name);
      if (!srcReg) throw new Error(`Variable ${expression.name} not defined`);

      const destinationReg = registers.set(name);
      this.emitInstruction("MOVE", [srcReg, destinationReg], expression, `${name} = `);
      break;
    }

    case "Literal": {
      // Check if it's a string literal
      if (typeof expression.value === "string") {
        compileStringLiteralAssignment.call(this, expression, name);
        break;
      }

      // else Fall through to default for all literals including 0
    }

    default: {
      registers.set(name, compileValue.call(this, expression, name));
    }
  }
}
