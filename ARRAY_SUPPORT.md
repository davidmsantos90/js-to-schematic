# Array Support Implementation

## Overview

Arrays are now fully supported in the JavaScript to Assembly compiler. Arrays are stored in memory starting at address 200, with automatic memory allocation and bounds checking.

## Features

### 1. Array Declaration and Initialization

```javascript
let arr = [10, 20, 30, 40];
```

- Arrays are allocated in memory starting at address 200
- Each array element occupies one memory address
- Initial values are stored using STORE instructions
- Memory layout: 200-223 available (24 addresses before stack region)

### 2. Static Index Access (Read)

```javascript
let x = arr[0]; // Load from fixed offset
let y = arr[2]; // Load from fixed offset
```

- Uses LOAD instruction with immediate offset
- Compile-time bounds checking
- Efficient: only one LOAD instruction needed

### 3. Dynamic Index Access (Read)

```javascript
let i = 1;
let value = arr[i]; // Load using variable index
```

- Calculates memory address: base + index
- Uses ADD to compute address, then LOAD with offset 0
- Runtime flexible but requires extra ADD instruction

### 4. Expression in Index (Read)

```javascript
let a = arr[j + 1]; // Load using computed index
let b = arr[i * 2]; // Any expression supported
```

- Evaluates the index expression first
- Creates temporary register for the result
- Does not modify loop variables or other identifiers
- Uses ADD for final address calculation

### 5. Static Index Assignment (Write)

```javascript
arr[0] = 100;
arr[3] = value;
```

- Uses STORE instruction with immediate offset
- Compile-time bounds checking

### 6. Dynamic Index Assignment (Write)

```javascript
let i = 2;
arr[i] = 50;
```

- Calculates memory address: base + index
- Uses ADD then STORE with offset 0

### 7. Expression in Index (Write)

```javascript
arr[j + 1] = arr[j]; // Swap operation
arr[i - 1] = temp;
```

- Evaluates index expression without side effects
- Preserves loop variables and identifiers

## Implementation Details

### Memory Allocation

- Base address: 200
- Auto-increments for each array
- Maximum address: 223 (before stack at 224-239)
- Prevents collision with:
  - Stack region: 224-239 (16 slots)
  - I/O region: 240-255 (16 addresses)

### Register Management

- Arrays tracked separately from regular variables
- `registers.setArray(name, length)` allocates memory
- `registers.getArray(name)` retrieves array info
- Base address loaded into temporary register for each access
- Proper register freeing to prevent exhaustion

### Code Generation Patterns

#### Array Initialization

```assembly
LDI r1 200        ; arr base =
LDI r2 10         ; element value
STORE r1 r2 0     ; arr[0] = 10
LDI r2 20         ; element value
STORE r1 r2 1     ; arr[1] = 20
```

#### Static Index Read

```assembly
LDI r1 200        ; arr base
LOAD r1 r2 3      ; r2 = arr[3]
```

#### Dynamic Index Read

```assembly
LDI r1 200        ; arr base
; r2 already contains index i
ADD r1 r2 r3      ; r3 = base + i
LOAD r3 r4 0      ; r4 = arr[i]
```

#### Expression Index Read (j + 1)

```assembly
LDI r1 200        ; arr base
MOVE r2 r3        ; copy j to temp
ADDI r3 1         ; temp = j + 1
ADD r1 r3 r4      ; r4 = base + (j+1)
LOAD r4 r5 0      ; r5 = arr[j+1]
```

## Example Programs

### Bubble Sort

Complete bubble sort implementation using arrays:

```javascript
let arr = [64, 34, 25, 12, 22, 11, 90, 88];
let i = 0,
  j = 0,
  temp = 0;

for (; i < 7; i++) {
  j = 0;
  for (; j < 7 - i; j++) {
    let a = arr[j];
    let b = arr[j + 1];
    if (a > b) {
      temp = arr[j];
      arr[j] = arr[j + 1];
      arr[j + 1] = temp;
    }
  }
}
```

### Array Sum

```javascript
let numbers = [5, 10, 15, 20, 25];
let i = 0,
  sum = 0;
for (; i < 5; i++) {
  sum += numbers[i];
}
```

## Limitations

1. No dynamic array sizing (length must be known at compile time)
2. No array literals in expressions (only in declarations)
3. Maximum total array space: 24 elements across all arrays
4. No nested arrays or multi-dimensional arrays
5. Array bounds only checked at compile-time for static indices

## Future Enhancements

- Dynamic bounds checking for runtime safety
- Array length property
- Array methods (push, pop, etc.)
- Multi-dimensional arrays
- Larger memory allocation region
