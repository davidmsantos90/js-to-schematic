import type {
  AssignmentExpression,
  CallExpression,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  IfStatement,
  ReturnStatement,
  Statement,
  UpdateExpression,
  VariableDeclaration,
} from "estree";
import { RETURN_REGISTER, type RegisterName } from "../../types/ISA.js";
import { assertIdentifier } from "../../types/assembly.js";
import registers from "../registers.js";

import type { CompilerContext } from "../CompilerContext.js";
import type { CompileValueFn, CompileComparisonFn } from "./expressionCompiler.js";
import type { CompileStatementFn } from "./loopCompiler.js";

export type StatementCompiler = (
  context: CompilerContext,
  dependencies: {
    compileValue: CompileValueFn;
    compileComparison: CompileComparisonFn;
    compileUpdateExpression: (node: UpdateExpression) => void;
  }
) => {
  compileVariableDeclaration: (node: VariableDeclaration) => void;
  compileExpressionStatement: (node: ExpressionStatement) => void;
  compileIfStatement: (node: IfStatement, compileStatement: CompileStatementFn) => void;
  compileFunctionDeclaration: (node: FunctionDeclaration, compileStatement: CompileStatementFn) => void;
  compileReturnStatement: (statement?: ReturnStatement) => void;
  compileAssignmentExpression: (expression: Expression, name: string) => void;
};

export const createStatementCompiler: StatementCompiler = (
  context: CompilerContext,
  {
    compileValue,
    compileComparison,
    compileUpdateExpression,
  }: {
    compileValue: CompileValueFn;
    compileComparison: CompileComparisonFn;
    compileUpdateExpression: (node: UpdateExpression) => void;
  }
) => {
  const compileCallExpression = (callExpr: CallExpression): void => {
    assertIdentifier(callExpr.callee);
    const fnName = callExpr.callee.name;

    const { startLabel } = context.newLabel(fnName);
    context.emitInstruction("CALL", [startLabel], callExpr);
  };

  const compileAssignmentExpression = (expression: Expression, name: string): void => {
    switch (expression.type) {
      case "CallExpression": {
        compileCallExpression(expression);

        // Move return value to a dedicated register for the variable
        const destinationReg = registers.set(name);
        context.emitInstruction("MOVE", [RETURN_REGISTER, destinationReg], expression, `${name} = `);
        break;
      }

      case "Identifier": {
        // caso: x = y
        const srcReg = registers.get(expression.name);
        if (!srcReg) throw new Error(`Variable ${expression.name} not defined`);

        const destinationReg = registers.set(name);
        context.emitInstruction("MOVE", [srcReg, destinationReg], expression, `${name} = `);
        break;
      }

      default: {
        registers.set(name, compileValue(expression, name));
      }
    }
  };

  const compileVariableDeclaration = (node: VariableDeclaration): void => {
    for (const { id, init } of node.declarations) {
      assertIdentifier(id);
      compileAssignmentExpression(init!, id.name);
    }
  };

  const compileExpressionStatement = (node: ExpressionStatement): void => {
    switch (node.expression.type) {
      case "AssignmentExpression": {
        const { left, right } = node.expression;
        assertIdentifier(left);
        compileAssignmentExpression(right, left.name);
        break;
      }

      case "CallExpression": {
        compileCallExpression(node.expression);
        break;
      }

      case "UpdateExpression": {
        compileUpdateExpression(node.expression);
        break;
      }

      default:
        throw new Error("Unsupported expression type: " + node.expression.type);
    }
  };

  const compileIfStatement = (node: IfStatement, compileStatement: CompileStatementFn): void => {
    const { key, startLabel, endLabel } = context.newLabel("if", true);
    const elseLabel = `${key}_else`;

    if (node.test.type === "BinaryExpression") {
      const falseLabel = node.alternate ? elseLabel : endLabel;
      compileComparison(node.test, startLabel, falseLabel);
    }

    context.emitLabel(startLabel);
    compileStatement(node.consequent);

    if (node.alternate) {
      context.emitInstruction("JUMP", [endLabel]);
      context.emitLabel(elseLabel);
      compileStatement(node.alternate);
    }

    context.emitLabel(endLabel);
  };

  const compileFunctionDeclaration = (node: FunctionDeclaration, compileStatement: CompileStatementFn): void => {
    const fnName = node.id!.name;
    const { startLabel, endLabel } = context.newLabel(fnName);

    context.emitInstruction("JUMP", [endLabel]); // don't execute function body on declaration

    context.emitLabel(startLabel);
    compileStatement(node.body);

    if (node.body.body.every(({ type }) => type !== "ReturnStatement")) {
      compileReturnStatement();
    }

    context.emitLabel(endLabel);
  };

  const compileReturnStatement = (statement?: ReturnStatement): void => {
    if (statement?.argument) {
      const valueReg = compileValue(statement.argument);
      context.emitInstruction("MOVE", [valueReg, RETURN_REGISTER], statement);
    }

    context.emitInstruction("RET", [], statement);
  };

  return {
    compileVariableDeclaration,
    compileExpressionStatement,
    compileIfStatement,
    compileFunctionDeclaration,
    compileReturnStatement,
    compileAssignmentExpression,
  };
};
