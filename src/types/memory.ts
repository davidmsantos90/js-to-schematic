import { RegisterName } from "./ISA";

/** Total memory size (0-255) */
export const MEMORY_SIZE = 256 as const;

/**
 * Stack pointer optimized for 4-bit signed offset range
 * With SP=232: accessible range is [232-8, 232+7] = [224, 239] (16 slots)
 *  - parameters: SP+0, SP-1, SP-2, ... (down to SP-8)
 *  - return value: SP+1, SP+2, ... (up to SP+7)
 *
 * Stays clear of I/O region (240-255)
 */
export const STACK_POINTER = 232 as const;

export const SP_START = 224 as const;

/**
 * Memory-Mapped I/O Addresses (240-255)
 * Data memory addresses 240-255 are reserved for I/O operations
 */

/** Start of I/O region (240-255) */
export const IO_START = 240 as const;

/**
 * Screen I/O - 32x32 Lamp Display
 * Uses memory-mapped addresses to control screen pixels and buffers (240-246)
 */

/** [screen] Store Only: Bottom 5 bits are X coordinate */
export const IO_SCREEN_PIXEL_X = 240 as const;

/** [screen] Store Only: Bottom 5 bits are Y coordinate */
export const IO_SCREEN_PIXEL_Y = 241 as const;

/** [screen] Store Only: Draw pixel at (Pixel X, Pixel Y) to buffer */
export const IO_SCREEN_PIXEL_DRAW = 242 as const;

/** [screen] Store Only: Clear pixel at (Pixel X, Pixel Y) to buffer */
export const IO_SCREEN_PIXEL_CLEAR = 243 as const;

/** [screen] Load Only: Load Pixel at (Pixel X, Pixel Y) - returns 0 or 1 */
export const IO_SCREEN_PIXEL_LOAD = 244 as const;

/** [screen] Store Only: Push screen buffer */
export const IO_SCREEN_BUFFER = 245 as const;

/** [screen] Store Only: Clear screen buffer */
export const IO_SCREEN_BUFFER_CLEAR = 246 as const;

/**
 * Character Display I/O - 10 characters (247-249)
 */

/** [chars]: Store Only - Write character to buffer */
export const IO_CHARS_DISPLAY_WRITE = 247 as const;

/** [chars]: Store Only - Push character buffer */
export const IO_CHARS_DISPLAY_BUFFER = 248 as const;

/** [chars]: Store Only - Clear character buffer */
export const IO_CHARS_DISPLAY_BUFFER_CLEAR = 249 as const;

/**
 * Numbers Display I/O - 8-bit signed or unsigned (250-253)
 */

/** [numbers]: Store Only - Show number on display */
export const IO_NUMBERS_SHOW = 250 as const;

/** [numbers]: Store Only - Clear number display */
export const IO_NUMBERS_CLEAR = 251 as const;

/** [numbers]: Store Only - Interpret number as 2's complement [-128, 127] */
export const IO_NUMBERS_SIGNED_MODE = 252 as const;

/** [numbers]: Store Only - Interpret number as unsigned int [0, 255] */
export const IO_NUMBERS_UNSIGNED_MODE = 253 as const;

/**
 * Random Number Generator I/O - 8-bit random number (254)
 * Uses a Linear Feedback Shift Register (LFSR) to produce pseudo-random numbers
 */

/** [rng]: Load Only - Load a random 8-bit number */
export const IO_RNG = 254 as const;

/**
 * Controller Input I/O - 8-bit controller input (255)
 * Inputs: Start, Select, A, B, Up, Right, Down, Left
 */

/** [controller]: Load Only - Load controller input information */
export const IO_CONTROLLER_INPUT = 255 as const;

// Helper type to enumerate numbers 0..N-1
type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

export type MemoryAddress = Enumerate<typeof SP_START>; // 0..223 (excluding SP addresses | I/O addresses)
export function isMemoryAddress(addr: number): addr is MemoryAddress {
  return addr >= 0 && addr < SP_START;
}
export function assertMemoryAddress(addr: number): asserts addr is MemoryAddress {
  if (!isMemoryAddress(addr)) {
    throw new Error(
      `Invalid memory address: ${addr}. ${addr < 0 ? "Address must be positive." : "Address exceeds maximum."}`,
    );
  }
}

export type IOAddress =
  | typeof STACK_POINTER
  | typeof IO_SCREEN_PIXEL_X
  | typeof IO_SCREEN_PIXEL_Y
  | typeof IO_SCREEN_PIXEL_DRAW
  | typeof IO_SCREEN_PIXEL_CLEAR
  | typeof IO_SCREEN_PIXEL_LOAD
  | typeof IO_SCREEN_BUFFER
  | typeof IO_SCREEN_BUFFER_CLEAR
  | typeof IO_CHARS_DISPLAY_WRITE
  | typeof IO_CHARS_DISPLAY_BUFFER
  | typeof IO_CHARS_DISPLAY_BUFFER_CLEAR
  | typeof IO_NUMBERS_SHOW
  | typeof IO_NUMBERS_CLEAR
  | typeof IO_NUMBERS_SIGNED_MODE
  | typeof IO_NUMBERS_UNSIGNED_MODE
  | typeof IO_RNG
  | typeof IO_CONTROLLER_INPUT;

export type SPAddress = Exclude<MemoryAddress, IOAddress>;

export type Address = MemoryAddress | SPAddress | IOAddress; // 0..255

type VariableValue = RegisterName | MemoryAddress | number | string;

interface Info {
  type: "register" | "array" | "memory" | "const";
  value: VariableValue;
  scope: number; // Track which scope this variable belongs to
  size: number; // Size of the variable in bytes
}

export interface RegisterInfo extends Info {
  type: "register";
  value: RegisterName;
}
export const isRegisterInfo = (info?: Info): info is RegisterInfo => info?.type === "register";

export interface MemoryInfo extends Info {
  type: "memory";
  value: MemoryAddress;
}
export const isMemoryInfo = (info?: Info): info is MemoryInfo => info?.type === "memory";

export interface ConstInfo extends Info {
  type: "const";
  value: string | number;
}
export const isConstInfo = (info?: Info): info is ConstInfo => info?.type === "const";

export interface ArrayInfo extends Info {
  type: "array";
  value: MemoryAddress;
  base: MemoryAddress;
  offset: number;
}
export const isArrayInfo = (info?: Info): info is ArrayInfo => info?.type === "array";

export type VariableInfo = RegisterInfo | ArrayInfo | MemoryInfo | ConstInfo;
