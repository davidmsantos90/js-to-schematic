import ISA, { getInstruction } from "../ISA.js";

export const cleanup = (program: string[]) =>
  program
    .map((line) => {
      const [code] = line.split(";"); // Remove inline comments

      return code.trim();
    })
    .filter((line) => line.length > 0); // Remove empty lines

export const replaceLabels = (program: string[]): { mnemonic: string; operands: string[] }[] => {
  const instructions: string[] = [];
  const labels: Record<string, string> = {};

  let address = 0;
  for (const line of cleanup(program)) {
    if (line.startsWith(".")) {
      labels[line] = `${address}`;
    } else {
      instructions.push(line);
      address++;
    }
  }

  return instructions.map((line) => {
    const [mnemonic, ...opsRaw] = line.split(" ");
    const operands = opsRaw.map((operand) => {
      const { [operand]: address } = labels;

      return address != null ? address : operand;
    });

    return { mnemonic, operands };
  });
};

export const assembleInstruction = ({
  mnemonic,
  operands,
}: {
  mnemonic: string;
  operands: string[];
}) => {
  const instruction = getInstruction(mnemonic);
  if (!instruction) throw new Error(`Unknown instruction: ${mnemonic}`);

  return instruction.toMachine(...operands);
};
