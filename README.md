# JavaScript to Assembly Compiler

A compiler that translates JavaScript code to custom assembly language, designed for educational purposes and hardware simulation.

## Overview

This project compiles a subset of JavaScript (ES5/ES6) into a custom assembly language that can be executed on a simulated processor or converted to Minecraft redstone schematics.

### Key Features

- ✅ **Variables & Constants**: `let`, `const` with proper scoping
- ✅ **Arrays**: Declaration, access, manipulation with optimizations
- ✅ **Control Flow**: `if/else`, `switch/case`, loops (`for`, `while`, `do-while`, `for-in`, `for-of`)
- ✅ **Functions**: Declaration, calls, parameters, return values
- ✅ **Exception Handling**: `throw`, `try-catch-finally`
- ✅ **Operators**: Arithmetic, logical, comparison, assignment, update (`++`, `--`)
- ✅ **Expressions**: Binary, unary, assignment, member access

## Quick Start

### Installation

```bash
npm install
```

### Usage

```bash
npm start <filename>
```

Example:

```bash
npm start bubble_sort
```

This will compile `code-files/bubble_sort.js` to assembly and save it in `dist/bubble_sort/`.

### Format Code

```bash
npm run format
```

## Project Structure

```
js-to-assembly/
├── src/
│   ├── compile/           # Compiler implementation
│   │   ├── modules/       # Statement and expression compilers
│   │   │   ├── statement/ # Statement compilers (if, loop, function, etc.)
│   │   │   │   ├── error/ # Exception handling (throw, try-catch)
│   │   │   │   └── loop/  # Loop compilers (for, while, do-while, etc.)
│   │   │   └── expression/ # Expression compilers
│   │   ├── memory/        # Register and memory allocation
│   │   ├── utils/         # Utility functions (node detection, etc.)
│   │   ├── CompilerContext.ts  # Core compiler context
│   │   └── compiler.ts    # Main compiler entry point
│   ├── assemble/          # Assembly to machine code
│   ├── types/             # TypeScript type definitions
│   └── ISA.ts             # Instruction Set Architecture definition
├── code-files/            # Example JavaScript files
├── docs/                  # Detailed documentation
└── dist/                  # Compiled output

```

## Memory Architecture

```
High addresses (255)
┌──────────────────┐
│ I/O Reserved     │ 240-255 (16 addresses)
├──────────────────┤
│ Stack (grows     │
│ downward)        │
├──────────────────┤ ← Stack Pointer r15 (SP)
│ Free space       │
├──────────────────┤
│ Global Data      │
│ - Variables      │
│ - Arrays         │
│ - Constants      │
└──────────────────┘
Low addresses (0)
```

### Register Convention

- **r0-r14**: General-purpose registers (temporary values)
- **r15 ($sp)**: Stack pointer
- **$zero**: Always contains zero
- **$return**: Function return value location (`[SP + 1]`)

## Documentation

### Detailed Guides

- **[Language Features](docs/LANGUAGE_FEATURES.md)** - Comprehensive guide to supported JavaScript features
- **[Architecture](docs/ARCHITECTURE.md)** - Compiler architecture and design decisions
- **[Development](docs/DEVELOPMENT.md)** - Development setup, utilities, and tooling

### Quick References

- **[ISA Reference](docs/ISA_REFERENCE.md)** - Complete instruction set documentation
- **[Examples](code-files/)** - Example JavaScript programs

## Language Support

### Statements

| Feature             | Status | Description                        |
| ------------------- | ------ | ---------------------------------- |
| `let`, `const`      | ✅     | Variable and constant declarations |
| `if/else`           | ✅     | Conditional statements             |
| `else if`           | ✅     | Chained conditionals               |
| `switch/case`       | ✅     | Multi-way branching                |
| `for`               | ✅     | Standard for loops                 |
| `for-in`            | ✅     | Iterate over array indices         |
| `for-of`            | ✅     | Iterate over array values          |
| `while`             | ✅     | Pre-test loops                     |
| `do-while`          | ✅     | Post-test loops                    |
| `break`             | ✅     | Loop/switch exit                   |
| `continue`          | ✅     | Loop iteration skip                |
| `return`            | ✅     | Function return                    |
| `throw`             | ✅     | Exception throwing                 |
| `try-catch-finally` | ✅     | Exception handling                 |
| Functions           | ✅     | Declaration and calls              |

