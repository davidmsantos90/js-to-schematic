// Bubble sort with array support using array.length
let array = [64, 34, 25, 12, 22, 11, 90, 88];
let size = array.length - 1;

// let index = 0;
// let bubble = 0;
// let temp = 0;

// Outer loop: iterate through all elements
for (let index = 0; index < size; index++) {
  // Inner loop: compare and swap adjacent elements
  for (let bubble = 0; bubble < size - index; bubble++) {
    let nextBubble = bubble + 1;

    if (array[bubble] > array[nextBubble]) {
      // Swap using destructuring
      [array[bubble], array[nextBubble]] = [array[nextBubble], array[bubble]];
    }
  }
}
