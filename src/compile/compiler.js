import fs from "fs";
import esprima from "esprima";
import ISA, { RETURN_REGISTER } from "../ISA.js";
import labels from "./labels.js";
import registers from "./registers.js";

const assembly = [];
const loopEndStack = [];

function astToSource(node) {
  if (!node) return "";

  switch (node.type) {
    case "Identifier": return `${node.name}`;
    case "Literal": return `${node.value.toString()}`;
    case "BinaryExpression": return `${astToSource(node.left)} ${node.operator} ${astToSource(node.right)}`;
    case "AssignmentExpression": return `${astToSource(node.left)} = ${astToSource(node.right)}`;
    case "VariableDeclaration": return node.declarations.map(d => `${d.id.name} = ${astToSource(d.init)}`).join(", ");
    case "CallExpression": return `${astToSource(node.callee)}(${node.arguments.map(arg => astToSource(arg)).join(", ")})`;
    case "IfStatement": return `if (${astToSource(node.test)})`;
    case "WhileStatement": return `while (${astToSource(node.test)})`;
    case "FunctionDeclaration": return `function ${node.id.name}() { ... }`;
    case "ReturnStatement": return node.argument ? `return ${astToSource(node.argument)}` : "return";
    default: return `/* ${node.type} */`;
  }
}

// Helper to emit assembly using ISA definitions
const toAssembly = (mnemonic, ...operands) => {
  const instruction = ISA.getInstruction(mnemonic);

  assembly.push(instruction.toAssembly(...operands));
}

const emitInstruction = (mnemonic, operands = [], astNode = null, prefix = "") => {
  const instruction = ISA.getInstruction(mnemonic);
  
  assembly.push({
    type: "instruction",
    text: instruction.toAssembly(...operands),
    comment: astNode ? `${prefix}${astToSource(astNode)}` : null
  });
};

const emitLabel = (label) => assembly.push(...labels.emit(label, !assembly.length));

/**
 * Utility function to evaluate a value node (Identifier, Literal, BinaryExpression)
 * Always returns a register where the result is stored.
 */
const compileValue = (node, varName) => {
  const assignPrefix = varName ? `${varName} = ` : "";

  switch (node.type) {
    case "Identifier":
      return registers.get(node.name);

    case "Literal": {
      const reg = registers.next();

      emitInstruction("LDI", [reg, node.value], node, assignPrefix);

      return reg;
    }

    case "BinaryExpression": {
      const { left, right } = node;

      // caso registo + literal
      if (left.type === "Identifier" && right.type === "Literal") {
        const leftReg = compileValue(left);

        switch (node.operator) {
          case "+":
            emitInstruction("ADDI", [leftReg, right.value], node, assignPrefix);
            return leftReg;
          case "-":
            emitInstruction("SUBI", [leftReg, right.value], node, assignPrefix);
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
            emitInstruction("ADDI", [rightReg, left.value], node, assignPrefix);
            return rightReg;
          case "-":
            emitInstruction("SUBI", [rightReg, left.value], node, assignPrefix);
            return rightReg;
          default:
            throw new Error("Unsupported literal+reg operator: " + node.operator);
        }
      }

      // caso geral reg + reg
      const leftReg = compileValue(left);
      const rightReg = compileValue(right);

      const dest = registers.get(varName);
      switch (node.operator) {
        case "+":
          emitInstruction("ADD", [leftReg, rightReg, dest], node, assignPrefix);
          break;
        case "-":
          emitInstruction("SUB", [leftReg, rightReg, dest], node, assignPrefix);
          break;
        default: throw new Error("Unsupported binary op: " + node.operator);
      }

      return dest;
    }

    default:
      throw new Error("Unsupported node type in compileValue: " + node.type);
  }
};

const compileComparison = (test, trueLabel, falseLabel) => {
  const left = compileValue(test.left);
  const right = compileValue(test.right);

  emitInstruction("CMP", [left, right], test);
  switch (test.operator) {
    case "===":
    case "==": emitInstruction("BRANCH", ["==", trueLabel], test); break;

    case "!==":
    case "!=": emitInstruction("BRANCH", ["!=", trueLabel], test); break;

    // missing cases for ">"
    case ">=": emitInstruction("BRANCH", [">=", trueLabel], test); break;

    // missing cases for "<="
    case "<": emitInstruction("BRANCH", ["<", trueLabel], test); break;

    default: throw new Error("Unsupported test operator: " + test.operator);
  }
  
  emitInstruction("JUMP", [falseLabel]);
};

const compileAssignment = (name, node) => {
  switch (node.type) {
    case "CallExpression": {
      const { startLabel } = labels.new(node.callee.name);
      emitInstruction("CALL", [startLabel], node);

      registers.set(name, RETURN_REGISTER); // registries[name] = RETURN_REGISTER;
      break;
    }

    case "Identifier": {
      // caso: x = y
      const srcReg = registers.get(node.name);
      if (!srcReg) throw new Error(`Variable ${node.name} not defined`);

      // if (registers.has(name)) {
      //   destinationReg = registers.get(name); // registries[name];
      // } else {
      //   destinationReg = registers.set(name);
      // }

      const destinationReg = registers.set(name);
      emitInstruction("MOVE", [srcReg, destinationReg], node, `${name} = `);
      break;
    }

    default: {
      registers.set(name, compileValue(node, name));
    }
  }
}

