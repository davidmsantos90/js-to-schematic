import type { Node } from "estree";
import { getInstruction } from "../ISA.js";
import { AssemblyEntry, assertIdentifier } from "../types/assembly.js";

export interface CompilerContext {
  loopEndStack: string[];
  loopStartStack: string[];
  emitInstruction: (
    mnemonic: string,
    operands?: string[],
    astNode?: Node | null,
    prefix?: string,
  ) => void;
  emitLabel: (label: string) => void;
  emitBlank: () => void;
  emitDefine: (name: string, value: string | number) => void;
  newLabel: (
    text: string,
    unique?: boolean,
  ) => { key: string; startLabel: string; endLabel: string };
  getAssembly: () => string[];
  astToSource: (node: Node) => string;
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
      const [regA, regB, offsetValue] = operands;

      const offsetStr = offsetValue ? ` + ${offsetValue}` : "";
      const operation = `${regB} <- [${regA}${offsetStr}]`;

      // If we have a prefix (like variable assignment or compound assignment)
      // For "result = " -> "result <- [...]"
      // For "result += " -> "result += [...]" (keep compound operator as-is)
      if (prefix) {
        // If prefix already contains "mem[" or "<-", it's a complete comment
        if (prefix.includes("mem[") || prefix.includes("<-")) {
          comment = prefix.trim();
        } else if (prefix.match(/[+\-*/%]=/)) {
          // Compound assignment - keep operator
          comment = `${prefix.trim()} [${regA}${offsetStr}]`;
        } else if (prefix.match(/\s*=\s*$/)) {
          // Simple assignment prefix ending with "="
          if (astNode) {
            // Use astNode instead of register notation
            comment = `${prefix.replace(/\s*=\s*$/, " <-")} ${astToSource(astNode)}`;
          } else {
            // Use register notation
            comment = `${prefix.replace(/\s*=\s*$/, " <-")} [${regA}${offsetStr}]`;
          }
        } else if (astNode) {
          // Prefix is a complete expression (like "arr[bubble]"), don't append register notation
          comment = prefix.trim();
        } else {
          // No astNode and no clear pattern - use register notation
          comment = `${prefix.trim()} [${regA}${offsetStr}]`;
        }
      } else {
        comment = operation;
      }
    } else if (mnemonic === "STORE" && operands.length >= 2) {
      // STORE regA regB offset -> [regA + offset] <- regB
      const [regA, regB, offset] = operands;
      // If we have a prefix (like "arr[0] <- "), show the value being stored
      if (prefix) {
        const trimmed = prefix.trim();
        // Check if prefix is a complete statement (contains something after <-)
        // vs an incomplete prefix (ends with <- and nothing after)
        const isCompleteComment = trimmed.includes("<-") && !trimmed.match(/<-\s*$/);

        if (isCompleteComment) {
          // Complete comment like "arr[bubble] <- arr[nextBubble]"
          comment = trimmed;
        } else if (astNode) {
          // Incomplete prefix like "arr[0] <-", append the value
          comment = `${trimmed} ${astToSource(astNode)}`;
        } else {
          // Fallback to register notation
          comment = `${trimmed} ${regB}`;
        }
      } else {
        comment = `[${regA}${offset ? " + " + offset : ""}] <- ${regB}`;
      }
    } else if (prefix) {
      // If prefix ends with assignment operator (=, <-, +=, -=, etc.), append astNode
      // Otherwise just use the prefix (it's already the full expression)
      if (prefix.match(/[=<+\-*/%]\s*$/) && astNode) {
        comment = `${prefix}${astToSource(astNode)}`;
      } else {
        comment = prefix;
      }
    } else if (astNode) {
      comment = astToSource(astNode);
    }

    assembly.push({
      type: "instruction",
      text: instructionText,
      comment,
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

  const emitDefine = (name: string, value: string | number) => {
    assembly.push({ type: "define", text: `define ${name} ${value}` });
  };

  const getAssembly = (): string[] => {
    const labelScopeStack: string[] = [];
    const scopePad = (extra: number = 0) =>
      "  ".repeat(Math.max(labelScopeStack.length + extra, 0));
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

        case "define":
          return text; // Defines are not indented and have no comments

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
    emitDefine,
    newLabel,
    getAssembly,
    astToSource,
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
      return node.prefix
        ? `${node.operator}${astToSource(node.argument)}`
        : `${astToSource(node.argument)}${node.operator}`;
    case "MemberExpression":
      const object = astToSource(node.object);
      const property = node.computed
        ? `[${astToSource(node.property)}]`
        : `.${astToSource(node.property)}`;
      return `${object}${property}`;
    case "ExpressionStatement":
      return astToSource(node.expression);
    case "ArrayExpression":
      return `[${node.elements.map((e) => (e ? astToSource(e) : "")).join(", ")}]`;
    case "ArrayPattern":
      return `[${node.elements.map((e) => (e ? astToSource(e) : "")).join(", ")}]`;
    default:
      return `/* ${node.type} */`;
  }
}
