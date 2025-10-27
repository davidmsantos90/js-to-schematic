import { assertRegisterName, GenericRegisterName, RegisterName } from "../types/ISA.js";
import ISA from "../ISA.js";

const GENERIC_REGISTERS: GenericRegisterName[] = Object.keys(ISA.registers).filter(
  (key) => ISA.registers[key].special == null,
);

const variables = new Map<string, RegisterName>();
const registers = new Map<GenericRegisterName, boolean>([
  ...GENERIC_REGISTERS.map((r): [GenericRegisterName, boolean] => [r, false]),
]);

export default {
  get(key: string | undefined): RegisterName {
    if (key == null || !this.has(key)) {
      return this.next();
    }

    const value: RegisterName = variables.get(key)!;

    assertRegisterName(value);

    return value;
  },

  /**
   * Set a variable to a register.If variable already has a register, return it.
   *
   * @param {string} key variable name
   * @param {string} [value = null] register name or null
   *
   * @return {string} register name
   */
  set(key: string, value?: RegisterName): RegisterName {
    // console.debug(`\nSetting register for "${key}"`);
    if (this.has(key)) return this.get(key);

    const reg = value ?? this.next();

    variables.set(key, reg);
    // console.debug(`set("${key}", "${reg}")\n`);

    return reg;
  },

  /** Check if a variable has been assigned a register. */
  has(varName: string): boolean {
    return variables.has(varName);
  },

  /** Get the next available register. */
  next(): RegisterName {
    const next = GENERIC_REGISTERS.find((reg) => !registers.get(reg));
    if (next == null) throw new Error("Out of registers!");

    registers.set(next, true);

    return next;
  },
};
