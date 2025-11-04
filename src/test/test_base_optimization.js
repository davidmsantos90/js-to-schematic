// Test optimized base pointer strategy:
// Start with base at 0, only use negative offsets when necessary

// Array with 3 elements: base at 0, offsets 0, 1, 2
let arr3 = [10, 20, 30];

// Array with 9 elements: base at 0, offsets 0-8 (max positive)
let arr9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Array with 10 elements: base at 1, offsets -1 to 8
let arr10 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Array with 16 elements: base at 7, offsets -7 to 8
let arr16 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Access patterns
let a3_0 = arr3[0]; // offset 0
let a3_2 = arr3[2]; // offset 2

let a9_0 = arr9[0]; // offset 0
let a9_8 = arr9[8]; // offset 8 (max positive)

let a10_0 = arr10[0]; // offset -1 (first negative!)
let a10_9 = arr10[9]; // offset 8

let a16_0 = arr16[0]; // offset -7 (min)
let a16_15 = arr16[15]; // offset 8 (max)
