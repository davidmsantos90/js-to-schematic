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
import { STACK_POINTER_REGISTER, type RegisterName } from "../../types/ISA.js";
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

    // Push arguments onto stack in reverse order (so first arg is at lowest address)
    for (let i = callExpr.arguments.length - 1; i >= 0; i--) {
      const arg = callExpr.arguments[i];
      const argReg = compileValue(arg as Expression);
      
      // STORE arg to stack at [SP]
      context.emitInstruction("STORE", [argReg, STACK_POINTER_REGISTER, "0"], arg as Expression);
      // Decrement stack pointer
      context.emitInstruction("SUBI", [STACK_POINTER_REGISTER, "1"]);
    }

    const { startLabel } = context.newLabel(fnName);
    context.emitInstruction("CALL", [startLabel], callExpr);
    
    // Clean up stack: SP += number of arguments
    if (callExpr.arguments.length > 0) {
      context.emitInstruction("ADDI", [STACK_POINTER_REGISTER, `${callExpr.arguments.length}`]);
    }
    
    // Note: Return value (if any) is now on top of stack at [SP + 1]
    // Caller should load it immediately if needed
  };

  const compileAssignmentExpression = (expression: Expression, name: string): void => {
    switch (expression.type) {
      case "CallExpression": {
        compileCallExpression(expression);

        // Load return value from stack at [SP + 1] into variable's register
        const destinationReg = registers.set(name);
        context.emitInstruction("LOAD", [destinationReg, STACK_POINTER_REGISTER, "1"], expression, `${name} = `);
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
    
    // Load parameters from stack into registers
    // After CALL, SP points to next free slot, so params are at positive offsets
    // First param is at [SP + paramCount], second at [SP + paramCount - 1], etc.
    const paramCount = node.params.length;
    node.params.forEach((param, index) => {
      assertIdentifier(param);
      const paramName = param.name;
      const paramReg = registers.set(paramName);
      
      // Calculate offset: first param is at highest offset
      const offset = paramCount - index;
      context.emitInstruction("LOAD", [STACK_POINTER_REGISTER, paramReg, `${offset}`], null, `${paramName} = `);
    });
    
    compileStatement(node.body);

    if (node.body.body.every(({ type }) => type !== "ReturnStatement")) {
      compileReturnStatement();
    }

    context.emitLabel(endLabel);
  };

  const compileReturnStatement = (statement?: ReturnStatement): void => {
    if (statement?.argument) {
      const valueReg = compileValue(statement.argument);
      // Push return value onto stack
      context.emitInstruction("STORE", [valueReg, STACK_POINTER_REGISTER, "0"], statement);
      context.emitInstruction("SUBI", [STACK_POINTER_REGISTER, "1"]);
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
