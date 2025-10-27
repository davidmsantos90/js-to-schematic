function fibonacci(n) {
  let prev = 0; // F(0)
  // console.log(`step 0 -> ${prev}`);
  if (n === 0) return prev;

  let fib = 1; // F(1)
  // console.log(`step 1 -> ${fib}`);
  // if (n === 1) return fib;

  let temp = 0;

  for (let i = 2; i <= n; i++) { // from F(2) to F(n)
    temp = prev + fib;

    prev = fib;
    fib = temp;

    // console.log(`step ${i} -> ${fib}`);
  }

  return fib;
}

let result = fibonacci(10);
