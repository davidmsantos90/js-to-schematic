export const ZERO_REGISTER = "r0"; // register reserved for zero value
export const RETURN_REGISTER = "r15"; // register reserved for return

const INSTRUCTION_WORD_SIZE = 16;
const REGISTER_SIZE = 4;
const IMMEDIATE_SIZE = 8;
const ADDRESS_SIZE = 10;
const MEMORY_SIZE = 256;

const CONDITIONS = {
  /** Equal (Z==1) */
  get eq() { return this._eq; },
  get "=="() { return this._eq; },
  _eq: "00",

  /** Not Equal (Z==0) */
  get ne() { return this._ne; },
  get "!="() { return this._ne; },
  _ne: "01",

  /** Greater Than or Equal (C==1) */
  get ge() { return this._ge; },
  get ">="() { return this._ge; },
  _ge: "10",

  /** Less Than (C==0) */
  get lt() { return this._lt; },
  get "<"() { return this._lt; },
  _lt: "11"
};

const toBinary = (value, bits, signed = false) => {
  let num = parseInt(value, 10);
  if (isNaN(num)) return "0".repeat(bits);

  if (signed && num < 0) {
    num = (1 << bits) + num;
  }

  return num.toString(2).padStart(bits, "0").slice(-bits);
};

const registerToBinary = (reg) => {
  const regNum = parseInt(reg.replace("r", ""), 10);
  if (isNaN(regNum) || regNum < 0 || regNum > 15) {
    throw new Error(`Invalid register: ${reg}`);
  }

  return toBinary(regNum, REGISTER_SIZE);
};

const conditionToBinary = (cond) => {
  const { [cond]: binary } = CONDITIONS;
  if (!binary) {
    throw new Error(`Invalid condition: ${cond}`);
  }

  return binary;
};


// Recreated helper outside ISA: convert two's complement binary string to signed decimal
const binaryToSignedDecimal = (bin) => {
  if (typeof bin !== "string" || !/^[01]+$/.test(bin)) throw new Error("Invalid binary string");
  
  const bits = bin.length;
  if (bits > 30) { // use BigInt for wider values safely
    let val = BigInt("0b" + bin);
    if (bin[0] === '1') val -= (BigInt(1) << BigInt(bits));
    return Number(val);
  }
  
  let value = parseInt(bin, 2);
  if (bin[0] === '1') value -= (1 << bits);
  return value;
}

