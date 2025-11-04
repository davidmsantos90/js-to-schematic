// Test const scope leakage

let i = 0;
while (i < 1) {
  const INNER = 50;
  let x = INNER;
  i = i + 1;
}

// Try to use INNER outside its scope
let y = INNER; // Should fail!
