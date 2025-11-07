// Comprehensive string test
let message = "HelloWorld";

// Test length property
let len = message.length; // 10

// Test character access
let first = message[0]; // 'H' (72)
let fifth = message[4]; // 'o' (111)
let last = message[9]; // 'd' (100)

// Test loop with string
let total = 0;
for (let i = 0; i < message.length; i++) {
  let ch = message[i];
  total = total + ch; // Sum all character codes
}
