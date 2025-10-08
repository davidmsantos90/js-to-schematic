import fs from "fs";
import { replaceLabels, assembleInstruction } from "./assembler.js";

const save = (code, name) => {
  fs.writeFileSync(`./dist/${name}/${name}.mc`, code.join("\n"));
};

const debugLog = (code) => {
  const maxIndexSize = `${code.length}`.length;

  console.log("\n\n==> Machine Code:\n");
  console.log(code.map((instruction, index) => {
    const indexSize = `${index + 1}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    return `${padding}${index + 1}.  ${instruction}`;
  }).join("\n"));
}

export default function assemble(program, name) {
  const machineCode = replaceLabels(program).map(assembleInstruction)

  save(machineCode, name);
  debugLog(machineCode);

  return machineCode;
}
