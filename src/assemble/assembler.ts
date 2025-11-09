import { getInstruction } from "../ISA";

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
  const constants: Record<string, string> = {};

  // First pass: collect constants and labels
  let address = 0;
  for (const line of cleanup(program)) {
    // Handle define directive
    if (line.startsWith("define ")) {
      const parts = line.substring(7).trim().split(/\s+/);
      if (parts.length === 2) {
        const [name, value] = parts;
        constants[name] = value;
      }
      continue; // Don't count defines as instructions
    }

    if (line.startsWith(".")) {
      labels[line] = `${address}`;
    } else {
      instructions.push(line);
      // Find the original line from the program (before cleanup)
      const originalLine =
        program.find((progLine) => {
          const [code] = progLine.split(";");
          return code.trim() === line;
        }) || line;
      originalLines.push(originalLine.trim());
      address++;
    }
  }

  // Second pass: replace constants and labels in operands
  return instructions.map((line, index) => {
    const [mnemonic, ...opsRaw] = line.split(" ");
    const operands = opsRaw.map((operand) => {
      // First check if it's a constant
      if (constants[operand] != null) {
        return constants[operand];
      }

      // Then check if it's a label
      const { [operand]: address } = labels;
      return address != null ? address : operand;
    });

    // Extract original comment from compile phase (if exists)
    const originalLine = originalLines[index];
    const originalCommentMatch = originalLine.match(/;\s*(.+)$/);
    const originalComment = originalCommentMatch ? originalCommentMatch[1] : null;

    // Create enhanced assembly with resolved addresses
    let enhancedAssembly = `${mnemonic} ${operands.join(" ")}`;
    const labelComments: string[] = [];
    const constantComments: string[] = [];

    // Collect label and constant references for comment
    opsRaw.forEach((operand) => {
      if (labels[operand] != null) {
        labelComments.push(operand);
      } else if (constants[operand] != null) {
        constantComments.push(`${operand}=${constants[operand]}`);
      }
    });

    // Build comment section: labels/constants first, then original comment
    const commentParts: string[] = [];
    if (labelComments.length > 0 || constantComments.length > 0) {
      commentParts.push([...labelComments, ...constantComments].join(", "));
    }

    if (originalComment) {
      commentParts.push(originalComment);
    }

    if (commentParts.length > 0) {
      enhancedAssembly += ` ; ${commentParts.join(" | ")}`;
    }

    return {
      mnemonic,
      operands,
      originalAssembly: enhancedAssembly,
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
    assembly: originalAssembly,
  };
};
