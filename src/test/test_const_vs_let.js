// Comprehensive test: const (define) vs let (register)

// Constants - compiled to defines (no memory/registers)
const MAX_VALUE = 100;
const MIN_VALUE = 0;
const THRESHOLD = 50;

// Let variables - use registers
let current = MIN_VALUE;
let target = MAX_VALUE;
let check = THRESHOLD;

// Computation using both const and let
let range = target - current; // 100 - 0 = 100
let isAbove = range - check; // 100 - 50 = 50

// Consts can be reused multiple times at no cost
let test1 = MAX_VALUE + MIN_VALUE; // Uses defines
let test2 = MAX_VALUE - THRESHOLD; // Uses defines
let result = test1 + test2;
