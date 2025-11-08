# Node Type Detection Utilities

This module provides utilities to detect whether an ESTree node is a **Statement**, **Expression**, **Declaration**, **Directive**, or **ModuleDeclaration**.

## Files

- `nodeTypeDetector.ts` - Core type guard functions
- `compileNode.ts` - Example usage with the compiler

## Type Hierarchy

In ESTree (JavaScript AST), nodes follow this hierarchy:

```
Node (base)
├── Statement
│   ├── ExpressionStatement
│   │   └── Directive (special ExpressionStatement with directive property)
│   ├── IfStatement
│   ├── WhileStatement
│   ├── ForStatement
│   ├── BlockStatement
│   ├── ReturnStatement
│   ├── BreakStatement
│   ├── ContinueStatement
│   └── Declaration (also a statement)
│       ├── FunctionDeclaration
│       ├── VariableDeclaration
│       └── ClassDeclaration
├── Expression
│   ├── Identifier
│   ├── Literal
│   ├── BinaryExpression
│   ├── CallExpression
│   ├── AssignmentExpression
│   ├── ArrayExpression
│   ├── ObjectExpression
│   └── ... (many more)
└── ModuleDeclaration
    ├── ImportDeclaration
    ├── ExportNamedDeclaration
    ├── ExportDefaultDeclaration
    └── ExportAllDeclaration
```

**Important Notes:**

- Declarations are ALSO statements, so they will return `true` for both `isDeclaration()` and `isStatement()`.
- Directives are special ExpressionStatements with a `directive` property (e.g., "use strict").

## API

### `isStatement(node: Node): node is Statement`

Returns `true` if the node is a statement (including declarations).

```typescript
import { isStatement } from "./nodeTypeDetector";

if (isStatement(node)) {
  // node is typed as Statement here
  compileStatement(node);
}
```

### `isExpression(node: Node): node is Expression`

Returns `true` if the node is an expression.

```typescript
import { isExpression } from "./nodeTypeDetector";

if (isExpression(node)) {
  // node is typed as Expression here
  compileExpression(node);
}
```

### `isDeclaration(node: Node): node is Declaration`

Returns `true` if the node is a declaration (FunctionDeclaration, VariableDeclaration, ClassDeclaration).

```typescript
import { isDeclaration } from "./nodeTypeDetector";

if (isDeclaration(node)) {
  // node is typed as Declaration here
  compileDeclaration(node);
}
```

### `isDirective(node: Node): node is Directive`

Returns `true` if the node is a directive (e.g., "use strict"). Directives are special ExpressionStatements with a `directive` property.

```typescript
import { isDirective } from "./nodeTypeDetector";

if (isDirective(node)) {
  // node is typed as Directive here
  console.log("Directive:", node.directive);
}
```

### `isModuleDeclaration(node: Node): node is ModuleDeclaration`

Returns `true` if the node is a module declaration (ImportDeclaration, ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration).

```typescript
import { isModuleDeclaration } from "./nodeTypeDetector";

if (isModuleDeclaration(node)) {
  // node is typed as ModuleDeclaration here
  compileModuleDeclaration(node);
}
```

### `getNodeCategory(node: Node): 'declaration' | 'statement' | 'expression' | 'directive' | 'module-declaration' | 'unknown'`

Returns the category of the node. Prioritizes more specific types over general ones.

```typescript
import { getNodeCategory } from "./nodeTypeDetector";

const category = getNodeCategory(node);
switch (category) {
  case "directive":
    compileDirective(node);
    break;
  case "module-declaration":
    compileModuleDeclaration(node);
    break;
  case "declaration":
    compileDeclaration(node);
    break;
  case "statement":
    compileStatement(node);
    break;
  case "expression":
    compileExpression(node);
    break;
}
```

## Usage Examples

### Example 1: Using Type Guards

