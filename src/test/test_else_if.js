// Test else-if statement compilation
function classify(x) {
  let result = 0;

  if (x === 1) {
    result = 10;
  } else if (x === 2) {
    result = 20;
  } else if (x === 3) {
    result = 30;
  } else {
    result = 40;
  }

  return result;
}

// Test with different values
let test1 = classify(1); // Should be 10
let test2 = classify(2); // Should be 20
let test3 = classify(3); // Should be 30
let test4 = classify(5); // Should be 40
