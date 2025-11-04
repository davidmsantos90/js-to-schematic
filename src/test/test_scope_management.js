// Test scope-based register freeing
let global1 = 10;
let global2 = 20;

// Outer scope variable
let outer = 30;

for (let i = 0; i < 3; i++) {
  // Loop scope variables - should be freed when loop exits
  let loopVar1 = i + 1;
  let loopVar2 = i + 2;

  if (i > 0) {
    // If scope variables - should be freed when if exits
    let ifVar1 = 100;
    let ifVar2 = 200;
    let sum = ifVar1 + ifVar2;
  }

  // After if block, ifVar registers should be available
  let afterIf = loopVar1 + loopVar2;
}

// After loop, loop variable registers should be available and reused
let afterLoop1 = global1 + global2;
let afterLoop2 = outer + 40;
