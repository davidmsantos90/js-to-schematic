function fibonacci() {
  let prev = 0;
  let result = 1;

  let n = 5;
  let i = 2;

  let temp = 0;

  while (i < n - 1) {
  // while (true) {
    temp = prev + result;
    
    prev = result;
    result = temp;

    // if (i >= n - 1) {
    //   break;
    // }

    i = i + 1;
  }

  return result;
}

// let result = fibonacci();
// console.log(result);
