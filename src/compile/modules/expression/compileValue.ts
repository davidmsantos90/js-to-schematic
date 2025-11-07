import {
  BinaryExpression,
  CallExpression,
  Expression,
  Identifier,
  Literal,
  MemberExpression,
  UnaryExpression,
} from "estree";

import { assertIdentifier } from "../../../types/assembly";
import { assertCompilerContext, CompilerContext, CompileValue } from "../../../types/compile";
import { RegisterName, STACK_POINTER_REGISTER, ZERO_REGISTER } from "../../../types/ISA";
import registers from "../../memory/registers";
import { compileCallExpression } from "./callExpression";

const getValuePrefix = (varName: string | undefined, defaultValue = "") => {
  return varName ? `${varName} = ` : defaultValue;
};

const compileMemberValue = function (
  this: CompilerContext,
  node: MemberExpression,
  varName?: string,
): RegisterName {
  assertCompilerContext(this);
  assertIdentifier(node.object);

  const { object, property } = node;

  const arrayInfo = registers.getArray(object.name);
  if (!arrayInfo) {
    throw new Error(`${object.name} is not an array`);
  }

  // Check for array.length property access
  if (property.type === "Identifier" && property.name === "length") {
    // Load the array length as a literal value
    const lengthReg = registers.next();
    const operands = [lengthReg, `${arrayInfo.size}`];
    const comment = getValuePrefix(varName, `${object.name}.length`);

    this.emitInstruction("LDI", operands, node, comment);

    return lengthReg;
  }

  // Static index: arr[5]
  const isStaticIndex = property.type === "Literal";
  if (isStaticIndex) {
    const index = property.value as number;
    if (index < 0 || index >= arrayInfo.size) {
      throw new Error(
        `Array index ${index} out of bounds for ${object.name}[0..${arrayInfo.size - 1}]`,
      );
    }

    // Calculate actual memory address directly
    const address = arrayInfo.value + index;

    // Load value from memory address using a temp register for address
    const addrReg = registers.next();
    this.emitInstruction("LDI", [addrReg, `${address}`], node);

    const resultReg = registers.next();
    const comment = getValuePrefix(varName, `${object.name}[${index}]`);
    this.emitInstruction("LOAD", [addrReg, resultReg], node, comment);

    registers.free(addrReg);

    return resultReg;
  }

  // Dynamic index with simple identifier: arr[i]
  const isDynamicIndex = property.type === "Identifier";
  if (isDynamicIndex) {
    const offsetReg = registers.get(property.name);

    // Load array start address
    const addrReg = registers.next();
    this.emitInstruction("LDI", [addrReg, `${arrayInfo.base}`], null, `${object.name}.base`);

    // Calculate actual address: startAddress + index
    const finalAddrReg = registers.next();
    this.emitInstruction("ADD", [addrReg, offsetReg, finalAddrReg], null);

    // Load value from calculated address
    const resultReg = registers.next();
    const comment = getValuePrefix(varName, `${object.name}[${property.name}]`);
    this.emitInstruction("LOAD", [finalAddrReg, resultReg], node, comment);

    registers.free(addrReg, finalAddrReg);

    return resultReg;
  }

  // Expression in index: arr[i + 1] or arr[i - 1]
  const offsetReg = compileValue.call(this, node.property as Expression);

  // Load array start address
  const addrReg = registers.next();
  this.emitInstruction("LDI", [addrReg, `${arrayInfo.value}`], null, `${object.name}.base`);

  // Calculate actual address: startAddress + index
  const finalAddrReg = registers.next();
  this.emitInstruction("ADD", [addrReg, offsetReg, finalAddrReg], null);

  // Load value from calculated address - use astToSource for the full expression
  const resultReg = registers.next();
  const comment = getValuePrefix(varName, this.astToSource(node));
  this.emitInstruction("LOAD", [finalAddrReg, resultReg], node, comment);

  registers.free(offsetReg, addrReg, finalAddrReg);

  return resultReg;
};

const compileIdentifierValue = function (
  this: CompilerContext,
  node: Identifier,
  varName?: string,
): RegisterName {
  assertCompilerContext(this);

  // Check if this is a const variable in current scope
  const constInfo = registers.getConst(node.name);
  if (constInfo != null) {
    // Use the const as an immediate value (it will be substituted by the assembler)
    const reg = registers.next();
    const comment = getValuePrefix(varName, node.name);
    this.emitInstruction("LDI", [reg, node.name], node, comment);

    return reg;
  }

  // Regular register variable - will throw if it was a const (out of scope)
  return registers.get(node.name);
};

const compileLiteralValue = function (
  this: CompilerContext,
  node: Literal,
  varName: string | undefined,
  suppressComment = false,
): RegisterName {
  assertCompilerContext(this);

  // Optimize: use r0 (ZERO_REGISTER) for literal 0
  // BUT only if we're not assigning to a variable (varName would require a real register)
  if (node.value === 0 && !varName) {
    return ZERO_REGISTER;
  }

  const reg = registers.next();
  // For LDI in expressions, pass assignPrefix which includes "=" for direct assignment
  // or just empty for intermediate values. Suppress comment if requested (e.g., before STORE)
  const instructionNode = suppressComment ? null : node;
  const comment = getValuePrefix(varName);
  this.emitInstruction("LDI", [reg, node.value as string], instructionNode, comment);

  return reg;
};

