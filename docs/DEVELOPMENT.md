# Development Guide

This document covers development setup, tooling, utilities, and contribution guidelines.

## Table of Contents

- [Setup](#setup)
- [Project Configuration](#project-configuration)
- [Development Workflow](#development-workflow)
- [Utilities and Tools](#utilities-and-tools)
- [Adding New Features](#adding-new-features)
- [Debugging](#debugging)

---

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
git clone <repository-url>
cd js-to-assembly
npm install
```

### Project Structure

```
js-to-assembly/
├── src/
│   ├── compile/           # Compiler implementation
│   │   ├── modules/       # Statement and expression compilers
│   │   ├── memory/        # Register and memory management
│   │   ├── utils/         # Utility functions
│   │   ├── CompilerContext.ts
│   │   ├── compiler.ts
│   │   └── Stack.ts
│   ├── assemble/          # Assembly to machine code
│   ├── types/             # TypeScript type definitions
│   └── ISA.ts             # Instruction set architecture
├── code-files/            # Example JavaScript files
├── docs/                  # Documentation
├── dist/                  # Compiled output
└── package.json
```

---

## Project Configuration

### TypeScript Configuration

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### Prettier Configuration

`.prettierrc.json`:

```json
{
  "importOrder": ["^(react|vue|angular)", "^@", "^[a-z]", "^\\.", "^\\.\\./"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports"]
}
```

**Features**:

- External packages first (e.g., `esprima`, `estree`)
- Then local imports (e.g., `./compiler`, `../types`)
- Automatic alphabetical sorting within groups

### ESLint Configuration

`.eslintrc.cjs`:

```javascript
module.exports = {
  parser: "@typescript-eslint/parser",
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    // Custom rules
  },
};
```

---

## Development Workflow

### Running the Compiler

```bash
# Compile a JavaScript file
npm start <filename>

# Example
npm start bubble_sort
```

This compiles `code-files/bubble_sort.js` and outputs to `dist/bubble_sort/`.

### Type Checking

```bash
npm run type-check
```

### Code Formatting

```bash
# Format all files
npm run format

# Check formatting without modifying
npm run format:check
```

### Linting

```bash
npm run lint
```

### Running Tests

```bash
npm test
```

---

## Utilities and Tools

### Node Type Detection

Located in `src/compile/utils/nodeTypeDetector.ts`.

**Type Guards**:

```typescript
import { isDeclaration, isExpression, isStatement } from "./utils/nodeTypeDetector";

if (isStatement(node)) {
  // TypeScript knows node is Statement
  compileStatement(node);
}
```

**Available Functions**:

- `isStatement(node)`: Checks if node is a statement
- `isExpression(node)`: Checks if node is an expression
- `isDeclaration(node)`: Checks if node is a declaration
- `isDirective(node)`: Checks if node is a directive (e.g., `"use strict"`)
- `isModuleDeclaration(node)`: Checks if node is a module declaration
- `getNodeCategory(node)`: Returns category as string

### Stack Utility

Generic stack implementation with error handling:

```typescript
import Stack from "./Stack";

const stack = new Stack<string>("Error message when empty");

stack.push("item");
const item = stack.pop();
const top = stack.peek();
const empty = stack.isEmpty();
```

### Register Management

Located in `src/compile/memory/registers.ts`.

```typescript
import registers from "./memory/registers";

// Allocate register for variable
const reg = registers.set("variableName");

// Allocate anonymous register
const temp = registers.allocate();

// Free register
registers.free(temp);

// Scope management
registers.enterScope();
// ... allocations ...
registers.exitScope(); // Frees all in scope
```

### Memory Allocation

Located in `src/compile/memory/memoryAllocator.ts`.

```typescript
import memoryAllocator from "./memory/memoryAllocator";

// Allocate single value
const address = memoryAllocator.allocate(1);

// Allocate array
const arrayBase = memoryAllocator.allocate(size);

// Get stack pointer
const sp = memoryAllocator.getStackPointer();

// Reset allocator
memoryAllocator.reset();
```

---

## Adding New Features

### Adding a New Statement

1. **Create compiler file**:

   ```
   src/compile/modules/statement/myStatement.ts
   ```

2. **Implement compiler**:

   ```typescript
   import type { MyStatement } from "estree";

   import { assertCompilerContext, CompilerContext } from "../../../types/compile";

   const compileMyStatement = function (this: CompilerContext, node: MyStatement): void {
     assertCompilerContext(this);

     // Implementation
   };

   export default compileMyStatement;
   ```

3. **Add to statement index**:

   ```typescript
   // src/compile/modules/statement/index.ts
   import compileMyStatement from "./myStatement";

   export { compileMyStatement };

   export default function compile(this: CompilerContext, node: Statement): void {
     switch (node.type) {
       case "MyStatement":
         return compileMyStatement.call(this, node);
       // ... other cases
     }
   }
   ```

4. **Update node type detector**:

   ```typescript
   // src/compile/utils/nodeTypeDetector.ts
   const statementTypes = [
     // ...existing types...
     "MyStatement", // done
   ];
   ```

5. **Add tests**:

   ```javascript
   // src/test/test_my_statement.js
   function testMyStatement() {
     // Test cases
   }
   ```

6. **Update documentation**:
   - Add to `docs/LANGUAGE_FEATURES.md`
   - Update examples in `README.md`

### Adding a New Expression

Follow similar steps but in `src/compile/modules/expression/`.

### Adding a New Optimization

1. Identify optimization opportunity
2. Implement in relevant compiler
3. Add tests to verify correctness
4. Document in `docs/ARCHITECTURE.md`
5. Add performance comparison if significant

---

## Debugging

### Debug Assembly Output

The compiler outputs assembly with comments:

```assembly
.function_start:
  LDI $t0, 5       ; 5
  LDI $t1, 3       ; 3
  ADD $t2, $t0, $t1  ; 5 + 3
  MOVE $result, $t2  ; result = 5 + 3
.function_end:
```

### Using debugLog

The compiler includes a debug logger:

```typescript
// In index.ts
const debugLog = (code: string[]) => {
  code.forEach((line, index) => {
    console.log(`${index}.  ${line}`);
  });
};
```

### Common Issues

**Register Exhaustion**:

- Symptom: "No registers available" error
- Solution: Add `registers.free()` calls, or increase scope usage

**Scope Leaks**:

- Symptom: Variables accessible outside their scope
- Solution: Ensure `enterScope()`/`exitScope()` pairs match

**Label Conflicts**:

- Symptom: Duplicate label errors
- Solution: Use `newLabel(..., true)` for unique labels

**Stack Corruption**:

- Symptom: Wrong values in function parameters/returns
- Solution: Verify SP offsets match calling convention

---

## Code Style

### Naming Conventions

- **Files**: camelCase (e.g., `compilerContext.ts`)
- **Functions**: camelCase (e.g., `compileStatement`)
- **Types**: PascalCase (e.g., `CompilerContext`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `STACK_POINTER`)

### Function Organization

```typescript
// 1. Imports
import type { Node } from "estree";

import { CompilerContext } from "../types/compile";

// 2. Constants
const MAX_REGISTERS = 15;

// 3. Helper functions
function helper() {
  // ...
}

// 4. Main function
const compileNode = function (this: CompilerContext, node: Node): void {
  // ...
};

// 5. Export
export default compileNode;
```

### Comments

- Use JSDoc for public APIs
- Inline comments for complex logic
- No obvious comments (code should be self-documenting)

```typescript
/**
 * Compiles a statement node to assembly
 *
 * @param node - The statement node to compile
 * @returns Assembly instructions as an array
 */
function compileStatement(node: Statement): string[] {
  // Complex logic here deserves a comment
  const result = complexOperation();

  // No need to comment this:
  return result;
}
```

---

## Testing Guidelines

### Test File Structure

```javascript
// src/test/test_feature.js

// Test 1: Basic functionality
function basicTest() {
  let x = 1;
  return x;
}

// Test 2: Edge case
function edgeCase() {
  let x = 0;
  return x;
}

// Test 3: Complex scenario
function complexScenario() {
  let x = 1;
  let y = 2;
  return x + y;
}
```

### What to Test

1. **Happy path**: Normal usage
2. **Edge cases**: Boundary values, empty arrays, etc.
3. **Error cases**: Invalid input, undefined behavior
4. **Regression tests**: Previously found bugs

### Assertion Strategy

Since this is a compiler, assertions are implicit:

- **Success**: Code compiles without errors
- **Failure**: Compilation errors or wrong assembly output

---

## Performance Considerations

### Optimization Checklist

- [ ] Register reuse
- [ ] Scope-based cleanup
- [ ] Offset optimization for arrays
- [ ] Const folding where possible
- [ ] Short-circuit evaluation for logical operators
- [ ] Minimal register movement

### Profiling

To profile compilation time:

```typescript
console.time("compile");
const result = compile(ast);
console.timeEnd("compile");
```

---

## Contributing

### Before Submitting a PR

1. Run tests: `npm test`
2. Format code: `npm run format`
3. Type check: `npm run type-check`
4. Lint: `npm run lint`
5. Update documentation if needed
6. Add tests for new features

### Commit Messages

Follow conventional commits:

```
feat: add switch statement support
fix: resolve register leak in for loops
docs: update architecture documentation
refactor: simplify expression compiler
test: add edge cases for arrays
```

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

Describe testing performed

## Checklist

- [ ] Tests pass
- [ ] Code formatted
- [ ] Documentation updated
- [ ] No linter errors
```

---

## Resources

### Internal Documentation

- [Language Features](LANGUAGE_FEATURES.md)
- [Architecture](ARCHITECTURE.md)
- [ISA Reference](ISA_REFERENCE.md)

### External Resources

- [ESTree Spec](https://github.com/estree/estree)
- [Esprima Documentation](https://esprima.org/doc/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

For questions or issues, please open a GitHub issue.
