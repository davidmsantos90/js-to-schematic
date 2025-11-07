import {
  BinaryExpression,
  Declaration,
  Directive,
  Expression,
  ModuleDeclaration,
  Node,
  Statement,
} from "estree";

import Stack from "../compile/Stack";
import { RegisterName } from "./ISA";

export type EstreeNode = Node;

export type CompileCallExpressionWithReturnFn = (
  callExpr: any,
  commentPrefix?: string,
) => RegisterName;

export type CompileValue = (
  node: Expression,
  varName?: string,
  suppressComment?: boolean,
) => RegisterName;

export type CompileBinaryExpression = (
  node: BinaryExpression,
  labels: {
    trueLabel: string;
    falseLabel: string;
  },
) => void;

export interface ExpressionCompiler {
  compileValue: CompileValue;
  compileBinaryExpression: CompileBinaryExpression;
}

type EmitInstruction = (
  mnemonic: string,
  operands?: string[],
  astNode?: EstreeNode | null,
  prefix?: string,
) => void;

export type CompileStatement = (statement: Statement) => void;

export interface CompilerContext {
  breakHandlerStack: Stack<string>;
  continueHandlerStack: Stack<string>;
  errorHandlerStack: Stack<string>; // Stack of catch block labels for exception handling
  emitInstruction: EmitInstruction;
  emitLabel: (label: string) => void;
  emitBlank: () => void;
  emitDefine: (name: string, value: string | number) => void;
  newLabel: (
    text: string,
    unique?: boolean,
  ) => { key: string; startLabel: string; endLabel: string };
  getAssembly: () => string[];
  astToSource: (node: EstreeNode) => string;

  compileNode: (node: Statement | Directive | ModuleDeclaration) => void;
}

export const isCompilerContext = (obj: any): obj is CompilerContext =>
  obj != null &&
  obj.breakHandlerStack != null &&
  obj.continueHandlerStack != null &&
  obj.errorHandlerStack != null &&
  typeof obj.emitInstruction === "function" &&
  typeof obj.emitLabel === "function" &&
  typeof obj.emitBlank === "function" &&
  typeof obj.emitDefine === "function" &&
  typeof obj.newLabel === "function" &&
  typeof obj.getAssembly === "function" &&
  typeof obj.astToSource === "function" &&
  typeof obj.compileNode === "function";

export function assertCompilerContext(obj: any): asserts obj is CompilerContext {
  if (!isCompilerContext(obj)) {
    throw new Error("Object is not a CompilerContext");
  }
}
