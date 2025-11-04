// Test const variable support

// Const variables are stored in memory
const x = 10;
const y = 20;

// Let variables use registers (current behavior)
let a = x + y;
let b = x + 5;

// Use const in expressions
let result = a + b + x;
