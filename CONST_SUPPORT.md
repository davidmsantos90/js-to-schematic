# Const Variable Support

## Overview

Added support for `const` variables that are stored in memory (not registers), with immutability guarantees.

## Implementation

### Memory Storage

- `const` variables are always stored in memory
- `let` variables continue to use registers (current behavior)
- Memory allocation: sequential addresses starting from 0

### Key Features

1. **Immutability**: Attempting to reassign a const throws a compile error
2. **Memory-based**: Does not consume registers
3. **Scope-aware**: Consts respect scope boundaries like other variables

## Code Changes

### 1. registers.ts

Added const variable support:

```typescript
interface VariableInfo {
  type: "register" | "array" | "memory" | "const";
  isConst?: boolean; // Flag to prevent reassignment
}
```

New methods:

- `setConst(key)`: Allocate memory address for const
- `getConst(key)`: Get memory address of const
- `isConst(key)`: Check if variable is const

### 2. statementCompiler.ts

**Variable Declaration**:

```typescript
compileVariableDeclaration(node: VariableDeclaration) {
  const isConst = node.kind === "const";

  if (isConst) {
    compileConstDeclaration(name, init);
  } else {
    compileAssignmentExpression(init, name); // let behavior
  }
}
```

**Const Declaration**:

```typescript
compileConstDeclaration(name, init) {
  const address = registers.setConst(name);
  const valueReg = compileValue(init);

  // Store to memory
  LDI addrReg, address
  STORE addrReg, valueReg, 0
}
```

**Immutability Check**:

```typescript
// In assignment expression
if (registers.isConst(left.name)) {
  throw new Error(`Cannot reassign const variable '${left.name}'`);
}
```

**Identifier Assignment** (let x = constY):

```typescript
case "Identifier": {
  const constInfo = registers.getConst(expression.name);
  if (constInfo !== null) {
    // Load const from memory
    LDI addrReg, constInfo.value
    LOAD addrReg, valueReg, 0
    // Then assign to destination register
    MOVE valueReg, destinationReg
  }
}
```

### 3. expressionCompiler.ts

**Reading Const Values**:

```typescript
case "Identifier": {
  const constInfo = registers.getConst(node.name);
  if (constInfo !== null) {
    // Load from memory
    LDI addrReg, constInfo.value
    LOAD addrReg, valueReg, 0
    return valueReg;
  }

  // Regular register variable
  return registers.get(node.name);
}
```

## Examples

### Basic Const

```javascript
const x = 10;
const y = 20;

let sum = x + y; // sum = 30
```

**Assembly**:

```assembly
LDI r1 10
LDI r2 0       ; x addr = 0
STORE r2 r1 0  ; store x to memory[0]

LDI r1 20
LDI r2 1       ; y addr = 1
STORE r2 r1 0  ; store y to memory[1]

LDI r1 0       ; x addr
LOAD r1 r2 0   ; load x from memory
LDI r1 1       ; y addr
LOAD r1 r3 0   ; load y from memory
ADD r2 r3 r1   ; sum = x + y
```

### Const with Arrays

```javascript
const size = 5;
let arr = [1, 2, 3, 4, 5];

let last = arr[size - 1];
```

**Memory Layout**:

```
Address 0: size = 5
Address 1-5: arr = [1, 2, 3, 4, 5]
```

### Immutability Protection

```javascript
const x = 10;
x = 20; // ❌ Error: Cannot reassign const variable 'x'
```

## Benefits

1. **Register Preservation**: Const variables don't consume registers
2. **Clear Intent**: Distinguishes between mutable (let) and immutable (const) values
3. **Memory Efficient**: Const values stored once in memory
4. **Type Safety**: Compile-time immutability checks

## Memory Layout

```
Memory Regions:
0-223:   General purpose
         - Const variables (sequential allocation)
         - Arrays
         - Memory-spilled let variables (future)
224-239: Stack (SP=232)
240-255: I/O region
```

## Comparison: Let vs Const

| Feature       | `let`                      | `const`                      |
| ------------- | -------------------------- | ---------------------------- |
| Storage       | Register                   | Memory                       |
| Mutable       | ✅ Yes                     | ❌ No                        |
| Register Cost | 1 register                 | 0 registers                  |
| Access Cost   | Direct                     | LDI + LOAD (2 instructions)  |
| Best For      | Loop counters, temp values | Configuration, sizes, limits |

## Use Cases

### Good Use of Const

```javascript
const MAX_SIZE = 100;
const MIN_VALUE = 0;
const ARRAY_LENGTH = 10;

let arr = new Array(ARRAY_LENGTH);
```

### Good Use of Let

```javascript
let counter = 0;
let temp = a + b;
let result = compute();
```

## Testing

✅ Basic const declaration and usage
✅ Const with arithmetic expressions
✅ Const used in array access
✅ Immutability protection (compile error)
✅ Multiple const variables
✅ Mixing let and const
✅ Fibonacci (no const variables)
