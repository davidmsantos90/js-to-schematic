function fibonacci() {
  let n = 10;
  let i = 2;

  let temp = 0;

  let prev = 0;
  let curr = 1;

  while (i < n - 1) {
    temp = prev + curr;
    
    prev = curr;
    curr = temp;

    i = i + 1;
  }

  return curr;
}

let result = fibonacci();
