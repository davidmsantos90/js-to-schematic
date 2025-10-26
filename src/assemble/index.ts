import fs from "fs";
import { replaceLabels, assembleInstruction } from "./assembler.js";

const save = (code: string[], name: string) => {
  fs.writeFileSync(`./dist/${name}/${name}.mc`, code.join("\n"));
};

const debugLog = (codeWithAssembly: { machineCode: string; assembly: string }[]) => {
  const maxIndexSize = `${codeWithAssembly.length}`.length;
  const maxMachineCodeLength = Math.max(...codeWithAssembly.map(item => item.machineCode.length));

  console.log("==> Machine Code:\n");
  codeWithAssembly.forEach((item, index) => {
    const indexSize = `${index}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);
    const machinePadding = " ".repeat(maxMachineCodeLength - item.machineCode.length + 2);
    
    console.log(`${padding}${index}.  ${item.machineCode}${machinePadding}; ${item.assembly}`);
  });
};

export default function assemble(program: string[], name: string) {
  const machineCodeWithAssembly = replaceLabels(program).map(assembleInstruction);
  const machineCode = machineCodeWithAssembly.map(item => item.machineCode);

  save(machineCode, name);
  debugLog(machineCodeWithAssembly);

  return machineCode;
}
