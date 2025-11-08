# Compiler Architecture

This document describes the internal architecture and design decisions of the JavaScript to Assembly compiler.

## Table of Contents

- [Overview](#overview)
- [Compilation Pipeline](#compilation-pipeline)
- [Compiler Context](#compiler-context)
- [Memory Management](#memory-management)
- [Statement Compilers](#statement-compilers)
- [Expression Compilers](#expression-compilers)
- [Optimizations](#optimizations)

---

## Overview

The compiler uses a **single-pass** compilation strategy, generating assembly code directly from the Abstract Syntax Tree (AST) without intermediate representations.

### Design Principles

1. **Modularity**: Each statement/expression type has its own compiler
2. **Type Safety**: TypeScript type guards ensure correct node handling
3. **Context-driven**: Compiler context carries all state through compilation
4. **Stack-based**: Functions, exceptions, and control flow use stack management
5. **Register allocation**: Smart register reuse with scope-based freeing

---

## Compilation Pipeline

```
┌──────────────────┐
│ JavaScript Source│
└────────┬─────────┘
         │
         ↓ (Esprima)
┌──────────────────┐
│   AST (ESTree)   │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│ Compiler Context │
├──────────────────┤
│ - State tracking │
│ - Label generation│
│ - Stack management│
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  Statement/Expr  │
│    Compilers     │
├──────────────────┤
│ • Variables      │
│ • Functions      │
│ • Control flow   │
│ • Expressions    │
│ • Exceptions     │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│Assembly Instruc-  │
│    tions         │
└────────┬─────────┘
         │
         ↓ (Assembler)
┌──────────────────┐
│  Machine Code    │
└──────────────────┘
```

### Step-by-Step Process

1. **Parsing**: JavaScript → AST using Esprima
2. **Context Creation**: Initialize compiler state
3. **Traversal**: Recursively compile each AST node
4. **Code Generation**: Emit assembly instructions
5. **Assembly**: Convert to machine code

---

## Compiler Context

The `CompilerContext` is the central state container passed through all compilation functions.

### Core Components

```typescript
interface CompilerContext {
  // Stack management
  breakHandlerStack: Stack<string>;
  continueHandlerStack: Stack<string>;
  errorHandlerStack: Stack<string>;

  // Code emission
  emitInstruction(mnemonic, operands, node, comment);
  emitLabel(label);
  emitBlank();
  emitDefine(name, value);

  // Utilities
  newLabel(text, unique): LabelInfo;
  getAssembly(): string[];
  astToSource(node): string;
  compileNode(node);
}
```

### Label Generation

Labels are used for control flow (jumps, loops, functions):

```typescript
const { key, startLabel, endLabel } = this.newLabel("loop", true);
// Creates: .0_loop_start, .0_loop_end
```

### Handler Stacks

Three stacks track control flow context:

1. **breakHandlerStack**: Stores labels for `break` statements
2. **continueHandlerStack**: Stores labels for `continue` statements
3. **errorHandlerStack**: Stores labels for `catch` blocks

---

## Memory Management

### Register Allocation

The compiler manages 15 general-purpose registers (r0-r14):

```typescript
const reg = registers.set("variableName"); // Allocate
registers.free(reg); // Free
registers.enterScope(); // New scope
registers.exitScope(); // Free all in scope
```

### Memory Allocator

Variables that don't fit in registers are allocated in memory:

```typescript
const address = memoryAllocator.allocate(1); // Single value
const arrayBase = memoryAllocator.allocate(size); // Array
```

### Variable Storage Strategies

1. **Register**: Fast, for frequently accessed variables
2. **Memory**: For arrays and when registers are exhausted
3. **Const**: Same as variables but with write protection

### Memory Layout

```
Address Range | Usage
--------------|------------------
0-223         | Global data (variables, arrays)
224-239       | Stack (grows downward from 232)
240-255       | I/O reserved
```

---

## Statement Compilers

Each statement type has a dedicated compiler function.

### Architecture Pattern

All statement compilers follow this pattern:

```typescript
function compileXStatement(this: CompilerContext, node: XStatement): void {
  assertCompilerContext(this);

  // 1. Setup (labels, scope)
  const { startLabel, endLabel } = this.newLabel("x");
  registers.enterScope();

  // 2. Compile statement
  // ... emit instructions ...

  // 3. Cleanup
  registers.exitScope();
}
```

### Statement Routing

The main statement compiler routes to specific compilers:

```typescript
switch (node.type) {
  case "VariableDeclaration":
    return compileVariableDeclaration.call(this, node);
  case "IfStatement":
    return compileIfStatement.call(this, node);
  case "ForStatement":
    return compileForStatement.call(this, node);
  // ... etc
}
```

### Loop Compilation Strategy

Loops use consistent label structure:

```
loop_N_start:
  ; Initialization (for loops only)

loop_N_condition:
  ; Test condition
  BEQ condition, $zero, loop_N_end  ; Exit if false

  ; Loop body

loop_N_continue:
  ; Update (for loops only)
  JUMP loop_N_condition

loop_N_end:
```

---

## Expression Compilers

Expressions produce values stored in registers.

### Expression Compilation Pattern

```typescript
function compileXExpression(this: CompilerContext, node: XExpression): RegisterName {
  assertCompilerContext(this);

  // 1. Compile sub-expressions
  const leftReg = compileExpression(node.left);
  const rightReg = compileExpression(node.right);

  // 2. Perform operation
  const resultReg = registers.allocate();
  this.emitInstruction("OP", [leftReg, rightReg, resultReg]);

  // 3. Free temporaries
  registers.free(leftReg);
  registers.free(rightReg);

  // 4. Return result
  return resultReg;
}
```

### Binary Expression Example

```javascript
a + b * c;
```

Compiles to:

```assembly
; Load a
LDI $t0, a
; Load b
LDI $t1, b
; Load c
LDI $t2, c
; b * c
MUL $t3, $t1, $t2
; a + (b * c)
ADD $t4, $t0, $t3
```

---

## Optimizations

### 1. Offset Optimization

**Before**:

```assembly
ADD $t0, $base, $offset  ; Calculate address
LOAD $t1, $t0, 0         ; Load from address
```

**After**:

```assembly
LOAD $t1, $base, $offset  ; Direct load with offset
```

**When Applied**: Array access with constant or variable indices.

### 2. Register Reuse

Registers are freed immediately when no longer needed:

```typescript
const temp = registers.allocate();
// ... use temp ...
registers.free(temp); // Available for reuse
```

### 3. Scope-Based Cleanup

All registers allocated in a scope are freed on scope exit:

```typescript
registers.enterScope();
const x = registers.set("x");
const y = registers.set("y");
// ... use x and y ...
registers.exitScope(); // Both freed automatically
```

### 4. Constant Folding

Compile-time evaluation where possible:

```javascript
const x = 2 + 3; // Evaluates to 5 at compile time
```

### 5. Short-Circuit Evaluation

Logical operators skip evaluation when result is known:

```javascript
a && b; // If a is false, b is not evaluated
a || b; // If a is true, b is not evaluated
```

---

## Type System

### Node Type Detection

Type guards ensure type-safe AST traversal:

```typescript
if (isStatement(node)) {
  compileStatement(node); // node is Statement
} else if (isExpression(node)) {
  compileExpression(node); // node is Expression
}
```

### Type Guard Functions

- `isStatement(node)`: Checks if node is a statement
- `isExpression(node)`: Checks if node is an expression
- `isDeclaration(node)`: Checks if node is a declaration
- `isDirective(node)`: Checks if node is a directive
- `isModuleDeclaration(node)`: Checks if node is a module declaration

### Category Detection

```typescript
const category = getNodeCategory(node);
// Returns: 'statement' | 'expression' | 'declaration' | 'directive' | 'module-declaration' | 'unknown'
```

---

## Exception Handling Architecture

### Stack-Based Model

Exceptions use the same stack location as return values:

- **Throw**: Stores exception at `[SP + 1]`, jumps to catch
- **Catch**: Loads exception from `[SP + 1]`, binds to parameter
- **Return**: Stores return value at `[SP + 1]`, executes RET

### Error Handler Stack

```typescript
// Entering try block
this.errorHandlerStack.push(catchLabel);

// Throwing exception
const catchLabel = this.errorHandlerStack.peek();
STORE $sp, exceptionValue, 1
JUMP catchLabel

// Exiting try block
this.errorHandlerStack.pop();
```

### Why This Works

- `throw` and `return` are mutually exclusive
- Either you throw OR you return, never both
- Same memory location (`[SP + 1]`) can be safely reused

---

## Code Generation

### Assembly Format

Generated assembly includes:

```assembly
  INSTRUCTION operands  ; comment

.label_start:
  INSTRUCTION operands  ; comment
.label_end:
```

### Comment Generation

Comments are automatically generated from AST nodes:

```javascript
let x = a + b;
```

Generates:

```assembly
ADD $t0, $a, $b  ; a + b
MOVE $x, $t0     ; x = a + b
```

### Indentation

Labels create indentation levels:

```assembly
.if_0_start:
  ; Indented (inside if block)
  INSTRUCTION

  .nested_start:
    ; More indented (nested block)
    INSTRUCTION
  .nested_end:

.if_0_end:
```

---

## Testing Strategy

### Test Categories

1. **Unit tests**: Individual compiler functions
2. **Integration tests**: Full compilation of JavaScript files
3. **Edge cases**: Error conditions, boundary values
4. **Regression tests**: Previously found bugs

### Test Files

Located in `src/test/`, named `test_*.js`:

- `test_const.js`: Constant declarations
- `test_array_basic.js`: Array operations
- `test_for_in.js`: For-in loops
- `test_try_catch.js`: Exception handling
- etc.

---

## Future Enhancements

Possible improvements:

1. **Multi-pass optimization**: Dead code elimination, constant propagation
2. **Better register allocation**: Graph coloring, live range analysis
3. **Function inlining**: Small function optimization
4. **Loop unrolling**: Performance optimization for small loops
5. **Cross-function exceptions**: Exception propagation through call stack
6. **Type inference**: Better type tracking for optimizations

---

For language features, see [LANGUAGE_FEATURES.md](LANGUAGE_FEATURES.md).  
For development setup, see [DEVELOPMENT.md](DEVELOPMENT.md).
