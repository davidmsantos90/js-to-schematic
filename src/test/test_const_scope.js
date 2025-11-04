// Test const scope behavior

const GLOBAL = 100;

// Outer scope
let outer = GLOBAL;

// Test in while loop (new scope)
let i = 0;
while (i < 1) {
  const INNER = 50;
  let x = INNER + GLOBAL;
  i = i + 1;
}

// Try to use INNER here - should fail if properly scoped
// let y = INNER;  // This would fail

let result = GLOBAL;
