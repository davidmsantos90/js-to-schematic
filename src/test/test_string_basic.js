// Test basic string support (strings as character arrays)

// String literal
let greeting = "Hi";

// String length
let len = greeting.length;  // 2

// Character access by index
let firstChar = greeting[0];  // 72 ('H')
let secondChar = greeting[1]; // 105 ('i')

// String iteration with for-in
for (let i in greeting) {
  let charCode = greeting[i];  // Get character code
}

// String iteration with for-of
for (let char of greeting) {
  // char is the ASCII code
  let value = char;
}
