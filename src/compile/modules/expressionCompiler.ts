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

export type ExpressionCompiler = (context: CompilerContext) => {
  compileValue: CompileValueFn;
  compileComparison: CompileComparisonFn;
};

export const createExpressionCompiler: ExpressionCompiler = (context) => {
  const compileValue: CompileValueFn = (node, varName) => {
    const assignPrefix = varName ? `${varName} = ` : "";

    switch (node.type) {
      case "Identifier":
        return registers.get(node.name);

      case "Literal": {
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

        // caso geral reg + reg
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
    const left = compileValue(test.left as Expression);
    const right = compileValue(test.right);

    context.emitInstruction("CMP", [left, right], test);
    switch (test.operator) {
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