```typescript
import { isDeclaration, isExpression, isStatement } from "./nodeTypeDetector";

function compileNode(node: Node): void {
  // Check declaration first (since declarations are also statements)
  if (isDeclaration(node)) {
    // Handle FunctionDeclaration, VariableDeclaration, ClassDeclaration
    compileDeclaration(node);
  } else if (isStatement(node)) {
    // Handle other statements
    compileStatement(node);
  } else if (isExpression(node)) {
    // Handle expressions
    compileExpression(node);
  }
}
```

### Example 2: Using Category Detection

```typescript
import { getNodeCategory } from "./nodeTypeDetector";

function compileNode(node: Node): void {
  const category = getNodeCategory(node);

  switch (category) {
    case "declaration":
      console.log("Compiling declaration:", node.type);
      compileDeclaration(node);
      break;

    case "statement":
      console.log("Compiling statement:", node.type);
      compileStatement(node);
      break;

    case "expression":
      console.log("Compiling expression:", node.type);
      compileExpression(node);
      break;

    case "unknown":
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
```

### Example 3: Generic Router Function

```typescript
import type { Expression, Node, Statement } from "estree";

import type { CompilerContext } from "../../types/compile";
import { isExpression, isStatement } from "./nodeTypeDetector";

function compileGenericNode(this: CompilerContext, node: Node): void {
  // Statements (including declarations) use the statement compiler
  if (isStatement(node)) {
    if (!this.compileStatement) {
      throw new Error("Statement compiler not initialized");
    }
    this.compileStatement(node as Statement);
    return;
  }

  // Expressions use the expression compiler
  if (isExpression(node)) {
    if (!this.expression) {
      throw new Error("Expression compiler not initialized");
    }
    this.expression.compileValue(node as Expression);
    return;
  }

  throw new Error(`Cannot compile node of type: ${node.type}`);
}
```

## Statement Types

The following node types are considered statements:

- `ExpressionStatement`
- `BlockStatement`
- `EmptyStatement`
- `DebuggerStatement`
- `WithStatement`
- `ReturnStatement`
- `LabeledStatement`
- `BreakStatement`
- `ContinueStatement`
- `IfStatement`
- `SwitchStatement`
- `ThrowStatement`
- `TryStatement`
- `WhileStatement`
- `DoWhileStatement`
- `ForStatement`
- `ForInStatement`
- `ForOfStatement`
- `FunctionDeclaration` (also a declaration)
- `VariableDeclaration` (also a declaration)
- `ClassDeclaration` (also a declaration)

## Expression Types

The following node types are considered expressions:

- `ThisExpression`
- `ArrayExpression`
- `ObjectExpression`
- `FunctionExpression`
- `ArrowFunctionExpression`
- `YieldExpression`
- `Literal`
- `UnaryExpression`
- `UpdateExpression`
- `BinaryExpression`
- `AssignmentExpression`
- `LogicalExpression`
- `MemberExpression`
- `ConditionalExpression`
- `CallExpression`
- `NewExpression`
- `SequenceExpression`
- `TemplateLiteral`
- `TaggedTemplateExpression`
- `ClassExpression`
- `MetaProperty`
- `Identifier`
- `AwaitExpression`
- `ImportExpression`
- `ChainExpression`

## Declaration Types

The following node types are considered declarations:

- `FunctionDeclaration`
- `VariableDeclaration`
- `ClassDeclaration`

**Note:** These are also statements, so they will match both `isDeclaration()` and `isStatement()`.

## Directive Type

Directives are special ExpressionStatements with a `directive` property:

- `Directive` - An ExpressionStatement with a literal expression and a directive string (e.g., "use strict", "use client")

**Note:** Directives are actually ExpressionStatements, so they will also match `isStatement()`. The `isDirective()` check looks for the presence of the `directive` property.

## ModuleDeclaration Types

The following node types are considered module declarations:

- `ImportDeclaration` - Import statements (e.g., `import { foo } from "bar"`)
- `ExportNamedDeclaration` - Named exports (e.g., `export { foo, bar }`)
- `ExportDefaultDeclaration` - Default exports (e.g., `export default foo`)
- `ExportAllDeclaration` - Export all (e.g., `export * from "module"`)

**Note:** Module declarations appear in the body of a Program when `sourceType` is "module".
