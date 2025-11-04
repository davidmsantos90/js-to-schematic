// Comprehensive test of optimized array base pointer
// Demonstrates efficient offset usage for arrays of different sizes

// Small array (3 elements): base at index 2 (last element)
// Offsets: -2, -1, 0
let small = [10, 20, 30];

// Medium array (8 elements): base at index 7 (last element)
// Offsets: -7, -6, -5, -4, -3, -2, -1, 0
let medium = [1, 2, 3, 4, 5, 6, 7, 8];

// Large array (16 elements): base at index 7 (middle)
// Offsets: -7 to +8 (full range!)
let large = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Access patterns showing offset usage
let s0 = small[0]; // offset -2
let s2 = small[2]; // offset 0

let m0 = medium[0]; // offset -7
let m7 = medium[7]; // offset 0

let l0 = large[0]; // offset -7 (min)
let l7 = large[7]; // offset 0 (base)
let l15 = large[15]; // offset +8 (max)

// Summary:
// - All static accesses use immediate offsets (no address calculation!)
// - Maximizes offset range utilization
// - For 16-element arrays, ALL elements accessible via offsets
