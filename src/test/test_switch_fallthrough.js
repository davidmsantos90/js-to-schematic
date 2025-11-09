// Test switch statement with fall-through behavior
function testSwitch(x) {
  let result = 0;

  switch (x) {
    case 1:
    case 2:
      result = 12; // Both 1 and 2 fall through to here
      break;
    case 3:
      result = 3;
      break;
    default:
      result = 99;
  }

  return result;
}

// Test cases
let test1 = testSwitch(1); // Should be 12
let test2 = testSwitch(2); // Should be 12
let test3 = testSwitch(3); // Should be 3
let test4 = testSwitch(99); // Should be 99
