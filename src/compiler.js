import fs from "fs";
import esprima from "esprima";
import ISA, { RETURN_REGISTER } from "./ISA.js";

const assembly = [];
const registries = {};

let nextReg = 0;
const newReg = () => {
  if (nextReg > 15) throw new Error("Out of registers!");

  const register = `r${nextReg++}`;
  if (ISA.registers[register].special == null) {
    return register;
  }

  // skip special registers
  return newReg();
};

let labelCount = 0;
const newLabel = (label, useCount = true) => `.${label}${useCount ? "_" + labelCount++ : ""}`;

// Helper to emit assembly using ISA definitions
const toAssembly = (mnemonic, ...operands) => {
  const instruction = ISA.getInstruction(mnemonic);

  assembly.push(instruction.toAssembly(...operands));
}

const compileReturn = (node) => {
  if (node.argument) {
    const valueReg = compileValue(node.argument);
    // move result to return register
    toAssembly("MOVE", valueReg, RETURN_REGISTER);
  }

  toAssembly("RET");
};

/**
 * Utility function to evaluate a value node (Identifier, Literal, BinaryExpression)
 * Always returns a register where the result is stored.
 */
const compileValue = (node) => {
  switch (node.type) {
    case "Identifier":
      return registries[node.name];

    case "Literal": {
      const reg = newReg();
      toAssembly("LDI", reg, node.value);
      
      return reg;
    }

    case "BinaryExpression": {
      const left = node.left;
      const right = node.right;

      // caso registo + literal
      if (left.type === "Identifier" && right.type === "Literal") {
        const leftReg = compileValue(left);

        switch (node.operator) {
          case "+":
            toAssembly("ADDI", leftReg, right.value);
            return leftReg;
          case "-":
            toAssembly("SUBI", leftReg, right.value);
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
            toAssembly("ADDI", rightReg, left.value);
            return rightReg;
          default:
            throw new Error("Unsupported literal+reg operator: " + node.operator);
        }
      }

      // caso geral reg + reg
      const leftReg = compileValue(left);
      const rightReg = compileValue(right);
      const dest = newReg();

      switch (node.operator) {
        case "+": toAssembly("ADD", leftReg, rightReg, dest); break;
        case "-": toAssembly("SUB", leftReg, rightReg, dest); break;
        default: throw new Error("Unsupported binary op: " + node.operator);
      }

      return dest;
    }

    default:
      throw new Error("Unsupported node type in compileValue: " + node.type);
  }
};

const compileComparison = (test, notLabel) => {
  const left = compileValue(test.left);
  const right = compileValue(test.right);

  toAssembly("CMP", left, right);
  switch (test.operator) {
    case "===":
    case "==": toAssembly("BRANCH", "==", notLabel); break;

    case "!==":
    case "!=": toAssembly("BRANCH", "!=", notLabel); break;

    // missing cases for ">"
    case ">=": toAssembly("BRANCH", ">=", notLabel); break;

    // missing cases for "<="
    case "<": toAssembly("BRANCH", "<", notLabel); break;

    default: throw new Error("Unsupported test operator: " + test.operator);
  }
};

const compileVariable = ({ declarations }) => {
  for (const { id, init } of declarations) {
    if (init.type === "CallExpression") {
      const fnName = init.callee.name;
      toAssembly("CALL", newLabel(fnName, false));
      // associate return register to variable
      registries[id.name] = RETURN_REGISTER;
    } else {
      registries[id.name] = compileValue(init);
    }
  }
};

const compileExpression = ({ expression }) => {
  switch (expression.type) {
    case "AssignmentExpression": {
      const { left, right } = expression;
      if (right.type === "CallExpression") {
        const fnName = right.callee.name;
        toAssembly("CALL", newLabel(fnName, false));
        registries[left.name] = RETURN_REGISTER;
      } else {
        registries[left.name] = compileValue(right);
      }
      break;
    }

    case "CallExpression": {
      const fnName = expression.callee.name;
      toAssembly("CALL", newLabel(fnName, false));
      break;
    }

    default:
      throw new Error("Unsupported expression type: " + expression.type);
  }
};

const compileIf = ({ test, consequent, alternate }) => {
  const elseLabel = newLabel("else");
  if (test.type === "BinaryExpression") {
    compileComparison(test, elseLabel);
  }

  const endLabel = newLabel("endif");
  consequent.body.forEach(compileStatement);
  toAssembly("JUMP", endLabel);

  if (alternate) {
    assembly.push(elseLabel);
    alternate.body.forEach(compileStatement);
  }

  assembly.push(endLabel);
};

const compileWhile = ({ test, body }) => {
  const startLabel = newLabel("while_start");
  assembly.push(startLabel);

  const endLabel = newLabel("while_end");
  if (test.type === "BinaryExpression") {
    compileComparison(test, endLabel);
  }

  body.body.forEach(compileStatement);
  toAssembly("JUMP", startLabel);

  assembly.push(endLabel);
};

const compileFunction = ({ id, body }) => {
  assembly.push(newLabel(id.name, false));
  body.body.forEach(compileStatement);
};

const compileStatement = (statement) => {
  switch (statement.type) {
    case "VariableDeclaration":
      return compileVariable(statement);

    case "ExpressionStatement":
      return compileExpression(statement);

    case "IfStatement":
      return compileIf(statement);

    case "WhileStatement":
      return compileWhile(statement);

    case "FunctionDeclaration":
    case "ArrowFunctionExpression":
      return compileFunction(statement);

    case "ReturnStatement":
      return compileReturn(statement);

    default:
      throw new Error("Unsupported statement type: " + statement.type);
  }
}

// Compiler principal
export default function compile(code, name) {
  const ast = esprima.parseScript(code);

  for (const statement of ast.body) {
    compileStatement(statement);
  }

  toAssembly("HALT");

  const assemblyCode = assembly.map(line => line.trim());

  // Save assembly file
  fs.writeFileSync(`./dist/${name}/${name}.as`, assembly.join("\n"));

  console.log("\n==> Assembly:\n");

  const maxIndexSize = `${assembly.length}`.length;
  console.log(assembly.map((instruction, index) => {
    const indexSize = `${index + 1}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    return `${padding}${index + 1}.  ${instruction}`;
  }).join("\n"));

  return assemblyCode;
}