const compileBinaryValue = function (
  this: CompilerContext,
  node: BinaryExpression,
  varName?: string,
): RegisterName {
  assertCompilerContext(this);

  const { left, right } = node;
  const assignPrefix = getValuePrefix(varName);

  // caso registo + literal
  if (left.type === "Identifier" && right.type === "Literal") {
    const leftReg = compileValue.call(this, left);

    // Only modify the register in place if we're assigning to that same variable
    // e.g., "x = x + 5" can become ADDI x 5
    // But "y = x + 5" or "arr[x + 1]" should not modify x
    const canModifyInPlace = varName === left.name;

    switch (node.operator) {
      case "+": {
        if (canModifyInPlace) {
          this.emitInstruction("ADDI", [leftReg, right.value as string], node, assignPrefix);
          return leftReg;
        }

        // Create a new register for the result
        const dest = registers.next();
        this.emitInstruction("MOVE", [leftReg, dest], null);
        this.emitInstruction("ADDI", [dest, right.value as string], node, assignPrefix);

        return dest;
      }

      case "-":
        if (canModifyInPlace) {
          this.emitInstruction("SUBI", [leftReg, right.value as string], node, assignPrefix);
          return leftReg;
        } else {
          // Create a new register for the result
          const dest = registers.next();
          this.emitInstruction("MOVE", [leftReg, dest], null);
          this.emitInstruction("SUBI", [dest, right.value as string], node, assignPrefix);
          return dest;
        }
      default:
        throw new Error("Unsupported binary op with literal: " + node.operator);
    }
  }

  // caso literal + registo
  if (left.type === "Literal" && right.type === "Identifier") {
    switch (node.operator) {
      case "+": {
        // lit + reg => reg + lit (commutative)
        const rightReg = compileValue.call(this, right);
        this.emitInstruction("ADDI", [rightReg, left.value as string], node, assignPrefix);

        return rightReg;
      }

      case "-": {
        // lit - reg: need to load literal first, then subtract
        // Cannot use SUBI here since that would be reg - lit, not lit - reg
        const leftReg = compileValue.call(this, left);
        const rightReg = compileValue.call(this, right);
        const dest = registers.next();

        this.emitInstruction("SUB", [leftReg, rightReg, dest], node, assignPrefix);

        registers.free(leftReg);

        return dest;
      }
      default:
        throw new Error("Unsupported literal+reg operator: " + node.operator);
    }
  }

  // caso geral reg + reg (includes CallExpression support)
  // Don't pass varName to sub-expressions - only the final result should have the assignment comment
  const leftReg = compileValue.call(this, left as Expression);
  const rightReg = compileValue.call(this, right);

  const dest = registers.get(varName);
  switch (node.operator) {
    case "+":
      this.emitInstruction("ADD", [leftReg, rightReg, dest], node, assignPrefix);
      break;
    case "-":
      this.emitInstruction("SUB", [leftReg, rightReg, dest], node, assignPrefix);
      break;
    default:
      throw new Error("Unsupported binary op: " + node.operator);
  }

  // Free temporary registers if they're not the destination and not variables
  if (leftReg !== dest && left.type !== "Identifier") {
    registers.free(leftReg);
  }

  if (rightReg !== dest && right.type !== "Identifier") {
    registers.free(rightReg);
  }

  return dest;
};

const compileUnaryValue = function (
  this: CompilerContext,
  node: UnaryExpression,
  varName?: string,
): RegisterName {
  assertCompilerContext(this);

  const assignPrefix = getValuePrefix(varName);

  const operandReg = compileValue.call(this, node.argument);
  const resultReg = registers.next();

  switch (node.operator) {
    case "-": {
      this.emitInstruction("LDI", [resultReg, "0"], node, assignPrefix);
      this.emitInstruction("SUB", [resultReg, operandReg, resultReg], node, assignPrefix);

      return resultReg;
    }

    case "!": {
      this.emitInstruction("CMP", [operandReg, ZERO_REGISTER], node);

      // This is a simplified logical NOT - would need proper boolean handling
      this.emitInstruction("LDI", [resultReg, "1"], node, assignPrefix);

      return resultReg;
    }

    default:
      throw new Error("Unsupported unary operator: " + node.operator);
  }
};

const compileValue: CompileValue = function (
  this: CompilerContext,
  node,
  varName,
  suppressComment = false,
) {
  assertCompilerContext(this);

  switch (node.type) {
    case "CallExpression":
      return compileCallExpressionWithReturn.call(this, node);

    case "MemberExpression":
      return compileMemberValue.call(this, node, varName);

    case "Identifier":
      return compileIdentifierValue.call(this, node, varName);

    case "Literal":
      return compileLiteralValue.call(this, node, varName, suppressComment);

    case "BinaryExpression":
      return compileBinaryValue.call(this, node, varName);

    case "UnaryExpression":
      return compileUnaryValue.call(this, node, varName);

    default:
      throw new Error("Unsupported node type in compileValue: " + node.type);
  }
};

export const compileCallExpressionWithReturn = function (
  this: CompilerContext,
  expression: CallExpression,
  commentPrefix?: string,
): RegisterName {
  assertCompilerContext(this);

  // Execute the call
  compileCallExpression.call(this, expression);

  // Load return value from stack at [r15 + 1] into a new register (r15 is still STACK_POINTER)
  const resultReg = registers.next();
  const operands = [STACK_POINTER_REGISTER, resultReg, "1"];

  const fullPrefix = commentPrefix
    ? `${commentPrefix.replace(/\s*=\s*$/, "")} <- mem[SP + 1]`
    : `mem[SP + 1]`;

  this.emitInstruction("LOAD", operands, expression, fullPrefix);

  return resultReg;
};

export default compileValue;
