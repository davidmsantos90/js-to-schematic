function getValue() {
  return 5;
}

function subtract(a, b) {
  return a - b;
}

// Test += operator
let x = 10;
x += 5;  // x should be 15

// Test subtraction
let y = 20 - 8;  // y should be 12

// Test expression with function call
let z = 100 + getValue();  // z should be 105

// Test -= operator
let w = 50;
w -= 10;  // w should be 40

// Test complex expression
let result = subtract(30, 5) + 10;  // result should be 35