const ISA = {
  wordSize: INSTRUCTION_WORD_SIZE,
  addressSize: ADDRESS_SIZE,
  memorySize: MEMORY_SIZE,
  fillNulls: true,
  registers: {
    [ZERO_REGISTER]: { special: "zero", description: "Constant value 0, value is discarded" },
    r1: { description: "General purpose" },
    r2: { description: "General purpose" },
    r3: { description: "General purpose" },
    r4: { description: "General purpose" },
    r5: { description: "General purpose" },
    r6: { description: "General purpose" },
    r7: { description: "General purpose" },
    r8: { description: "General purpose" },
    r9: { description: "General purpose" },
    r10: { description: "General purpose" },
    r11: { description: "General purpose" },
    r12: { description: "General purpose" },
    r13: { description: "General purpose" },
    r14: { description: "General purpose" },
    [RETURN_REGISTER]: { special: "return", description: "Return register" }
  },

  getInstruction(mnemonic) {
    const instruction = this.instructions[mnemonic] ?? this.pseudos[mnemonic];
    if (!instruction) {
      throw new Error(`Unknown instruction: ${mnemonic}`);
    }

    return instruction;
  },

  instructions: {
    NOOP: {
      opcode: "0000",
      description: "Does nothing",

      toAssembly() {
        return `NOOP`;
      },
      toMachine() {
        return "0".repeat(INSTRUCTION_WORD_SIZE);
      }
    },
    HALT: {
      opcode: "0001",
      description: "Stops execution",

      toAssembly() {
        return `HALT`;
      },
      toMachine() {
        return `0001${"0".repeat(INSTRUCTION_WORD_SIZE - 4)}`;
      }
    },

    // Arithmetic and logic
    ADD: {
      opcode: "0010",
      description: "Adds regB to regA and stores in regC",

      toAssembly(readA, readB, write) {
        return `ADD ${readA} ${readB} ${write}`;
      },
      toMachine(readA, readB, write) {
        return `0010${registerToBinary(readA)}${registerToBinary(readB)}${registerToBinary(write)}`;
      }
    },
    SUB: {
      opcode: "0011",
      description: "Subtracts regB from regA and stores in regC",

      toAssembly(readA, readB, write) {
        return `SUB ${readA} ${readB} ${write}`;
      },
      toMachine(readA, readB, write) {
        return `0011${registerToBinary(readA)}${registerToBinary(readB)}${registerToBinary(write)}`;
      }
    },
    NOR: {
      opcode: "0100",
      description: "Bitwise NOR between regB and regA, stores in regC",

      toAssembly(readA, readB, write) {
        return `NOR ${readA} ${readB} ${write}`;
      },
      toMachine(readA, readB, write) {
        return `0100${registerToBinary(readA)}${registerToBinary(readB)}${registerToBinary(write)}`;
      }
    },
    AND: {
      opcode: "0101",
      description: "Bitwise AND between regB and regA, stores in regC",

      toAssembly(readA, readB, write) {
        return `AND ${readA} ${readB} ${write}`;
      },
      toMachine(readA, readB, write) {
        return `0101${registerToBinary(readA)}${registerToBinary(readB)}${registerToBinary(write)}`;
      }
    },
    XOR: {
      opcode: "0110",
      description: "Bitwise XOR between regB and regA, stores in regC",

      toAssembly(readA, readB, write) {
        return `XOR ${readA} ${readB} ${write}`;
      },
      toMachine(readA, readB, write) {
        return `0110${registerToBinary(readA)}${registerToBinary(readB)}${registerToBinary(write)}`;
      }
    },
    RSHIFT: {
      opcode: "0111",
      description: "Performs RSHIFT on regA and stores in regC",

      toAssembly(readA, write) {
        return `RSHIFT ${readA} ${write}`;
      },
      toMachine(readA, write) {
        return `0111${registerToBinary(readA)}0000${registerToBinary(write)}`;
      }
    },

    LDI: {
      opcode: "1000",
      description: "Loads an immediate value into a register",

      toAssembly(destination, immediate) {
        return `LDI ${destination} ${immediate}`;
      },
      toMachine(destination, immediate) {
        return `1000${registerToBinary(destination)}${toBinary(immediate, IMMEDIATE_SIZE)}`;
      }
    },
    ADDI: {
      opcode: "1001",
      description: "Adds an immediate value to reg1 and stores in reg1",

      toAssembly(reg, immediate) {
        return `ADDI ${reg} ${immediate}`;
      },
      toMachine(reg, immediate) {
        return `1001${registerToBinary(reg)}${toBinary(immediate, IMMEDIATE_SIZE, true)}`;
      }
    },

    JUMP: {
      opcode: "1010",
      description: "Jumps to the specified address",

      toAssembly(addr) {
        return `JUMP ${addr}`;
      },
      toMachine(addr) {
        return `1010${toBinary(addr, ADDRESS_SIZE + 2)}`;
      }
    },
    BRANCH: {
      opcode: "1011",
      description: "Jumps to the specified address if the condition is true",

      toAssembly(cond, addr) {
        return `BRANCH ${cond} ${addr}`;
      },
      toMachine(cond, addr) {
        return `1011${conditionToBinary(cond)}${toBinary(addr, ADDRESS_SIZE)}`;
      }
    },
    CALL: {
      opcode: "1100",
      description: "Saves return address and jumps to function",

      toAssembly(addr) {
        return `CALL ${addr}`;
      },
      toMachine(addr) {
        return `1100${toBinary(addr, ADDRESS_SIZE + 2)}`;
      }
    },
    RET: {
      opcode: "1101",
      description: "Returns from function (restores address from stack)",

      toAssembly() {
        return `RET`;
      },
      toMachine() {
        return `1101${"0".repeat(INSTRUCTION_WORD_SIZE - 4)}`;
      }
    },

    LOAD: {
      opcode: "1110",
      description: "Loads memory content into a register",

      toAssembly(regA, regB, offset) {
        return `LOAD ${regA} ${regB} ${offset}`;
      },
      toMachine(regA, regB, offset) {
        return `1110${registerToBinary(regA)}${registerToBinary(regB)}${toBinary(offset, 4, true)}`;
      }
    },
    STORE: {
      opcode: "0011",
      description: "Stores register content into memory",

      toAssembly(regA, regB, offset) {
        return `STORE ${regA} ${regB} ${offset}`;
      },
      toMachine(regA, regB, offset = 0) {
        return `0011${registerToBinary(regA)}${registerToBinary(regB)}${toBinary(offset, 4, true)}`;
      }
    },
  },

  pseudos: {
    MOVE: {
      description: "Copy source register into destination register (alias for ADD src r0 dest)",
      toAssembly(source, destination) {
        return `MOVE ${source} ${destination}`;
      },
      toMachine(source, destination) {
        return ISA.instructions.ADD.toMachine(source, ZERO_REGISTER, destination);
      }
    },
    CLEAR: {
      description: "Clear register (alias for LDI reg 0)",
      toAssembly(reg) {
        return `CLEAR ${reg}`;
      },
      toMachine(reg) {
        return ISA.instructions.LDI.toMachine(reg, 0);
      }
    },
    CMP: {
      description: "Compare two registers and set flags (alias for SUB regA regB r0)",
      toAssembly(regA, regB) {
        return `CMP ${regA} ${regB}`;
      },
      toMachine(regA, regB) {
        return ISA.instructions.SUB.toMachine(regA, regB, ZERO_REGISTER);
      }
    },

    // CMPI: {
    //   description: "Compare register with immediate (alias for SUB reg, imm, r0)",
    //   toAssembly(reg, immediate) {
    //     // `CMPI ${reg} ${immediate}`

    //     // need to load the immediate into a temporary register
    //     // Here I use r14 as a reserved temporary
    //     const tempReg = "r14";
    //     return [
    //       `${ISA.instructions.LDI.toAssembly(tempReg, immediate)} ; CMPI ${reg} ${immediate}`,
    //       `${ISA.instructions.SUB.toAssembly(reg, tempReg, ZERO_REGISTER)}`
    //     ];
    //   },
    //   toMachine(reg, immediate) {
    //     const ldi = ISA.instructions.LDI.toMachine(tempReg, immediate);
    //     const sub = ISA.instructions.SUB.toMachine(reg, tempReg, ZERO_REGISTER);
    //     return `${ldi}\n${sub}`;
    //   }
    // },
    SUBI: {
      description: "Subtract immediate from register (alias for ADDI reg, -imm)",
      toAssembly(reg, immediate) {
        return `SUBI ${reg} ${immediate}`;
      },
      toMachine(reg, immediate) {
        return ISA.instructions.ADDI.toMachine(reg, -immediate);
      }
    },
    INC: {
      description: "Increment register by 1 (alias for ADDI reg, 1)",
      toAssembly(reg) {
        return `INC ${reg}`;
      },
      toMachine(reg) {
        return ISA.instructions.ADDI.toMachine(reg, 1);
      }
    },
    DEC: {
      description: "Decrement register by 1 (alias for ADDI reg, -1)",
      toAssembly(reg) {
        return `DEC ${reg}`;
      },
      toMachine(reg) {
        return ISA.instructions.ADDI.toMachine(reg, -1);
      }
    },
    // Saltos condicionais legíveis
    BEQ: {
      description: "Branch if equal (alias for BRANCH == addr)",
      toAssembly(addr) {
        return `BEQ ${addr}`;
      },
      toMachine(addr) {
        return ISA.instructions.BRANCH.toMachine("==", addr);
      }
    },
    BNE: {
      description: "Branch if not equal (alias for BRANCH != addr)",
      toAssembly(addr) {
        return `BNE ${addr}`;
      },
      toMachine(addr) {
        return ISA.instructions.BRANCH.toMachine("!=", addr);
      }
    },
    BGE: {
      description: "Branch if greater or equal (alias for BRANCH >= addr)",
      toAssembly(addr) {
        return `BGE ${addr}`;
      },
      toMachine(addr) {
        return ISA.instructions.BRANCH.toMachine(">=", addr);
      }
    },
    BLT: {
      description: "Branch if less than (alias for BRANCH < addr)",
      toAssembly(addr) {
        return `BLT ${addr}`;
      },
      toMachine(addr) {
        return ISA.instructions.BRANCH.toMachine("<", addr);
      }
    }
  }
};

export default ISA;
