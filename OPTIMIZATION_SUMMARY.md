# Array Base Pointer Optimization - Summary

## The Problem

With 4-bit signed offsets, we can use values from **-7 to +8** (16 total values).
The naive approach (base at index 0) only uses positive offsets 0 to +8, wasting the negative range.

## The Solution

**Progressive base positioning**: Start with base at 0, move backward only when needed.

### Formula

```typescript
const MAX_POSITIVE_OFFSET = 8;
const baseOffset = Math.max(0, length - MAX_POSITIVE_OFFSET - 1);
const baseAddress = startAddress + baseOffset;
```

## Examples

### 3-element array

```
Memory: [10, 20, 30]
Indices: 0   1   2
Base at index 0
Offsets: 0   1   2  ✅ All positive
```

### 9-element array (maximum with all positive offsets)

```
Memory: [0, 1, 2, 3, 4, 5, 6, 7, 8]
Indices: 0  1  2  3  4  5  6  7  8
Base at index 0
Offsets: 0  1  2  3  4  5  6  7  8  ✅ Max positive (8)
```

### 10-element array (first negative offset)

```
Memory: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
Indices: 0  1  2  3  4  5  6  7  8  9
Base at index 1
Offsets:-1  0  1  2  3  4  5  6  7  8  ✅ First negative
```

### 16-element array (full range)

```
Memory: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
Indices: 0  1  2  3  4  5  6  7  8  9  10  11  12  13  14  15
Base at index 7
Offsets:-7 -6 -5 -4 -3 -2 -1  0  1  2   3   4   5   6   7   8
         ↑                    ↑                              ↑
       MIN                  BASE                           MAX
```

## Benefits

### Capacity Increase

| Approach          | Max Elements | Offset Range Used    |
| ----------------- | ------------ | -------------------- |
| Naive (base at 0) | 9            | 0 to +8 (9 values)   |
| Optimized         | **16**       | -7 to +8 (16 values) |
| **Improvement**   | **+77%**     | **Full range**       |

### Intuitive Design

- **Small arrays (≤9)**: Only positive offsets, easier to understand
- **Large arrays (10-16)**: Progressively introduce negatives as needed
- **No waste**: Every offset value in the range -7 to +8 can be used

### Performance

- **Static access**: 2 instructions (LDI + LOAD/STORE)
- **Dynamic access**: Still efficient with address calculation
- **No overhead**: Same memory usage as naive approach

## Real-World Impact

### Bubble Sort (8 elements)

```assembly
Before optimization:
LDI r1 7        ; base at index 7
STORE r1 r2 -7  ; arr[0] with negative offset

After optimization:
LDI r1 0        ; base at index 0
STORE r1 r2 0   ; arr[0] with positive offset ✅ More intuitive!
```

### 16-element Array

```assembly
LDI r1 29       ; base at address 29 (index 7)
LOAD r1 r2 -7   ; arr[0]
LOAD r1 r3 0    ; arr[7] (base)
LOAD r1 r4 8    ; arr[15]
```

All 16 elements accessible with immediate offsets - no address calculation needed!

## Conclusion

This optimization:

1. ✅ Increases array capacity by 77% (9 → 16 elements)
2. ✅ Uses intuitive positive offsets for small arrays
3. ✅ Maximizes offset range utilization
4. ✅ Maintains performance (2 instructions for static access)
5. ✅ Zero memory overhead
