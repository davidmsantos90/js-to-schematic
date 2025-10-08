import ISA, { RETURN_REGISTER } from "../ISA.js";

const GENERIC_REGISTERS = Object.keys(ISA.registers)
  .filter((key) => ISA.registers[key].special == null);

export default {
  _counter: 0,
  _variables: new Map(),
  _registers: new Map([
    ...GENERIC_REGISTERS.map((r) => [r, false]),
    // [RETURN_REGISTER, null]
  ]),

  // Return register value for function return (r15)
  _return: null,
  get return() {
    return this._return;
  },
  set return(varName) {
    this._return = varName;
  },
  
  get(varName) {
    if (varName == null || !this.has(varName)) {
      return this.next();
    }

    return this._variables.get(varName);
  },

  /**
   * Set a variable to a register.If variable already has a register, return it.
   *
   * @param {string} key variable name
   * @param {string} [value = null] register name or null
   *
   * @return {string} register name
   */
  set(key, value = null) {
    // console.debug(`\nSetting register for "${key}"`);
    if (this.has(key)) return this.get(key);

    const reg = value ?? this.next();

    this._variables.set(key, reg);
    // console.debug(`set("${key}", "${reg}")\n`);

    return reg;
  },

  /**
   * Check if a variable has been assigned a register.
   *
   * @param {string} varName variable name
   * @return {boolean} true if variable has a register assigned
   */
  has(varName) {
    return this._variables.has(varName);
  },

  /**
   * Get the next available register.
   *
   * @return {string} next available register
   */
  next() {
    const next = GENERIC_REGISTERS.find((reg) => !this._registers.get(reg));
    if (next == null) throw new Error("Out of registers!");
    
    this._registers.set(next, true);

    return next;
  }
};
