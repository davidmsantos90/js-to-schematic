import fs from "fs";
import ISA from "./ISA.js";

const assembleInstruction = (mnemonic, operands) => {
  const instruction = ISA.getInstruction(mnemonic);
  if (!instruction) throw new Error(`Unknown instruction: ${mnemonic}`);

  return instruction.toMachine(...operands);
}

export default function assemble(program, name) {
  const lines = program
    .map(l => l.split(";")[0].trim()) // Remove inline comments
    .filter(l => l); // Remove empty lines

  const labels = {};
  const instructions = [];

  // Pass 1: record labels
  let address = 0;
  for (const line of lines) {
    if (line.startsWith(".")) {
      labels[line] = address;
    } else {
      instructions.push(line);
      address++;
    }
  }

  // Pass 2: substitute labels and generate binary
  const machineCode = instructions.map(line => {
    const [mnemonic, ...opsRaw] = line.split(" ");
    const ops = opsRaw.map(op => (labels[op] != null ? labels[op] : op));

    return assembleInstruction(mnemonic, ops);
  });

  // 3. Save machine code file
  fs.writeFileSync(`./dist/${name}/${name}.mc`, machineCode.join("\n"));
  
  console.log("\n\n==> Machine Code:\n");
  const maxIndexSize = `${machineCode.length}`.length;
  console.log(machineCode.map((instruction, index) => {
    const indexSize = `${index + 1}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    return `${padding}${index + 1}.  ${instruction}`;
  }).join("\n"));

  return machineCode;
}