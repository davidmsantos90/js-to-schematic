// Complex nested comparisons to test register freeing
let arr = [5, 3, 8, 1, 9, 2];
let i = 0;

for (; i < arr.length; i++) {
  let val = arr[i];

  if (val > 0) {
    if (val < 10) {
      if (val !== 5) {
        let doubled = val + val;
      }
    }
  }
}
