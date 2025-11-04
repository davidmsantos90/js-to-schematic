import type { BinaryExpression, Expression, MemberExpression, Node, UnaryExpression } from "estree";
import { RegisterName, ZERO_REGISTER } from "../../types/ISA.js";
import { assertIdentifier } from "../../types/assembly.js";
import registers from "../memory/registers.js";
import type { CompilerContext } from "../CompilerContext.js";

export type CompileValueFn = (
  node: Expression,
  varName?: string,
  suppressComment?: boolean,
) => RegisterName;
export type CompileComparisonFn = (
  test: BinaryExpression,
  trueLabel: string,
  falseLabel: string,
) => void;
export type CompileCallExpressionWithReturnFn = (
  callExpr: any,
  commentPrefix?: string,
) => RegisterName;

export type ExpressionCompiler = (
  context: CompilerContext,
  compileCallExpressionWithReturn?: CompileCallExpressionWithReturnFn,
) => {
  compileValue: CompileValueFn;
  compileComparison: CompileComparisonFn;
};

export const createExpressionCompiler: ExpressionCompiler = (
  context,
  compileCallExpressionWithReturn,
) => {
  const compileValue: CompileValueFn = (node, varName, suppressComment = false) => {
    const assignPrefix = varName ? `${varName} = ` : "";

    switch (node.type) {
      case "CallExpression": {
        if (!compileCallExpressionWithReturn) {
          throw new Error(
            "CallExpression in value context requires compileCallExpressionWithReturn",
          );
        }
        return compileCallExpressionWithReturn(node);
      }

      case "MemberExpression": {
        assertIdentifier(node.object);
        const objectName = node.object.name;

        // Check for array.length property access
        if (node.property.type === "Identifier" && node.property.name === "length") {
          const arrayInfo = registers.getArray(objectName);
          if (!arrayInfo) {
            throw new Error(`${objectName} is not an array`);
          }

          // Load the array length as a literal value
          const lengthReg = registers.next();
          context.emitInstruction(
            "LDI",
            [lengthReg, `${arrayInfo.size}`],
            node,
            assignPrefix || `${objectName}.length`,
          );
          return lengthReg;
        }

        // Array access: arr[index]
        const arrayInfo = registers.getArray(objectName);

        if (!arrayInfo) {
          throw new Error(`${objectName} is not an array`);
        }

        let offsetReg: RegisterName;
        if (node.property.type === "Literal") {
          // Static index: arr[5]
          const index = node.property.value as number;
          if (index < 0 || index >= arrayInfo.size) {
            throw new Error(
              `Array index ${index} out of bounds for ${objectName}[0..${arrayInfo.size - 1}]`,
            );
          } // Calculate actual memory address directly
          const address = arrayInfo.value + index;

          // Load value from memory address using a temp register for address
          const addrReg = registers.next();
          const resultReg = registers.next();
          context.emitInstruction("LDI", [addrReg, `${address}`], node);
          context.emitInstruction(
            "LOAD",
            [addrReg, resultReg],
            node,
            assignPrefix || `${objectName}[${index}]`,
          );
          registers.free(addrReg);
          return resultReg;
        } else if (node.property.type === "Identifier") {
          // Dynamic index with simple identifier: arr[i]
          offsetReg = registers.get(node.property.name);

          // Load array start address
          const addrReg = registers.next();
          context.emitInstruction(
            "LDI",
            [addrReg, `${arrayInfo.value}`],
            null,
            `${objectName}.base`,
          );

          // Calculate actual address: startAddress + index
          const finalAddrReg = registers.next();
          context.emitInstruction("ADD", [addrReg, offsetReg, finalAddrReg], null);

          // Load value from calculated address
          const resultReg = registers.next();
          context.emitInstruction(
            "LOAD",
            [finalAddrReg, resultReg],
            node,
            assignPrefix || `${objectName}[${node.property.name}]`,
          );

          registers.free(addrReg, finalAddrReg);
          return resultReg;
        } else {
          // Expression in index: arr[i + 1] or arr[i - 1]
          offsetReg = compileValue(node.property as Expression);

          // Load array start address
          const addrReg = registers.next();
          context.emitInstruction(
            "LDI",
            [addrReg, `${arrayInfo.value}`],
            null,
            `${objectName}.base`,
          );

          // Calculate actual address: startAddress + index
          const finalAddrReg = registers.next();
          context.emitInstruction("ADD", [addrReg, offsetReg, finalAddrReg], null);

          // Load value from calculated address - use astToSource for the full expression
          const resultReg = registers.next();
          context.emitInstruction(
            "LOAD",
            [finalAddrReg, resultReg],
            node,
            assignPrefix || context.astToSource(node),
          );

          registers.free(offsetReg, addrReg, finalAddrReg);
          return resultReg;
        }
      }

      case "Identifier": {
        // Check if this is a const variable in current scope
        const constInfo = registers.getConst(node.name);
        if (constInfo != null) {
          // Use the const as an immediate value (it will be substituted by the assembler)
          const reg = registers.next();
          context.emitInstruction("LDI", [reg, node.name], node, assignPrefix || node.name);
          return reg;
        }

        // Regular register variable - will throw if it was a const (out of scope)
        return registers.get(node.name);
      }

      case "Literal": {
        // Optimize: use r0 (ZERO_REGISTER) for literal 0
        // BUT only if we're not assigning to a variable (varName would require a real register)
        if (node.value === 0 && !varName) {
          return ZERO_REGISTER;
        }

        const reg = registers.next();
        // For LDI in expressions, pass assignPrefix which includes "=" for direct assignment
        // or just empty for intermediate values. Suppress comment if requested (e.g., before STORE)
        context.emitInstruction(
          "LDI",
          [reg, node.value as string],
          suppressComment ? null : node,
          assignPrefix,
        );
        return reg;
      }

      case "BinaryExpression": {
        const { left, right } = node;

        // caso registo + literal
        if (left.type === "Identifier" && right.type === "Literal") {
          const leftReg = compileValue(left);

          // Only modify the register in place if we're assigning to that same variable
          // e.g., "x = x + 5" can become ADDI x 5
          // But "y = x + 5" or "arr[x + 1]" should not modify x
          const canModifyInPlace = varName === left.name;

          switch (node.operator) {
            case "+":
              if (canModifyInPlace) {
                context.emitInstruction(
                  "ADDI",
                  [leftReg, right.value as string],
                  node,
                  assignPrefix,
                );
                return leftReg;
              } else {
                // Create a new register for the result
                const dest = registers.next();
                context.emitInstruction("MOVE", [leftReg, dest], null);
                context.emitInstruction("ADDI", [dest, right.value as string], node, assignPrefix);
                return dest;
              }
            case "-":
              if (canModifyInPlace) {
                context.emitInstruction(
                  "SUBI",
                  [leftReg, right.value as string],
                  node,
                  assignPrefix,
                );
                return leftReg;
              } else {
                // Create a new register for the result
                const dest = registers.next();
                context.emitInstruction("MOVE", [leftReg, dest], null);
                context.emitInstruction("SUBI", [dest, right.value as string], node, assignPrefix);
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
              const rightReg = compileValue(right);
              context.emitInstruction("ADDI", [rightReg, left.value as string], node, assignPrefix);
              return rightReg;
            }
            case "-": {
              // lit - reg: need to load literal first, then subtract
              // Cannot use SUBI here since that would be reg - lit, not lit - reg
              const leftReg = compileValue(left);
              const rightReg = compileValue(right);
              const dest = registers.next();
              context.emitInstruction("SUB", [leftReg, rightReg, dest], node, assignPrefix);
              registers.free(leftReg);
              return dest;
            }
            default:
              throw new Error("Unsupported literal+reg operator: " + node.operator);
          }
        }

        // caso geral reg + reg (includes CallExpression support)
        // Don't pass varName to sub-expressions - only the final result should have the assignment comment
        const leftReg = compileValue(left as Expression);
        const rightReg = compileValue(right);

        const dest = registers.get(varName);
        switch (node.operator) {
          case "+":
            context.emitInstruction("ADD", [leftReg, rightReg, dest], node, assignPrefix);
            break;
          case "-":
            context.emitInstruction("SUB", [leftReg, rightReg, dest], node, assignPrefix);
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
      }

      case "UnaryExpression": {
        const operandReg = compileValue(node.argument);

        switch (node.operator) {
          case "-": {
            const resultReg = registers.next();
            context.emitInstruction("LDI", [resultReg, "0"], node, assignPrefix);
            context.emitInstruction("SUB", [resultReg, operandReg, resultReg], node, assignPrefix);
            return resultReg;
          }
          case "!": {
            const resultReg = registers.next();
            context.emitInstruction("CMP", [operandReg, ZERO_REGISTER], node);
            // This is a simplified logical NOT - would need proper boolean handling
            context.emitInstruction("LDI", [resultReg, "1"], node, assignPrefix);
            return resultReg;
          }
          default:
            throw new Error("Unsupported unary operator: " + node.operator);
        }
      }

      default:
        throw new Error("Unsupported node type in compileValue: " + node.type);
    }
  };

  const compileComparison: CompileComparisonFn = (test, trueLabel, falseLabel) => {
    let left = test.left as Expression;
    let right = test.right;
    let operator = test.operator;

    // Transform > and <= by swapping operands
    // A > B becomes B < A
    // A <= B becomes B >= A
    if (operator === ">" || operator === "<=") {
      [left, right] = [right, left];
      operator = operator === ">" ? "<" : ">=";
    }

    const leftReg = compileValue(left);
    const rightReg = compileValue(right);

    context.emitInstruction("CMP", [leftReg, rightReg], test);
    switch (operator) {
      case "===":
      case "==":
        context.emitInstruction("BRANCH", ["==", trueLabel], null); // No comment - already on CMP
        break;

      case "!==":
      case "!=":
        context.emitInstruction("BRANCH", ["!=", trueLabel], null); // No comment - already on CMP
        break;

      case ">=":
        context.emitInstruction("BRANCH", [">=", trueLabel], null); // No comment - already on CMP
        break;

      case "<":
        context.emitInstruction("BRANCH", ["<", trueLabel], null); // No comment - already on CMP
        break;

      default:
        throw new Error("Unsupported test operator: " + test.operator);
    }

    context.emitInstruction("JUMP", [falseLabel]);

    // Free temporary registers used in comparison
    // Don't free if they're variables (Identifiers) - those need to persist
    if (left.type !== "Identifier") {
      registers.free(leftReg);
    }
    if (right.type !== "Identifier") {
      registers.free(rightReg);
    }
  };

  return { compileValue, compileComparison };
};
