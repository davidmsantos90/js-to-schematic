# Const Scoping and Immutability

## Summary

✅ **Reassignment Protection**: Throws error when trying to reassign const
✅ **Scope Enforcement**: Throws error when trying to access out-of-scope const
✅ **Backward Compatibility**: Regular `let` variables maintain auto-allocation behavior

## Implementation

### Key Changes

1. **Const Name Tracking**

   ```typescript
   const constNames = new Set<string>();
   ```

   Tracks all const names that were ever defined, even after they go out of scope.

2. **Enhanced `registers.get()`**

   ```typescript
   get(key: string | undefined, throwIfNotFound: boolean = false): RegisterName
   ```

   - `throwIfNotFound = false`: Auto-allocates register (default, for `let` variables)
   - `throwIfNotFound = true`: Throws error if variable not found (for const scope checking)

3. **Scope Checking Method**

   ```typescript
   wasEverConst(key: string): boolean
   ```

   Returns true if the name was ever used as a const, even if out of scope.

4. **Expression Compiler**
   ```typescript
   const wasConst = registers.wasEverConst(node.name);
   return registers.get(node.name, wasConst);
   ```
   Throws error if trying to access an out-of-scope const.

## Test Results

### ✅ Test 1: Const Reassignment

```javascript
const x = 10;
x = 20; // ❌ Error: Cannot reassign const variable 'x'
```

### ✅ Test 2: Out-of-Scope Const

```javascript
while (i < 1) {
  const INNER = 50;
  let x = INNER; // ✅ Works - in scope
}
let y = INNER; // ❌ Error: Variable 'INNER' is not defined
```

### ✅ Test 3: In-Scope Const

```javascript
const GLOBAL = 100;

while (i < 1) {
  const INNER = 50;
  let x = INNER + GLOBAL; // ✅ Both work
}

let result = GLOBAL; // ✅ GLOBAL still in scope
```

### ✅ Test 4: Regular Let Variables

```javascript
let x = 10;
x = 20; // ✅ Works - let is mutable

let y = x + 5; // ✅ Works - x is in scope
```

### ✅ Test 5: Backward Compatibility

```javascript
// Using undefined variable with let (auto-allocates)
function test() {
  let a = b + 5; // Creates new register for 'b'
}
```

## Behavior Comparison

| Scenario            | `let`                | `const`                |
| ------------------- | -------------------- | ---------------------- |
| Reassignment        | ✅ Allowed           | ❌ Error               |
| Out of scope access | Creates new register | ❌ Error               |
| In scope access     | ✅ Direct register   | ✅ Define substitution |
| Memory usage        | 1 register           | 0 (define only)        |

## Design Rationale

### Why `throwIfNotFound` Parameter?

Instead of always throwing for undefined variables, we:

1. **Preserve backward compatibility** for `let` variables (auto-allocation)
2. **Enforce strict scoping** only for `const` (which should never leak)
3. **Simple API** - single parameter controls behavior

### Why Track Const Names Globally?

Once a const is defined:

- The `define` directive exists globally in assembly
- We need to prevent accidental reuse of that name
- Tracking ensures we can detect out-of-scope const access

## Edge Cases Handled

### ✅ Const in Nested Scopes

```javascript
const X = 10;
{
  const Y = 20;
  let a = X + Y; // Both work
}
let b = X; // X works
let c = Y; // Y throws error
```

### ✅ Same Name in Different Scopes

```javascript
{
  const X = 10;
  let a = X; // Works
}
{
  const X = 20; // Error: Variable X already exists
}
```

This is correct - once a const name is used, it creates a global define.

### ✅ Let Variable with Const Name

```javascript
const X = 10;
let y = X; // Works - X is const

// Later, after X goes out of scope
let X = 20; // Error: Variable X already exists
```

Const names are reserved even after scope exit.

## Future Enhancements

### Possible: Allow Const Shadowing

Could allow same const name in non-overlapping scopes:

```javascript
{
  const X = 10;
}
{
  const X = 20; // Could work with unique define names
}
```

Would require generating unique define names: `define X_0 10`, `define X_1 20`

### Possible: Const Expression Evaluation

```javascript
const BASE = 10;
const DOUBLE = BASE * 2; // Currently not supported
```

Would require compile-time expression evaluator.

## Conclusion

The const implementation now has:

- ✅ **Full immutability**: Cannot reassign const variables
- ✅ **Proper scoping**: Cannot access out-of-scope const
- ✅ **Efficient**: Zero memory/register usage (define-based)
- ✅ **Safe**: Compile-time checks prevent errors
- ✅ **Compatible**: Backward compatible with let variables
