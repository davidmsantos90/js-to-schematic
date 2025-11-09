import fs from "fs";

import { assembleInstruction, replaceLabels } from "./assembler";

const save = (code: string[], name: string) => {
  fs.writeFileSync(`./dist/${name}/${name}.mc`, code.join("\n"));
};

const debugLog = (codeWithAssembly: { machineCode: string; assembly: string }[]) => {
  const maxIndexSize = `${codeWithAssembly.length}`.length;
  const maxMachineCodeLength = Math.max(...codeWithAssembly.map((item) => item.machineCode.length));
  
  // Find the position where comments should start (after the longest instruction)
  const maxInstructionLength = Math.max(
    ...codeWithAssembly.map((item) => {
      const [instruction] = item.assembly.split(";");
      return instruction.trim().length;
    })
  );

  console.log("==> Machine Code:\n");
  codeWithAssembly.forEach((item, index) => {
    const indexSize = `${index}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);
    const machinePadding = " ".repeat(maxMachineCodeLength - item.machineCode.length + 2);
    
    // Split assembly into instruction and comment
    const [instruction, ...commentParts] = item.assembly.split(";");
    const comment = commentParts.join(";").trim();
    const instructionPadding = " ".repeat(Math.max(maxInstructionLength - instruction.trim().length, 0));
    
    if (comment) {
      console.log(`${padding}${index}.  ${item.machineCode}${machinePadding}; ${instruction.trim()}${instructionPadding}  ; ${comment}`);
    } else {
      console.log(`${padding}${index}.  ${item.machineCode}${machinePadding}; ${instruction.trim()}`);
    }
  });
};

export default function assemble(program: string[], name: string) {
  const machineCodeWithAssembly = replaceLabels(program).map(assembleInstruction);
  const machineCode = machineCodeWithAssembly.map((item) => item.machineCode);

  save(machineCode, name);
  debugLog(machineCodeWithAssembly);

  return machineCode;
}
