// Test array with 16 elements to maximize offset usage
// With base at index 7, we can access:
//   - Elements 0-6: offsets -7 to -1
//   - Elements 7-15: offsets 0 to +8

let largeArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Access different positions to show offset usage
let first = largeArray[0]; // offset -7
let middle = largeArray[7]; // offset 0 (base position)
let last = largeArray[15]; // offset +8
