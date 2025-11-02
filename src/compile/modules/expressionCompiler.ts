import type {
  BinaryExpression,
  Expression,
  Node,
  UnaryExpression,
} from "estree";
import { RegisterName, ZERO_REGISTER } from "../../types/ISA.js";
import { assertIdentifier } from "../../types/assembly.js";
import registers from "../registers.js";
import type { CompilerContext } from "../CompilerContext.js";

export type CompileValueFn = (node: Expression, varName?: string) => RegisterName;
export type CompileComparisonFn = (test: BinaryExpression, trueLabel: string, falseLabel: string) => void;
export type CompileCallExpressionWithReturnFn = (callExpr: any) => RegisterName;

export type ExpressionCompiler = (
  context: CompilerContext,
  compileCallExpressionWithReturn?: CompileCallExpressionWithReturnFn
) => {
  compileValue: CompileValueFn;
  compileComparison: CompileComparisonFn;
};

export const createExpressionCompiler: ExpressionCompiler = (context, compileCallExpressionWithReturn) => {
  const compileValue: CompileValueFn = (node, varName) => {
    const assignPrefix = varName ? `${varName} = ` : "";

    switch (node.type) {
      case "CallExpression": {
        if (!compileCallExpressionWithReturn) {
          throw new Error("CallExpression in value context requires compileCallExpressionWithReturn");
        }
        return compileCallExpressionWithReturn(node);
      }

      case "Identifier":
        return registers.get(node.name);

      case "Literal": {
        // Optimize: use r0 (ZERO_REGISTER) for literal 0
        // BUT only if we're not assigning to a variable (varName would require a real register)
        if (node.value === 0 && !varName) {
          return ZERO_REGISTER;
        }
        
        const reg = registers.next();
        context.emitInstruction("LDI", [reg, node.value as string], node, assignPrefix);
        return reg;
      }

      case "BinaryExpression": {
        const { left, right } = node;

        // caso registo + literal
        if (left.type === "Identifier" && right.type === "Literal") {
          const leftReg = compileValue(left);

          switch (node.operator) {
            case "+":
              context.emitInstruction("ADDI", [leftReg, right.value as string], node, assignPrefix);
              return leftReg;
            case "-":
              context.emitInstruction("SUBI", [leftReg, right.value as string], node, assignPrefix);
              return leftReg;
            default:
              throw new Error("Unsupported binary op with literal: " + node.operator);
          }
        }

        // caso literal + registo
        if (left.type === "Literal" && right.type === "Identifier") {
          const rightReg = compileValue(right);

          switch (node.operator) {
            case "+":
              context.emitInstruction("ADDI", [rightReg, left.value as string], node, assignPrefix);
              return rightReg;
            case "-":
              context.emitInstruction("SUBI", [rightReg, left.value as string], node, assignPrefix);
              return rightReg;
            default:
              throw new Error("Unsupported literal+reg operator: " + node.operator);
          }
        }

        // caso geral reg + reg (includes CallExpression support)
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
        context.emitInstruction("BRANCH", ["==", trueLabel], test);
        break;

      case "!==":
      case "!=":
        context.emitInstruction("BRANCH", ["!=", trueLabel], test);
        break;

      case ">=":
        context.emitInstruction("BRANCH", [">=", trueLabel], test);
        break;

      case "<":
        context.emitInstruction("BRANCH", ["<", trueLabel], test);
        break;

      default:
        throw new Error("Unsupported test operator: " + test.operator);
    }

    context.emitInstruction("JUMP", [falseLabel]);
  };

  return { compileValue, compileComparison };
};
