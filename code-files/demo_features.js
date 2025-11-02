// Test file demonstrating += , -= , subtraction, and expressions with function calls

function double(x) {
  return x + x;
}

function addFive(x) {
  return x + 5;
}

// Test basic subtraction
let a = 10 - 3;  // a = 7

// Test += operator
let b = 5;
b += 10;  // b = 15

// Test -= operator  
let c = 20;
c -= 8;   // c = 12

// Test expression with function call on right
let d = 100 + double(5);  // d = 110

// Test expression with function call on left
let e = double(10) + 5;  // e = 25

// Test compound expression with two function calls
let f = double(3) + double(4);  // f = 14