### Expressions

| Feature        | Status | Description                       |
| -------------- | ------ | --------------------------------- |
| Arithmetic     | ✅     | `+`, `-`, `*`, `/`, `%`           |
| Comparison     | ✅     | `==`, `!=`, `<`, `>`, `<=`, `>=`  |
| Logical        | ✅     | `&&`, `\|\|`, `!`                 |
| Assignment     | ✅     | `=`, `+=`, `-=`, `*=`, `/=`, `%=` |
| Update         | ✅     | `++`, `--` (prefix and postfix)   |
| Member access  | ✅     | Array indexing (`arr[i]`)         |
| Function calls | ✅     | `func(a, b, c)`                   |

### Data Types

- **Numbers**: Integer values
- **Arrays**: Fixed-size integer arrays
- **Booleans**: Represented as 0 (false) and non-zero (true)

## Examples

### Simple Function

```javascript
function add(a, b) {
  return a + b;
}

let result = add(5, 3);
```

### Array Manipulation

```javascript
let arr = [3, 1, 4, 1, 5];
let sum = 0;

for (let i = 0; i < 5; i++) {
  sum += arr[i];
}
```

### Exception Handling

```javascript
function safeDivide(a, b) {
  try {
    if (b === 0) {
      throw -1;
    }
    return a / b;
  } catch (e) {
    return e;
  }
}
```

### Switch Statement

```javascript
function classify(value) {
  switch (value) {
    case 0:
      return 1;
    case 1:
      return 2;
    default:
      return 3;
  }
}
```

### Else-If Chains

```javascript
function gradeToGPA(grade) {
  if (grade >= 90) {
    return 4;
  } else if (grade >= 80) {
    return 3;
  } else if (grade >= 70) {
    return 2;
  } else if (grade >= 60) {
    return 1;
  } else {
    return 0;
  }
}
```

## Optimizations

The compiler includes several optimizations:

- **Offset Optimization**: Direct memory access with offsets instead of separate ADD operations
- **Register Reuse**: Smart register allocation and freeing
- **Constant Folding**: Compile-time evaluation where possible
- **Dead Code Elimination**: Unreachable code removal

## Development

### Running Tests

```bash
npm test
```

### Code Formatting

This project uses Prettier with automatic import sorting:

```bash
npm run format
```

### Type Checking

```bash
npm run type-check
```

## Contributing

1. Follow the existing code style (Prettier enforced)
2. Add tests for new features
3. Update documentation
4. Keep commits focused and descriptive

## Architecture Highlights

### Compiler Pipeline

```
JavaScript Source
    ↓
AST (via Esprima)
    ↓
Compiler Context
    ↓
Statement/Expression Compilers
    ↓
Assembly Instructions
    ↓
Assembler
    ↓
Machine Code
```

### Key Design Decisions

1. **Stack-based exception handling** - Exceptions use the same stack location as return values (`[SP + 1]`)
2. **Scope-based register management** - Registers automatically freed when exiting scopes
3. **Type guards for AST nodes** - Type-safe node detection and compilation
4. **Modular compiler architecture** - Separate compilers for each statement/expression type

## Limitations

- No floating-point arithmetic
- Limited to integer values
- No dynamic memory allocation
- No garbage collection
- Fixed array sizes
- No object support (beyond arrays)
- No string operations
- No multi-level exception propagation across functions

## License

[Add your license here]

## Authors

[Add authors here]

---

For detailed documentation, see the [docs/](docs/) directory.
