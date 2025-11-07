// Test basic throw statement without try-catch
function throwError() {
  throw 42;
}

// Test throw with expression
function throwExpression() {
  let x = 10;
  throw x + 5;
}

// Test throw in conditional
function throwConditional(value) {
  if (value < 0) {
    throw -1;
  }
  return value;
}
