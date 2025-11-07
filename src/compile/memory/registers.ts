import ISA from "../../ISA";
import { assertRegisterName, GenericRegisterName, RegisterName } from "../../types/ISA";
import {
  ArrayInfo,
  ConstInfo,
  isArrayInfo,
  isConstInfo,
  isMemoryInfo,
  isRegisterInfo,
  MemoryInfo,
  VariableInfo,
} from "../../types/memory";
import memoryAllocator from "./memoryAllocator";

const GENERIC_REGISTERS: GenericRegisterName[] = Object.keys(ISA.registers).filter(
  (key) => ISA.registers[key].special == null,
);

const variables = new Map<string, VariableInfo>();
const registers = new Map<GenericRegisterName, boolean>([
  ...GENERIC_REGISTERS.map((r): [GenericRegisterName, boolean] => [r, false]),
]);

// Track all const names that were ever defined (for scope checking)
const constNames = new Set<string>();

// Scope management
let currentScope = 0;
const scopeStack: number[] = [0]; // Stack to track nested scopes

export default {
  get(key?: string): RegisterName {
    if (!this.has(key)) {
      if (this.wasEverConst(key)) {
        // If this name was ever a const, do not auto-allocate a register
        throw new Error(`Const '${key}' is not defined in this scope`);
      } else {
        return this.next();
      }
    }

    const varInfo = variables.get(key!)!;
    if (isArrayInfo(varInfo)) {
      throw new Error(`Variable ${key} is an array, not a register. Use getArray()`);
    } else if (isConstInfo(varInfo) || isMemoryInfo(varInfo)) {
      throw new Error(
        `Variable ${key} is in memory, not a register. Use getMemory() or getConst()`,
      );
    }

    const value = isRegisterInfo(varInfo) ? varInfo.value : undefined;
    assertRegisterName(value);

    return value;
  },

  /**
   * Set a variable to a register. If variable already has a register, return it.
   *
   * @param {string} key variable name
   * @param {string} [value = null] register name or null
   *
   * @return {string} register name
   */
  set(key: string, value?: RegisterName): RegisterName {
    if (this.has(key)) return this.get(key);

    const reg = value ?? this.next();

    variables.set(key, { type: "register", value: reg, scope: currentScope, size: 1 });

    return reg;
  },

  /**
   * Set a variable to an array in memory.
   * Optimizes base pointer placement to maximize offset usage.
   * With offset range -7 to +8 (max positive offset = 8):
   *   Strategy: Start with base at index 0, decrement only when needed
   *   - Arrays length <= 9 (0-8): base at index 0, use offsets 0 to +8
   *   - Arrays length 10-16: base moves back to accommodate extra elements
   *     * length 10: base at index 1 (offsets -1 to +8)
   *     * length 11: base at index 2 (offsets -2 to +8)
   *     * length 16: base at index 7 (offsets -7 to +8)
   *
   * @param {string} key variable name
   * @param {number} length array length
   *
   * @return {object} { startAddress, baseAddress, size }
   */
  setArray(key: string, length: number) {
    if (this.has(key)) {
      throw new Error(`Variable ${key} already exists`);
    }

    const allocation = memoryAllocator.Array(length, currentScope);
    variables.set(key, { type: "array", ...allocation });

    return allocation;
  },

  setString(key: string, length: number) {
    return this.setArray(key, length);
  },

  /**
   * Allocate a memory address for a variable (when registers are exhausted).
   *
   * @param {string} key variable name
   *
   * @return {number} allocated memory address
   */
  setMemory(key: string): void {
    if (this.has(key)) {
      throw new Error(`Variable ${key} already exists`);
    }

    const allocation = memoryAllocator.Value(currentScope);
    variables.set(key, { type: "memory", ...allocation });
  },

  /**
   * Register a const variable with its value.
   * Const variables are immutable and stored as defines (no memory allocation).
   *
   * @param {string} key variable name
   * @param {string | number} value the constant value
   */
  setConst(key: string, value: string | number): void {
    if (this.has(key)) {
      throw new Error(`Variable ${key} already exists`);
    }

    constNames.add(key); // Track that this name was used as a const
    variables.set(key, { type: "const", value, scope: currentScope, size: 0 });
  },

  /**
   * Get memory address for a variable stored in memory.
   */
  getMemory(key: string): MemoryInfo | ConstInfo | null {
    const info = variables.get(key);

    return isMemoryInfo(info) || isConstInfo(info) ? info : null;
  },

  /**
   * Get value for a const variable.
   */
  getConst(key: string): ConstInfo | null {
    const info = variables.get(key);

    return isConstInfo(info) ? info : null;
  },

  /**
   * Check if a variable is a const.
   */
  isConst(key: string): boolean {
    return isConstInfo(variables.get(key));
  },

  /**
   * Check if a variable name was ever defined as a const (even if out of scope).
   */
  wasEverConst(key: string | undefined): boolean {
    return key != null && constNames.has(key);
  },

  /**
   * Get array info for a variable.
   */
  getArray(key: string): ArrayInfo | null {
    const info = variables.get(key);

    return isArrayInfo(info) ? info : null;
  },

  /**
   * Check if a variable is an array.
   */
  isArray(key: string): boolean {
    return isArrayInfo(variables.get(key));
  },

  /** Check if a variable has been assigned a register. */
  has(key: string | undefined): boolean {
    return key != null && variables.has(key);
  },

  /** Get the next available register. */
  next(): RegisterName {
    const next = GENERIC_REGISTERS.find((reg) => !registers.get(reg));
    if (next == null) throw new Error("Out of registers!");

    registers.set(next, true);

    return next;
  },

  /** Free a register, making it available for reuse. */
  free(...names: RegisterName[]): void {
    for (const reg of names) {
      if (GENERIC_REGISTERS.includes(reg as GenericRegisterName)) {
        registers.set(reg as GenericRegisterName, false);
      }
    }
  },

  /** Enter a new scope (e.g., entering a for loop, if statement, or block) */
  enterScope(): void {
    currentScope++;
    scopeStack.push(currentScope);
  },

  /** Exit the current scope and free all variables declared in it */
  exitScope(): void {
    const exitingScope = scopeStack.pop();
    if (exitingScope === undefined) {
      throw new Error("Cannot exit scope: no scope to exit");
    }

    // Free all variables declared in the exiting scope
    const variablesToRemove: string[] = [];
    for (const [varName, varInfo] of variables.entries()) {
      if (varInfo.scope === exitingScope) {
        // Free the register if it's a register variable
        if (isRegisterInfo(varInfo)) {
          this.free(varInfo.value);
        }

        // Note: We don't reclaim array memory since it might still be needed
        // In a real implementation, we'd need garbage collection
        variablesToRemove.push(varName);
      }
    }

    // Remove variables from the map
    for (const varName of variablesToRemove) {
      variables.delete(varName);
    }

    // Update current scope to parent scope
    currentScope = scopeStack[scopeStack.length - 1] ?? 0;
  },

  /** Get the current scope level (for debugging) */
  get currentScope(): number {
    return currentScope;
  },

  /** Get the next available memory address (for debugging/info) */
  get nextMemoryAddress(): number {
    return memoryAllocator.nextMemoryAddress;
  },

  /** Get the maximum available memory address */
  get maxMemoryAddress(): number {
    return memoryAllocator.maxMemoryAddress;
  },
};
