import ISA, { getInstruction } from "../ISA.js";

export const cleanup = (program: string[]) =>
  program
    .map((line) => {
      const [code] = line.split(";"); // Remove inline comments

      return code.trim();
    })
    .filter((line) => line.length > 0); // Remove empty lines

type TranslatedInstruction = {
  mnemonic: string;
  operands: string[];
  originalAssembly: string;
};

export const replaceLabels = (program: string[]): TranslatedInstruction[] => {
  const instructions: string[] = [];
  const originalLines: string[] = [];
  const labels: Record<string, string> = {};

  let address = 0;
  for (const line of cleanup(program)) {
    if (line.startsWith(".")) {
      labels[line] = `${address}`;
    } else {
      instructions.push(line);
      // Find the original line from the program (before cleanup)
      const originalLine = program.find(progLine => {
        const [code] = progLine.split(";");
        return code.trim() === line;
      }) || line;
      originalLines.push(originalLine.trim());
      address++;
    }
  }

  return instructions.map((line, index) => {
    const [mnemonic, ...opsRaw] = line.split(" ");
    const operands = opsRaw.map((operand) => {
      const { [operand]: address } = labels;

      return address != null ? address : operand;
    });

    // Create enhanced assembly comment with resolved label addresses
    let enhancedAssembly = originalLines[index];
    
    // Replace labels with "label (address)" format in the comment
    opsRaw.forEach((operand, opIndex) => {
      if (labels[operand] != null) {
        const labelAddress = labels[operand];
        enhancedAssembly = enhancedAssembly.replace(operand, `${operand} (${labelAddress})`);
      }
    });

    return { 
      mnemonic, 
      operands, 
      originalAssembly: enhancedAssembly 
    };
  });
};

export const assembleInstruction = ({
  mnemonic,
  operands,
  originalAssembly,
}: TranslatedInstruction) => {
  const instruction = getInstruction(mnemonic);
  if (!instruction) throw new Error(`Unknown instruction: ${mnemonic}`);

  return {
    machineCode: instruction.toMachine(...operands),
    assembly: originalAssembly
  };
};
