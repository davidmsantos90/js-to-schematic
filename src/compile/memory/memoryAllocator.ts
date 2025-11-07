import {
  assertMemoryAddress,
  IO_START,
  isMemoryAddress,
  MemoryAddress,
  SP_START,
} from "../../types/memory";

/**
 * Memory Allocator
 *
 * Manages memory allocation for variables and arrays.
 *
 * Memory layout:
 *   0-223: General purpose (variables, arrays, etc.)
 *   224-239: Stack region (16 slots) - SP at 232
 *   240-255: I/O region (16 addresses)
 */

const MAX_ARRAY_OFFSET = 8;
const MAX_MEMORY_ADDRESS = SP_START - 1;

let nextMemoryAddress: MemoryAddress = 0;
const allocateMemoryAddress = (size = 1, scope = 0) => {
  const address = nextMemoryAddress;

  const next = nextMemoryAddress + size;
  if (!isMemoryAddress(next)) {
    throw new Error(
      `Out of memory! Would exceed available space (max address: ${MAX_MEMORY_ADDRESS})`,
    );
  }

  nextMemoryAddress = next;

  return { value: address, size, scope } as const;
};

export default {
  /**
   * Allocate memory for an array.
   * Optimizes base pointer placement to maximize offset usage.
   * With offset range -7 to +8 (max positive offset = 8):
   *   Strategy: Start with base at index 0, decrement only when needed
   *   - Arrays length <= 9 (0-8): base at index 0, use offsets 0 to +8
   *   - Arrays length 10-16: base moves back to accommodate extra elements
   *     * length 10: base at index 1 (offsets -1 to +8)
   *     * length 11: base at index 2 (offsets -2 to +8)
   *     * length 16: base at index 7 (offsets -7 to +8)
   *
   * @param {number} length array length
   * @return array info
   */
  Array(length: number, scope: number) {
    const allocation = allocateMemoryAddress(length, scope);

    const offset: number = Math.max(0, length - MAX_ARRAY_OFFSET - 1);
    const base = allocation.value + offset;
    assertMemoryAddress(base);

    return { ...allocation, base, offset } as const;
  },

  String(length: number, scope: number) {
    return this.Array(length, scope);
  },

  /** Allocate a single memory address. */
  Value(scope: number) {
    return allocateMemoryAddress(1, scope);
  },

  /** Get the next available memory address (for debugging/info). */
  get nextMemoryAddress(): MemoryAddress {
    assertMemoryAddress(nextMemoryAddress);

    return nextMemoryAddress;
  },

  /** Get the maximum available memory address. */
  get maxMemoryAddress(): MemoryAddress {
    assertMemoryAddress(MAX_MEMORY_ADDRESS);

    return MAX_MEMORY_ADDRESS;
  },

  /** Get the stack start address. */
  get stackStart(): MemoryAddress {
    assertMemoryAddress(SP_START);

    return SP_START;
  },

  /** Get the I/O start address. */
  get ioStart(): MemoryAddress {
    assertMemoryAddress(IO_START);

    return IO_START;
  },

  /** Reset memory allocator (useful for testing). */
  reset(): void {
    nextMemoryAddress = 0;
  },
};
