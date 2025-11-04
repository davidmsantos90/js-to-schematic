// Test comprehensive array destructuring scenarios
let a = 1;
let b = 2;
let c = 3;

// Simple swap
[a, b] = [b, a];

// Three-way rotation
[a, b, c] = [c, a, b];

// Swap with expressions (should work since we evaluate right side first)
let x = 10;
let y = 20;
[x, y] = [y + 5, x - 3];
