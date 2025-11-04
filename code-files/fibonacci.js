function fibonacci(n) {
  let prev = 0;
  if (n === 0) return prev;

  let fib = 1;

  while (n > 0) {
    [prev, fib] = [fib, prev + fib];

    n--;
  }

  return fib;
}

let result = fibonacci(10);
