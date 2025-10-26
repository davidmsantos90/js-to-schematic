function fibonacci() {
  let prev = 0; // F(0)
  let result = 1; // F(1)

  let n = 10; // F(n)
  let i = 2;

  let temp = 0;

  while (n >= i) {
    temp = prev + result;
    
    prev = result;
    result = temp;

    i = i + 1;
  }

  return result;
}

let result = fibonacci();
