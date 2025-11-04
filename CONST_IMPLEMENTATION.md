# Const Variable Implementation

## Overview

`const` variables are compiled to assembly `define` directives, providing compile-time constant substitution without using memory or registers.

## Implementation Strategy

### Define-Based Approach

Instead of allocating memory for const variables, we:

1. Emit a `define` directive at compile time
2. Use the const name as an immediate value
3. Let the assembler substitute the actual value

### Benefits

✅ **No memory allocation** - saves precious memory space (0-223)
✅ **No LOAD instructions** - faster execution
✅ **Compile-time substitution** - values inlined by assembler
✅ **Immutable** - cannot be reassigned (compile-time check)

## Examples

### Basic Const Usage

```javascript
const MAX = 100;
const MIN = 0;

let x = MAX + MIN;
```

Compiles to:

```assembly
define MAX 100
define MIN 0

LDI r1 MAX      ; Assembler substitutes: LDI r1 100
LDI r2 MIN      ; Assembler substitutes: LDI r2 0
ADD r1 r2 r3    ; x = MAX + MIN
```

### Const with Arrays

```javascript
const SIZE = 5;
let arr = [1, 2, 3, 4, 5];
let last = arr[SIZE - 1];
```

Compiles to:

```assembly
define SIZE 5

LDI r1 0       ; arr base
STORE r1 r2 0  ; arr[0] = 1
...
LDI r3 SIZE    ; Assembler substitutes: LDI r3 5
SUBI r3 1      ; SIZE - 1
```

## Comparison with Let Variables

| Feature        | `let`             | `const`                   |
| -------------- | ----------------- | ------------------------- |
| Storage        | Register          | Define (no storage)       |
| Mutable        | Yes               | No (compile-time check)   |
| Memory usage   | Uses register     | Zero memory/registers     |
| Access speed   | Direct (register) | Immediate value (fastest) |
| Initialization | Any expression    | Literal values only       |

## Memory Layout Impact

### Before (const using memory)

```
Memory 0-223:
  0: const x = 10
  1: const y = 20
  2-6: array [1,2,3,4,5]
```

### After (const using define)

```
Memory 0-223:
  0-4: array [1,2,3,4,5]

Defines:
  define x 10
  define y 20
```

**Memory saved**: Consts no longer consume memory addresses!

## Limitations

### Only Literal Values

```javascript
const X = 10; // ✅ Supported
const Y = X + 5; // ❌ Not supported (requires expression evaluation)
```

This is by design - defines must have known values at compile time.

### Workaround for Computed Constants

If you need a computed value that won't change:

```javascript
const BASE = 10;
let computed = BASE + 5; // Use let instead
```

## Implementation Details

### registers.ts

- `setConst(name, value)`: Registers const with its literal value
- `getConst(name)`: Returns the const value (not a memory address)
- `isConst(name)`: Checks if variable is const (for reassignment prevention)

### CompilerContext.ts

- `emitDefine(name, value)`: Emits `define name value` directive

### statementCompiler.ts

- `compileConstDeclaration()`: Validates literal value and emits define
- Checks `registers.isConst()` before allowing reassignment

### expressionCompiler.ts

- When encountering const identifier, emits `LDI reg CONST_NAME`
- Assembler performs substitution later

## Assembly Compatibility

The assembler already supports `define` directives:

```assembly
define STACK_POINTER 232
LDI r15 STACK_POINTER  ; → LDI r15 232
```

Our const implementation leverages this existing feature!

## Future Enhancements

### Possible: Const Expressions

Could support simple const expressions by evaluating at compile time:

```javascript
const BASE = 10;
const DOUBLE = 20; // Could be computed as BASE * 2
```

Would require:

1. Expression evaluator at compile time
2. Type checking for const-only expressions
3. More complex const dependency tracking

## Conclusion

The define-based const implementation is:

- ✅ **Efficient**: No memory or register usage
- ✅ **Fast**: No LOAD instructions, direct immediate values
- ✅ **Simple**: Leverages existing assembler feature
- ✅ **Safe**: Compile-time immutability checks
- ✅ **Compatible**: Works seamlessly with all expressions

This is the optimal approach for const variables in a resource-constrained environment!
