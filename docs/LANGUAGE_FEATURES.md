# Language Features

This document provides a comprehensive guide to all JavaScript features supported by the compiler.

## Table of Contents

- [Variables and Constants](#variables-and-constants)
- [Arrays](#arrays)
- [Strings](#strings)
- [Control Flow](#control-flow)
- [Functions](#functions)
- [Exception Handling](#exception-handling)
- [Operators and Expressions](#operators-and-expressions)

---

## Variables and Constants

### Variable Declaration (`let`)

Variables can be declared and reassigned:

```javascript
let x = 10;
x = x + 5; // x is now 15
```

### Constant Declaration (`const`)

Constants must be initialized and cannot be reassigned:

```javascript
const PI = 3;
// PI = 4;  // Error: Cannot reassign constant
```

### Scoping

Both `let` and `const` have block-level scoping:

```javascript
function example() {
  let x = 1;

  if (true) {
    let x = 2; // Different variable
    const y = 3;
    // y is only accessible here
  }

  // x is 1 here, y is not accessible
}
```

### Implementation Details

- Variables stored in registers when possible
- Spilled to memory when register pressure is high
- Constants use the same infrastructure but with write protection
- Scope management via `registers.enterScope()` and `registers.exitScope()`

---

## Arrays

### Array Declaration

```javascript
let arr = [1, 2, 3, 4, 5];
```

### Array Access

```javascript
let first = arr[0];
let last = arr[4];
```

### Array Modification

```javascript
arr[0] = 10;
arr[i] = arr[i] + 1;
```

### Array Length

The `.length` property is supported for arrays (compile-time known size):

```javascript
let arr = [1, 2, 3, 4, 5];
for (let i = 0; i < arr.length; i++) {
  // Process arr[i]
}
```

**Note**: Array length is determined at compile time from the array declaration, not dynamically at runtime.

### Optimizations

1. **Offset Optimization**: Uses base + offset instead of separate ADD
   - Before: `ADD temp, base, index; LOAD result, temp, 0`
   - After: `LOAD result, base, index`

2. **Memory Layout**: Contiguous allocation in data segment

---

## Strings

Strings are implemented as **character arrays** where each character is stored as its ASCII/Unicode value.

### String Declaration

```javascript
let str = "hello";  // Stored as [104, 101, 108, 108, 111]
```

### String Access

```javascript
let firstChar = str[0];  // Access character by index (returns ASCII code)
let lastChar = str[4];   // str[4] = 111 ('o')
```

### String Length

```javascript
let str = "hello";
let len = str.length;  // len = 5 (compile-time known)
```

### String Iteration

```javascript
// For-in loop (iterate over indices)
for (let i in str) {
  let charCode = str[i];  // Get character code at index
}

// For-of loop (iterate over values)
for (let charCode of str) {
  // charCode is the ASCII value
}
```

### Implementation Details

- **Strings are immutable character arrays**: Same memory layout as arrays
- **Character codes**: Each character stored as its integer ASCII/Unicode value
- **Fixed size**: String length determined at compile time
- **All array operations work**: Length, indexing, iteration

**Note**: String literals are compiled to array allocations with character codes.

---

## Control Flow

### If Statement

```javascript
if (condition) {
  // then block
}

if (condition) {
  // then block
} else {
  // else block
}
```

### Else-If Chains

```javascript
if (condition1) {
  // block 1
} else if (condition2) {
  // block 2
} else if (condition3) {
  // block 3
} else {
  // default block
}
```

**Note**: Else-if is supported through nested if statements in the AST, which the compiler handles automatically.

### Switch Statement

```javascript
switch (value) {
  case 0:
    // code
    break;
  case 1:
  case 2:
    // code (fall-through from case 1)
    break;
  default:
  // default code
}
```

**Implementation**: Uses SUB and BEQ for case matching, supports fall-through.

### For Loop

```javascript
for (let i = 0; i < 10; i++) {
  // loop body
}
```

### For-In Loop

Iterates over array **indices**:

```javascript
let arr = [10, 20, 30];
for (let i in arr) {
  // i is 0, 1, 2
  let value = arr[i];
}
```

### For-Of Loop

Iterates over array **values**:

```javascript
let arr = [10, 20, 30];
for (let value of arr) {
  // value is 10, 20, 30
  let result = value * 2;
}
```

### While Loop

```javascript
while (condition) {
  // loop body
}
```

### Do-While Loop

```javascript
do {
  // loop body
} while (condition);
```

### Break and Continue

```javascript
for (let i = 0; i < 10; i++) {
  if (i === 5) break; // Exit loop
  if (i === 3) continue; // Skip iteration
}
```

---

## Functions

### Function Declaration

```javascript
function add(a, b) {
  return a + b;
}
```

### Function Calls

```javascript
let result = add(5, 3);
```

### Parameters

Parameters are passed via the stack:

- First parameter at `[SP + 0]`
- Second parameter at `[SP - 1]`
- Third parameter at `[SP - 2]`
- etc.

### Return Values

Return values are stored at `[SP + 1]`:

```javascript
function getValue() {
  return 42;
}

let x = getValue(); // x = 42
```

### Implementation

```assembly
function_name_start:
  ; Load parameters from stack
  LOAD $sp, $param1, 0
  LOAD $sp, $param2, -1

  ; Function body
  ; ...

  ; Store return value
  STORE $sp, $result, 1
  RET
function_name_end:
```

---

## Exception Handling

### Throw Statement

```javascript
throw value;
```

Throws an exception with the given value.

### Try-Catch Statement

```javascript
try {
  // code that may throw
  throw 42;
} catch (e) {
  // handle exception
  return e;
}
```

### Try-Catch-Finally Statement

```javascript
try {
  // code that may throw
} catch (e) {
  // handle exception
} finally {
  // always executed
}
```

### Try-Finally Statement

```javascript
try {
  // code
} finally {
  // cleanup code always runs
}
```

### Implementation Details

**Stack-Based Exception Passing**:

- Exception values stored at `[SP + 1]` (same as return values)
- Mutually exclusive with returns (either throw OR return)

**Error Handler Stack**:

- `errorHandlerStack` tracks active catch blocks
- Push catch label when entering try block
- Pop when exiting try block
- Jump to catch on throw, or HALT if no handler

**Example Assembly**:

```assembly
try_0_start:
  ; Push "catch_0" to errorHandlerStack
  ; ... try block code ...
  JUMP finally_0  ; Skip catch if no error

catch_0:
  LOAD $sp, $e, 1  ; Load exception from [SP + 1]
  ; ... catch block code ...

finally_0:
  ; ... finally block code ...
  JUMP after_try_0

after_try_0:
try_0_end:
```

---

## Operators and Expressions

### Arithmetic Operators

```javascript
let a = 10 + 5; // Addition
let b = 10 - 5; // Subtraction
let c = 10 * 5; // Multiplication
let d = 10 / 5; // Division
let e = 10 % 3; // Modulus
```

### Comparison Operators

```javascript
x == y; // Equal
x != y; // Not equal
x < y; // Less than
x > y; // Greater than
x <= y; // Less than or equal
x >= y; // Greater than or equal
```

### Logical Operators

```javascript
a && b; // Logical AND (short-circuit)
a || b; // Logical OR (short-circuit)
!a; // Logical NOT
```

### Assignment Operators

```javascript
x = 5; // Assignment
x += 5; // Add and assign
x -= 5; // Subtract and assign
x *= 5; // Multiply and assign
x /= 5; // Divide and assign
x %= 5; // Modulus and assign
```

### Update Operators

```javascript
++x; // Pre-increment
x++; // Post-increment
--x; // Pre-decrement
x--; // Post-decrement
```

### Member Access

```javascript
arr[i]; // Array access
arr[i + 1]; // With expression
arr[0] = value; // Assignment
```

### Operator Precedence

Follows standard JavaScript operator precedence.

---

## Limitations

1. **No floating-point numbers** - Only integers supported
2. **No objects** - Only arrays, strings (as character arrays), and primitives
3. **No dynamic arrays** - Fixed size at declaration, determined at compile time
4. **No hoisting** - Variables must be declared before use
5. **No closures** - Functions cannot capture outer scope
6. **Limited exception propagation** - Exceptions don't cross function boundaries
7. **No type coercion** - Strict type handling
8. **No console.log** - No I/O operations or printing
9. **No runtime array/string length** - Length is compile-time constant from declaration
10. **No ternary operator** - Use if-else statements
11. **No string methods** - Only indexing and length (strings are character arrays)
12. **Strings are immutable** - Cannot modify individual characters after creation

---

## Best Practices

1. **Initialize variables**: Always initialize variables at declaration
2. **Use const by default**: Use `const` unless reassignment is needed
3. **Avoid deep nesting**: Keep code flat for better assembly generation
4. **Use meaningful names**: Helps with debugging assembly output
5. **Keep functions small**: Reduces register pressure and improves readability
6. **Use break in switch**: Avoid unintended fall-through unless desired
7. **Handle exceptions locally**: Try-catch should be in same function as throw

---

For implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).
