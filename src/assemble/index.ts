import fs from "fs";
import { replaceLabels, assembleInstruction } from "./assembler.js";

const save = (code: string[], name: string) => {
  fs.writeFileSync(`./dist/${name}/${name}.mc`, code.join("\n"));
};

const debugLog = (code: string[]) => {
  const maxIndexSize = `${code.length}`.length;

  console.log("\n\n==> Machine Code:\n");
  code.forEach((instruction, index) => {
    const indexSize = `${index + 1}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    console.log(`${padding}${index + 1}.  ${instruction}`);
  });
};

export default function assemble(program: string[], name: string) {
  const machineCode = replaceLabels(program).map(assembleInstruction);

  save(machineCode, name);
  debugLog(machineCode);

  return machineCode;
}
