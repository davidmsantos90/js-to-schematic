// Test unified memory allocation starting at address 0
// Arrays and future memory-based variables will use sequential addresses

// First array: should be at address 0-2
let arr1 = [10, 20, 30];

// Second array: should be at address 3-6
let arr2 = [40, 50, 60, 70];

// Third array: should be at address 7-9
let arr3 = [80, 90, 100];

// Access arrays
let x = arr1[0]; // 10 from address 0
let y = arr2[2]; // 60 from address 5
let z = arr3[1]; // 90 from address 8

// Total memory used: 10 addresses (0-9)
// Available memory: 0-223 (224 addresses before stack)
// Stack: 224-239
// I/O: 240-255
