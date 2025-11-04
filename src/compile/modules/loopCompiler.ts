import type {
  DoWhileStatement,
  Expression,
  ForStatement,
  Statement,
  UpdateExpression,
  WhileStatement,
} from "estree";
import { assertIdentifier } from "../../types/assembly.js";
import registers from "../memory/registers.js";

import type { CompilerContext } from "../CompilerContext.js";
import type { CompileValueFn, CompileComparisonFn } from "./expressionCompiler.js";

export type CompileStatementFn = (statement: Statement) => void;

export type LoopCompiler = (
  context: CompilerContext,
  dependencies: {
    compileComparison: CompileComparisonFn;
    compileStatement: CompileStatementFn;
  },
) => {
  compileWhileStatement: (node: WhileStatement) => void;
  compileForStatement: (node: ForStatement) => void;
  compileDoWhileStatement: (node: DoWhileStatement) => void;
  compileBreakStatement: () => void;
  compileContinueStatement: () => void;
  compileUpdateExpression: (node: UpdateExpression) => void;
};

export const createLoopCompiler: LoopCompiler = (
  context: CompilerContext,
  { compileComparison, compileStatement },
) => {
  const compileWhileStatement = (node: WhileStatement): void => {
    const { key, startLabel, endLabel } = context.newLabel("while", true);
    const bodyLabel = `${key}_body`;

    registers.enterScope(); // Enter loop scope

    context.loopEndStack.push(endLabel);
    context.loopStartStack.push(startLabel);

    context.emitLabel(startLabel);
    if (node.test.type === "BinaryExpression") {
      compileComparison(node.test, bodyLabel, endLabel);
    }

    context.emitLabel(bodyLabel);
    compileStatement(node.body);
    context.emitInstruction("JUMP", [startLabel]);

    context.emitLabel(endLabel);
    context.loopEndStack.pop();
    context.loopStartStack.pop();

    registers.exitScope(); // Exit loop scope
  };

  const compileForStatement = (node: ForStatement): void => {
    registers.enterScope(); // Enter for loop scope

    // Compile initialization
    if (node.init) {
      if (node.init.type === "VariableDeclaration") {
        compileStatement(node.init);
      } else {
        // It's an expression, wrap it in ExpressionStatement
        compileStatement({ type: "ExpressionStatement", expression: node.init });
      }
    }

    const { key, startLabel, endLabel } = context.newLabel("for", true);
    const bodyLabel = `${key}_body`;
    const updateLabel = `${key}_update`;

    context.loopEndStack.push(endLabel);
    context.loopStartStack.push(updateLabel); // continue jumps to update section

    context.emitLabel(startLabel);
    if (node.test && node.test.type === "BinaryExpression") {
      compileComparison(node.test, bodyLabel, endLabel);
    }

    context.emitLabel(bodyLabel);
    compileStatement(node.body);

    context.emitLabel(updateLabel);
    if (node.update) {
      if (node.update.type === "UpdateExpression") {
        compileUpdateExpression(node.update);
      } else {
        compileStatement({ type: "ExpressionStatement", expression: node.update });
      }
    }
    context.emitInstruction("JUMP", [startLabel]);

    context.emitLabel(endLabel);
    context.loopEndStack.pop();
    context.loopStartStack.pop();

    registers.exitScope(); // Exit for loop scope
  };

  const compileDoWhileStatement = (node: DoWhileStatement): void => {
    const { key, startLabel, endLabel } = context.newLabel("dowhile", true);
    const bodyLabel = `${key}_body`;

    registers.enterScope(); // Enter do-while loop scope

    context.loopEndStack.push(endLabel);
    context.loopStartStack.push(bodyLabel); // continue jumps to body start

    context.emitLabel(bodyLabel);
    compileStatement(node.body);

    context.emitLabel(startLabel);
    if (node.test.type === "BinaryExpression") {
      compileComparison(node.test, bodyLabel, endLabel);
    }

    context.emitLabel(endLabel);
    context.loopEndStack.pop();
    context.loopStartStack.pop();

    registers.exitScope(); // Exit do-while loop scope
  };

  const compileBreakStatement = (): void => {
    if (!context.loopEndStack.length) {
      throw new Error("BreakStatement usado fora de um loop!");
    }

    const endLabel = context.loopEndStack[context.loopEndStack.length - 1];
    context.emitInstruction("JUMP", [endLabel]);
  };

  const compileContinueStatement = (): void => {
    if (context.loopStartStack.length === 0) {
      throw new Error("ContinueStatement usado fora de um loop!");
    }

    const startLabel = context.loopStartStack[context.loopStartStack.length - 1];
    context.emitInstruction("JUMP", [startLabel]);
  };

  const compileUpdateExpression = (node: UpdateExpression): void => {
    assertIdentifier(node.argument);

    const reg = registers.get(node.argument.name);

    switch (node.operator) {
      case "++":
        context.emitInstruction("ADDI", [reg, "1"], node);
        break;
      case "--":
        context.emitInstruction("SUBI", [reg, "1"], node);
        break;
      default:
        throw new Error("Unsupported update operator: " + node.operator);
    }
  };

  return {
    compileWhileStatement,
    compileForStatement,
    compileDoWhileStatement,
    compileBreakStatement,
    compileContinueStatement,
    compileUpdateExpression,
  };
};
