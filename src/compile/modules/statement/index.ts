import type { Statement } from "estree";

import { CompilerContext } from "../../../types/compile";
import { isDirective } from "../../utils/nodeTypeDetector";
import compileBlockStatement from "./blockStatement";
import compileBreakStatement from "./breakStatement";
import compileContinueStatement from "./continueStatement";
import compileFunctionDeclaration from "./declaration/functionDeclaration";
import compileVariableDeclaration from "./declaration/variableDeclaration";
import compileThrowStatement from "./error/throwStatement";
import compileTryStatement from "./error/tryStatement";
import compileExpressionStatement from "./expressionStatement";
import compileIfStatement from "./ifStatement";
import compileDoWhileStatement from "./loop/doWhileStatement";
import compileForInStatement from "./loop/forInStatement";
import compileForOfStatement from "./loop/forOfStatement";
import compileForStatement from "./loop/forStatement";
import compileWhileStatement from "./loop/whileStatement";
import compileReturnStatement from "./returnStatement";
import compileSwitchStatement from "./switchStatement";

export {
  compileVariableDeclaration,
  compileFunctionDeclaration,
  compileBreakStatement,
  compileContinueStatement,
  compileReturnStatement,
  compileDoWhileStatement,
  compileBlockStatement,
  compileForStatement,
  compileForInStatement,
  compileForOfStatement,
  compileWhileStatement,
  compileIfStatement,
  compileSwitchStatement,
  compileThrowStatement,
  compileTryStatement,
  compileExpressionStatement,
};

export default function compile(this: CompilerContext, node: Statement): void {
  switch (node.type) {
    case "VariableDeclaration":
      return compileVariableDeclaration.call(this, node);

    case "FunctionDeclaration":
      return compileFunctionDeclaration.call(this, node);

    case "BlockStatement":
      return compileBlockStatement.call(this, node);

    case "BreakStatement":
      return compileBreakStatement.call(this);

    case "ContinueStatement":
      return compileContinueStatement.call(this);

    case "ExpressionStatement":
      if (!isDirective(node)) return compileExpressionStatement.call(this, node);
      break;

    case "IfStatement":
      return compileIfStatement.call(this, node);

    case "SwitchStatement":
      return compileSwitchStatement.call(this, node);

    case "ThrowStatement":
      return compileThrowStatement.call(this, node);

    case "TryStatement":
      return compileTryStatement.call(this, node);

    case "WhileStatement":
      return compileWhileStatement.call(this, node);

    case "ForStatement":
      return compileForStatement.call(this, node);

    case "ForInStatement":
      return compileForInStatement.call(this, node);

    case "ForOfStatement":
      return compileForOfStatement.call(this, node);

    case "DoWhileStatement":
      return compileDoWhileStatement.call(this, node);

    case "ReturnStatement":
      return compileReturnStatement.call(this, node);

    case "EmptyStatement":
      // Empty statement (just a semicolon) - no-op
      return;

    default:
      throw new Error("Unsupported statement type: " + node.type);
  }
}
