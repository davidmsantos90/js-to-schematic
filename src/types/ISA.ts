// Register types

const REGISTERS = Array.from({ length: 16 }, (_, i) => `r${i}`);
export type RegisterName = (typeof REGISTERS)[number];

export const ZERO_REGISTER = "r0"; // register reserved for zero value
export const RETURN_REGISTER = "r15"; // register reserved for return

export type GenericRegisterName = Exclude<
  RegisterName,
  typeof ZERO_REGISTER | typeof RETURN_REGISTER
>;

const isRegisterName = (name?: RegisterName): name is RegisterName =>
  name != null && REGISTERS.includes(name);

export function assertRegisterName(name?: RegisterName): asserts name is RegisterName {
  if (!isRegisterName(name)) {
    throw new Error(`Invalid register name: ${name}`);
  }
}

// Binary types

export type Bit = "0" | "1";

export function asBitArray(value: string | string[]): Bit[] {
  if (typeof value === "string") {
    value = [...value];
  }

  if (!value.every((ch) => ch === "0" || ch === "1")) {
    throw new Error("Invalid binary array");
  }

  return value as Bit[];
}

export type Binary2 = `${Bit}${Bit}`;
export type Binary4 = `${Binary2}${Binary2}`;
export type Binary8 = `${Binary4}${Binary4}`;
export type Binary10 = `${Binary2}${Binary8}`;
export type Binary16 = `${Binary8}${Binary8}`;

export type BinaryString = Binary2 | Binary4 | Binary8 | Binary10 | Binary16;

export function asBinaryString(value: string): BinaryString {
  if (!/^[01]*$/.test(value)) {
    throw new Error("Invalid binary string");
  }

  return value as BinaryString;
}

// ISA definition

export const INSTRUCTION_WORD_SIZE = 16;
export const REGISTER_SIZE = 4;
export const IMMEDIATE_SIZE = 8;
export const ADDRESS_SIZE = 10;
export const MEMORY_SIZE = 256;

export interface Instruction {
  opcode: Binary4;
  description: string;

  toAssembly(...args: string[]): string;
  toMachine(...args: string[]): BinaryString;
}

export interface Register {
  special?: string;
  description: string;
}

export default interface ISA {
  wordSize: typeof INSTRUCTION_WORD_SIZE;
  addressSize: typeof ADDRESS_SIZE;
  memorySize: typeof MEMORY_SIZE;

  registers: Record<RegisterName, Register>;

  instructions: Record<string, Instruction>;
  pseudos: Record<string, Omit<Instruction, "opcode">>;
}
