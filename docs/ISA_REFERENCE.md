# Instruction Set Architecture (ISA) Reference

Complete reference for the custom assembly language instruction set.

## Table of Contents

- [Registers](#registers)
- [Instructions](#instructions)
- [Addressing Modes](#addressing-modes)
- [Assembly Format](#assembly-format)

---

## Registers

### General Purpose Registers

- **r0 - r14** (`$t0` - `$t14`): 15 general-purpose registers for temporary values and variables
- **r15** (`$sp`): Stack Pointer - tracks current stack position

### Special Registers

- **$zero**: Always contains zero (read-only)
- **$return**: Alias for `[SP + 1]` (function return value location)

### Register Naming

Registers can be referenced by:

- Number: `r0`, `r1`, ..., `r15`
- Alias: `$t0`, `$t1`, ..., `$sp`
- Name: `$variableName` (when assigned to a variable)

---

## Instructions

### Arithmetic

#### ADD - Addition

```assembly
ADD rd, rs1, rs2    ; rd = rs1 + rs2
```

Adds two registers and stores result in destination.

#### SUB - Subtraction

```assembly
SUB rd, rs1, rs2    ; rd = rs1 - rs2
```

Subtracts rs2 from rs1 and stores result in destination.

#### MUL - Multiplication

```assembly
MUL rd, rs1, rs2    ; rd = rs1 * rs2
```

Multiplies two registers.

#### DIV - Division

```assembly
DIV rd, rs1, rs2    ; rd = rs1 / rs2
```

Integer division of rs1 by rs2.

#### MOD - Modulus

```assembly
MOD rd, rs1, rs2    ; rd = rs1 % rs2
```

Remainder of rs1 divided by rs2.

### Logical

#### AND - Bitwise AND

```assembly
AND rd, rs1, rs2    ; rd = rs1 & rs2
```

#### OR - Bitwise OR

```assembly
OR rd, rs1, rs2     ; rd = rs1 | rs2
```

#### XOR - Bitwise XOR

```assembly
XOR rd, rs1, rs2    ; rd = rs1 ^ rs2
```

#### NOT - Bitwise NOT

```assembly
NOT rd, rs          ; rd = ~rs
```

### Data Movement

#### MOVE - Register to Register

```assembly
MOVE rd, rs         ; rd = rs
```

Copies value from source to destination register.

#### LDI - Load Immediate

```assembly
LDI rd, imm         ; rd = imm
```

Loads an immediate value into register.

#### LOAD - Load from Memory

```assembly
LOAD rbase, rd, offset    ; rd = mem[rbase + offset]
```

Loads value from memory address (base + offset) into register.

**Examples**:

```assembly
LOAD $sp, $t0, 0     ; Load from stack pointer
LOAD $sp, $t1, -1    ; Load from SP - 1
LOAD $arr, $t2, $i   ; Load from array[i]
```

#### STORE - Store to Memory

```assembly
STORE rbase, rs, offset   ; mem[rbase + offset] = rs
```

Stores register value to memory address (base + offset).

**Examples**:

```assembly
STORE $sp, $t0, 1    ; Store return value
STORE $arr, $t1, $i  ; Store to array[i]
```

### Control Flow

#### JUMP - Unconditional Jump

```assembly
JUMP label          ; PC = label
```

Jumps to the specified label.

#### BEQ - Branch if Equal

```assembly
BEQ rs1, rs2, label ; if (rs1 == rs2) PC = label
```

Branches to label if rs1 equals rs2.

#### BNE - Branch if Not Equal

```assembly
BNE rs1, rs2, label ; if (rs1 != rs2) PC = label
```

Branches to label if rs1 does not equal rs2.

#### BLT - Branch if Less Than

```assembly
BLT rs1, rs2, label ; if (rs1 < rs2) PC = label
```

#### BGT - Branch if Greater Than

```assembly
BGT rs1, rs2, label ; if (rs1 > rs2) PC = label
```

#### BLE - Branch if Less or Equal

```assembly
BLE rs1, rs2, label ; if (rs1 <= rs2) PC = label
```

#### BGE - Branch if Greater or Equal

```assembly
BGE rs1, rs2, label ; if (rs1 >= rs2) PC = label
```

### Function Control

#### CALL - Function Call

```assembly
CALL label          ; Push return address, jump to label
```

Calls a function at the given label.

#### RET - Return from Function

```assembly
RET                 ; Pop return address, jump back
```

Returns from current function.

### System

#### HALT - Stop Execution

```assembly
HALT                ; Stop program
```

Halts program execution.

#### NOP - No Operation

```assembly
NOP                 ; Do nothing
```

No operation, used for alignment or placeholders.

---

## Addressing Modes

### Immediate

```assembly
LDI $t0, 42         ; Load constant
```

### Register

```assembly
MOVE $t0, $t1       ; Copy register
ADD $t0, $t1, $t2   ; Add registers
```

### Memory with Offset

```assembly
LOAD $sp, $t0, 0    ; Load from [SP + 0]
LOAD $sp, $t1, -1   ; Load from [SP - 1]
STORE $sp, $t0, 1   ; Store to [SP + 1]
```

### Register-Indexed

```assembly
LOAD $arr, $t0, $i  ; Load from [arr + i]
STORE $arr, $t1, $i ; Store to [arr + i]
```

---

## Assembly Format

### Instructions

```assembly
  INSTRUCTION operands  ; comment
```

### Labels

```assembly
label_name:
  INSTRUCTION operands
```

### Directives

```assembly
define NAME VALUE
```

### Comments

```assembly
; Full line comment
INSTRUCTION operands  ; Inline comment
```

---

## Calling Convention

### Function Parameters

Parameters are passed via stack:

- **1st parameter**: `[SP + 0]`
- **2nd parameter**: `[SP - 1]`
- **3rd parameter**: `[SP - 2]`
- etc.

### Return Values

Return value stored at `[SP + 1]`:

```assembly
function_start:
  ; Load parameters
  LOAD $sp, $a, 0     ; a = [SP + 0]
  LOAD $sp, $b, -1    ; b = [SP - 1]

  ; Compute result
  ADD $result, $a, $b

  ; Store return value
  STORE $sp, $result, 1
  RET
function_end:
```

### Exception Values

Exceptions also use `[SP + 1]` (mutually exclusive with returns):

```assembly
try_start:
  ; ... code that may throw ...
  LDI $t0, 42
  STORE $sp, $t0, 1   ; Store exception
  JUMP catch_label

catch_label:
  LOAD $sp, $e, 1     ; Load exception
  ; ... handle exception ...
```

---

## Examples

### Simple Addition

JavaScript:

```javascript
let a = 5;
let b = 3;
let c = a + b;
```

Assembly:

```assembly
  LDI $a, 5           ; a = 5
  LDI $b, 3           ; b = 3
  ADD $c, $a, $b      ; c = a + b
```

### Array Access

JavaScript:

```javascript
let arr = [10, 20, 30];
let x = arr[1];
```

Assembly:

```assembly
  LDI $arr, 100       ; arr base address
  LDI $i, 1           ; index
  LOAD $arr, $x, $i   ; x = arr[1]
```

### If Statement

JavaScript:

```javascript
if (x > 0) {
  y = 1;
} else {
  y = 2;
}
```

Assembly:

```assembly
  LDI $temp, 0
  BLE $x, $temp, .else_0

.then_0:
  LDI $y, 1
  JUMP .endif_0

.else_0:
  LDI $y, 2

.endif_0:
```

### Loop

JavaScript:

```javascript
for (let i = 0; i < 5; i++) {
  sum += i;
}
```

Assembly:

```assembly
  LDI $i, 0           ; i = 0

.loop_start:
  LDI $temp, 5
  BGE $i, $temp, .loop_end

  ADD $sum, $sum, $i  ; sum += i

  LDI $temp, 1
  ADD $i, $i, $temp   ; i++
  JUMP .loop_start

.loop_end:
```

---

## Memory Layout

```
Address | Usage
--------|------------------
0-223   | Global data (variables, arrays, constants)
224-239 | Stack (16 slots, grows downward)
232     | Initial stack pointer
240-255 | I/O reserved (16 addresses)
```

### Stack Operations

Stack grows **downward** from address 232:

```assembly
; Push value
STORE $sp, $value, 0
SUB $sp, $sp, 1

; Pop value
ADD $sp, $sp, 1
LOAD $sp, $value, 0
```

---

## Label Conventions

The compiler generates labels with this naming scheme:

- **Function labels**: `function_name_start`, `function_name_end`
- **Loop labels**: `.N_loop_start`, `.N_loop_end`, `.N_loop_continue`
- **Conditional labels**: `.N_if_start`, `.N_if_end`, `.N_else`
- **Try-catch labels**: `.N_try_start`, `.N_catch`, `.N_finally`, `.N_after`

Where `N` is a unique number.

---

For more information, see:

- [Language Features](LANGUAGE_FEATURES.md)
- [Architecture](ARCHITECTURE.md)
- [Development](DEVELOPMENT.md)
