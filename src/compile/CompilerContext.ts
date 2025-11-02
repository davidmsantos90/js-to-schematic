import type { Node } from "estree";
import { getInstruction } from "../ISA.js";
import { AssemblyEntry, assertIdentifier } from "../types/assembly.js";

export interface CompilerContext {
  loopEndStack: string[];
  loopStartStack: string[];
  emitInstruction: (mnemonic: string, operands?: string[], astNode?: Node | null, prefix?: string) => void;
  emitLabel: (label: string) => void;
  emitBlank: () => void;
  newLabel: (text: string, unique?: boolean) => { key: string; startLabel: string; endLabel: string };
  getAssembly: () => string[];
}

export const createCompilerContext = (): CompilerContext => {
  const loopEndStack: string[] = [];
  const loopStartStack: string[] = [];
  const assembly: AssemblyEntry[] = [];
  
  // Label counter for unique labels
  const labelCounter = (() => {
    let count = 0;
    return () => count++;
  })();

  const newLabel = (text: string, unique?: boolean) => {
    const label = `.${unique ? labelCounter() + "_" : ""}${text}`;
    return {
      key: label,
      startLabel: `${label}_start`,
      endLabel: `${label}_end`,
    };
  };

  const emitInstruction = (
    mnemonic: string,
    operands: string[] = [],
    astNode: Node | null = null,
    prefix: string = "",
  ) => {
    const instruction = getInstruction(mnemonic);
    const instructionText = instruction.toAssembly(...operands);
    
    // Generate operation-specific comments for LOAD and STORE
    let comment: string | null = null;
    if (mnemonic === "LOAD" && operands.length >= 3) {
      // LOAD regA regB offset -> regB <- [regA + offset]
      const [regA, regB, offset] = operands;
      const offsetStr = offset === "0" ? "" : ` + ${offset}`;
      const operation = `${regB} <- [${regA}${offsetStr}]`;
      // If we have a prefix (like variable assignment or compound assignment)
      // For "result = " -> "result <- [...]"
      // For "result += " -> "result += [...]" (keep compound operator as-is)
      if (prefix) {
        if (prefix.match(/[+\-*/%]=/)) {
          // Compound assignment - keep operator
          comment = `${prefix.trim()} [${regA}${offsetStr}]`;
        } else {
          // Simple assignment - replace = with <-
          comment = `${prefix.replace(/\s*=\s*$/, ' <-')} [${regA}${offsetStr}]`;
        }
      } else {
        comment = operation;
      }
    } else if (mnemonic === "STORE" && operands.length >= 2) {
      // STORE regA regB offset -> [regA + offset] <- regB
      const [regA, regB, offset = "0"] = operands;
      const offsetStr = offset === "0" ? "" : ` + ${offset}`;
      comment = `[${regA}${offsetStr}] <- ${regB}`;
    } else if (astNode) {
      comment = `${prefix}${astToSource(astNode)}`;
    } else if (prefix) {
      // If we have a prefix but no astNode, just use the prefix
      comment = prefix;
    }
    
    assembly.push({ 
      type: "instruction", 
      text: instructionText, 
      comment 
    });
  };

  const emitLabel = (label: string, comment?: string | null) => {
    if (assembly.length > 0 && label.includes("_start")) {
      emitBlank();
    }

    assembly.push({ type: "label", text: label, comment });

    if (label.includes("_end")) {
      emitBlank();
    }
  };

  const emitBlank = () => {
    assembly.push({ type: "blank", text: "" });
  };

  const getAssembly = (): string[] => {
    const labelScopeStack: string[] = [];
    const scopePad = (extra: number = 0) => "  ".repeat(Math.max(labelScopeStack.length + extra, 0));
    const closeLabelScope = (label: string) => {
      // Pop all labels that start with the same index until one includes "_start"
      const [labelIndex] = label.split("_");

      while (labelScopeStack.length > 0) {
        const lastLabel = labelScopeStack[labelScopeStack.length - 1];
        if (lastLabel.startsWith(labelIndex)) {
          labelScopeStack.pop();
          if (lastLabel.includes("_start")) break;
        } else {
          break;
        }
      }
    };

    const maxLen = Math.max(
      ...assembly.filter(({ type }) => type === "instruction").map(({ text }) => text.length),
      0,
    );

    return assembly.map(({ type, text, comment }) => {
      switch (type) {
        case "label": {
          const popLabel = labelScopeStack.length > 0 && text.includes("_end");
          if (popLabel) closeLabelScope(text);
          else labelScopeStack.push(text); // abre novo bloco

          return `${scopePad(popLabel ? 0 : -1)}${text}`;
        }

        case "instruction": {
          const paddedText = `${scopePad()}${text.padEnd(maxLen + 2)}`;
          if (comment == null) return paddedText;

          return `${paddedText}; ${comment}`;
        }

        case "blank":
        default:
          return "";
        }
    });
  };

  return {
    loopEndStack,
    loopStartStack,
    emitInstruction,
    emitLabel,
    emitBlank,
    newLabel,
    getAssembly,
  };
};

// Helper function - will be moved to a shared utils file later
function astToSource(node: Node): string {
  if (!node) return "";

  switch (node.type) {
    case "Identifier":
      return `${node.name}`;
    case "Literal":
      return `${node.value}`;
    case "BinaryExpression":
      return `${astToSource(node.left)} ${node.operator} ${astToSource(node.right)}`;
    case "AssignmentExpression":
      return `${astToSource(node.left)} = ${astToSource(node.right)}`;
    case "VariableDeclaration":
      return node.declarations
        .map((d) => {
          assertIdentifier(d.id);
          return `${d.id.name} = ${astToSource(d.init!)}`;
        })
        .join(", ");
    case "CallExpression":
      return `${astToSource(node.callee)}(${node.arguments.map((arg) => astToSource(arg)).join(", ")})`;
    case "IfStatement":
      return `if (${astToSource(node.test)})`;
    case "WhileStatement":
      return `while (${astToSource(node.test)})`;
    case "FunctionDeclaration":
      return `function ${node.id?.name}() { ... }`;
    case "ReturnStatement":
      return node.argument ? `return ${astToSource(node.argument)}` : "return";
    case "BreakStatement":
      return "break";
    case "ContinueStatement":
      return "continue";
    case "ForStatement":
      const init = node.init ? astToSource(node.init) : "";
      const test = node.test ? astToSource(node.test) : "";
      const update = node.update ? astToSource(node.update) : "";
      return `for (${init}; ${test}; ${update})`;
    case "DoWhileStatement":
      return `do { ... } while (${astToSource(node.test)})`;
    case "UnaryExpression":
      return `${node.operator}${astToSource(node.argument)}`;
    case "UpdateExpression":
      return node.prefix ? `${node.operator}${astToSource(node.argument)}` : `${astToSource(node.argument)}${node.operator}`;
    default:
      return `/* ${node.type} */`;
  }
}
