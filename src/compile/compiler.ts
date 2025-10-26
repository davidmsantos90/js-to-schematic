import type {
  Directive,
  ModuleDeclaration,
  Program,
  Statement,
} from "estree";
import { createCompilerContext } from "./CompilerContext.js";
import { createExpressionCompiler } from "./modules/expressionCompiler.js";
import { createLoopCompiler, type CompileStatementFn } from "./modules/loopCompiler.js";
import { createStatementCompiler } from "./modules/statementCompiler.js";
import registers from "./registers.js";


export default function compile(program: Program): string[] {
  const context = createCompilerContext();
  
  // Create expression compiler first (no dependencies)
  const expressionCompiler = createExpressionCompiler(context);
  
  // Define compileStatement function for circular dependencies
  const compileStatement: CompileStatementFn = (statement: Statement): void => {
    switch (statement.type) {
      case "VariableDeclaration":
        return statementCompiler.compileVariableDeclaration(statement);

      case "FunctionDeclaration":
        return statementCompiler.compileFunctionDeclaration(statement, compileStatement);

      case "BlockStatement":
        statement.body.forEach(compileStatement);
        return;

      case "BreakStatement":
        return loopCompiler.compileBreakStatement();

      case "ContinueStatement":
        return loopCompiler.compileContinueStatement();

      case "ExpressionStatement":
        return statementCompiler.compileExpressionStatement(statement);

      case "IfStatement":
        return statementCompiler.compileIfStatement(statement, compileStatement);

      case "WhileStatement":
        return loopCompiler.compileWhileStatement(statement);

      case "ForStatement":
        return loopCompiler.compileForStatement(statement);

      case "DoWhileStatement":
        return loopCompiler.compileDoWhileStatement(statement);

      case "ReturnStatement":
        return statementCompiler.compileReturnStatement(statement);

      case "EmptyStatement":
        // Empty statement (just a semicolon) - no-op
        return;

      default:
        throw new Error("Unsupported statement type: " + statement.type);
    }
  };

  // Create compilers that need compileStatement dependency
  const loopCompiler = createLoopCompiler(context, {
    compileComparison: expressionCompiler.compileComparison,
    compileStatement,
  });
  
  const statementCompiler = createStatementCompiler(context, {
    compileValue: expressionCompiler.compileValue,
    compileComparison: expressionCompiler.compileComparison,
    compileUpdateExpression: loopCompiler.compileUpdateExpression,
  });

  for (const statement of program.body) {
    compileStatement(statement as Statement);
  }

  context.emitBlank();
  context.emitInstruction("HALT");

  return context.getAssembly();
}
