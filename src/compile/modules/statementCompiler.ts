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
import { STACK_POINTER_REGISTER, ZERO_REGISTER, type RegisterName } from "../../types/ISA.js";
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

    // Push arguments onto stack using offsets (SP remains constant at 232)
    // First arg at [SP+0], second at [SP-1], third at [SP-2], etc.
    const argRegisters: string[] = [];
    
    for (let i = 0; i < callExpr.arguments.length; i++) {
      const arg = callExpr.arguments[i];
      const argReg = compileValue(arg as Expression);
      argRegisters.push(argReg);
      
      // STORE arg to stack at [SP - i]
      const offset = i === 0 ? "0" : `-${i}`;
      context.emitInstruction("STORE", [STACK_POINTER_REGISTER, argReg, offset], arg as Expression);
    }

    // Free argument registers - they're no longer needed after being stored
    for (const argReg of argRegisters) {
      registers.free(argReg);
    }

    const { startLabel } = context.newLabel(fnName);
    context.emitInstruction("CALL", [startLabel], callExpr);
    
    // No cleanup needed - SP was never modified!
    // Stack pointer remains at initial value (232)
    
    // Note: Return value (if any) is at [SP + 1]
    // Caller should load it immediately if needed
  };

  const compileAssignmentExpression = (expression: Expression, name: string): void => {
    switch (expression.type) {
      case "CallExpression": {
        compileCallExpression(expression);

        // Load return value from stack at [SP + 1] into variable's register
        const destinationReg = registers.set(name);
        context.emitInstruction("LOAD", [STACK_POINTER_REGISTER, destinationReg, "1"], expression, `${name} = `);
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

      case "Literal": {
        // Special case: initializing with literal 0
        // Allocate a real register and copy from r0 instead of LDI
        if (expression.value === 0) {
          const destinationReg = registers.set(name);
          context.emitInstruction("MOVE", [ZERO_REGISTER, destinationReg], expression, `${name} = `);
          break;
        }
        // Fall through to default for other literals
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
    // SP remains constant at 239 throughout execution
    // First param at [SP+0], second at [SP-1], third at [SP-2], etc.
    node.params.forEach((param, index) => {
      assertIdentifier(param);
      const paramName = param.name;
      const paramReg = registers.set(paramName);
      
      // Calculate offset: first param at 0, second at -1, etc.
      const offset = index === 0 ? "0" : `-${index}`;
      context.emitInstruction("LOAD", [STACK_POINTER_REGISTER, paramReg, offset], null, `${paramName} = `);
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
      // Store return value at [SP + 1] without modifying SP
      context.emitInstruction("STORE", [STACK_POINTER_REGISTER, valueReg, "1"], statement);
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