const compileVariable = ({ declarations }) => {
  for (const { id, init } of declarations) {
    compileAssignment(id.name, init);
  }
};

const compileExpression = ({ expression }) => {
  switch (expression.type) {
    case "AssignmentExpression": {
      const { left, right } = expression;
      compileAssignment(left.name, right);
      break;
    }

    case "CallExpression": {
      const fnName = expression.callee.name;
      emitInstruction("CALL", [labels.new(fnName).startLabel], expression);
      break;
    }

    default:
      throw new Error("Unsupported expression type: " + expression.type);
  }
};

const compileIf = ({ test, consequent, alternate }) => {
  const { key, startLabel, endLabel } = labels.new("if", true);
  const elseLabel = `${key}_else`;

  if (test.type === "BinaryExpression") {
    compileComparison(test, startLabel, alternate ? elseLabel : endLabel);
  }

  emitLabel(startLabel);
  consequent.body.forEach(compileStatement);

  if (alternate) {
    emitInstruction("JUMP", [endLabel]);

    emitLabel(elseLabel);
    alternate.body.forEach(compileStatement);
  }

  emitLabel(endLabel);
};

const compileWhile = ({ test, body }) => {
  const { key, startLabel, endLabel }  = labels.new("while", true);
  const bodyLabel = `${key}_body`;
  loopEndStack.push(endLabel); // push fim do loop
  
  emitLabel(startLabel);
  if (test.type === "BinaryExpression") compileComparison(test, bodyLabel, endLabel);

  emitLabel(bodyLabel);
  body.body.forEach(compileStatement);
  emitInstruction("JUMP", [startLabel]);

  emitLabel(endLabel);
  loopEndStack.pop(); // pop fim do loop
};

const compileFunction = ({ id, body }) => {
  let hasReturnStatement = false;

  const { startLabel, endLabel } = labels.new(id.name);
  
  emitLabel(startLabel);
  
  body.body.forEach((statement) => {
    if (statement.type === "ReturnStatement") hasReturnStatement = true;

    compileStatement(statement);
  });

  if (!hasReturnStatement) emitInstruction("RET");

  emitLabel(endLabel);
};

const compileReturn = (node) => {
  if (node.argument) {
    const valueReg = compileValue(node.argument);
    emitInstruction("MOVE", [valueReg, RETURN_REGISTER], node); // return register
  }

  emitInstruction("RET", [], node);
};

const compileBreak = () => {
  if (loopEndStack.length === 0) {
    throw new Error("BreakStatement usado fora de um loop!");
  }

  const endLabel = loopEndStack[loopEndStack.length - 1];
  emitInstruction("JUMP", [endLabel]);
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

    case "BreakStatement":
      return compileBreak();

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

  assembly.push({ type: "blank", text: "", comment: null })
  emitInstruction("HALT");

  registers._variables.forEach((value, key) => {
    console.log(`Register ${value} -> Variable ${key}`);
  });

  // alinhar assembly + comentários
  const maxLen = Math.max(
    ...assembly.filter(a => a.type === "instruction").map(a => a.text.length),
    0
  );

  const labelScopeStack = [];

  const assemblyCode = assembly.map((entry, i) => {
    if (entry.type === "blank") {
      return ""; // linha em branco
    }

    if (entry.type === "label") {
      const popLabel = labelScopeStack.length > 0 && entry.text.includes("_end");
      if (popLabel) {
        // Pop all labels that start with the same index until one includes "_start"
        const [labelIndex] = entry.text.split("_");

        while (labelScopeStack.length > 0) {
          const lastLabel = labelScopeStack[labelScopeStack.length - 1];
          if (lastLabel.startsWith(labelIndex)) {
            labelScopeStack.pop();
            if (lastLabel.includes("_start")) break;
          } else {
            break;
          }
        }
      } else {
        labelScopeStack.push(entry.text); // abre novo bloco
      }

      const scope = "  ".repeat(labelScopeStack.length - (popLabel ? 0 : 1))
      return scope + entry.text;
    } else {
      const scope = "  ".repeat(labelScopeStack.length)
      const padded = scope + entry.text.padEnd(maxLen + 2);
      return entry.comment ? `${padded}; ${entry.comment}` : padded;
    }
  });

  // const assemblyCode = assembly.map(line => line.trim());

  // Save assembly file
  fs.writeFileSync(`./dist/${name}/${name}.as`, assemblyCode.join("\n"));

  console.log("\n==> Assembly:\n");

  const maxIndexSize = `${assemblyCode.length}`.length;
  console.log(assemblyCode.map((instruction, index) => {
    const indexSize = `${index + 1}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    return `${padding}${index + 1}.  ${instruction}`;
  }).join("\n"));

  return assemblyCode;
}
