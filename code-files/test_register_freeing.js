function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  let result = 0;
  let i = 0;
  for (; i < b; i++) {
    result = add(result, a);
  }
  return result;
}

let x = multiply(3, 4);  // Should call multiply which calls add multiple times
let y = add(x, 5);       // Another call to add
