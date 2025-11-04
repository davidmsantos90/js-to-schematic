# Array Base Pointer Optimization

## Overview

Optimized array storage to maximize the use of offset range (-7 to +8 = 16 values).

## Implementation Strategy

Start with base at index 0 and only use negative offsets when necessary:

- **Arrays ≤ 9 elements**: Base at index 0, offsets 0 to +8 (all positive)
- **Arrays > 9 elements**: Base moves backward by (length - 9) positions
  - 10 elements: base at index 1, offsets -1 to +8
  - 11 elements: base at index 2, offsets -2 to +8
  - 16 elements: base at index 7, offsets -7 to +8 (full range)

## Benefits

### Comparison with Naive Approach

```
Before (naive):
Array: [0, 1, 2, 3, 4, 5, 6, 7, 8]
Base at address 0 (index 0)
Access: arr[0] → offset 0
        arr[8] → offset 8
Offset range used: 0 to 8 (9 values, all positive)
Problem: Can only access 9 elements with immediate offsets
```

### After Optimization

```
Small arrays (≤ 9 elements):
Array: [0, 1, 2, 3, 4, 5, 6, 7, 8]
Base at address 0 (index 0)
Access: arr[0] → offset 0
        arr[8] → offset 8
Offset range used: 0 to 8 (9 values, all positive)
Advantage: Intuitive, no negative offsets needed

Larger arrays (10+ elements):
Array: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
Base at address 1 (index 1)
Access: arr[0] → offset -1
        arr[9] → offset 8
Offset range used: -1 to 8 (10 values)
Advantage: Can access 10 elements with immediate offsets
```

## Maximum Efficiency: 16-Element Array

```
Array: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
Base at address 7 (index 7 in memory)

Memory layout:
  Address:  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
  Value:    0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
  Offset:  -7  -6  -5  -4  -3  -2  -1   0  +1  +2  +3  +4  +5  +6  +7  +8
            ↑                           ↑                                ↑
          MIN                        BASE                             MAX

Access examples:
  arr[0]  → LOAD base r -7  (minimum offset)
  arr[7]  → LOAD base r  0  (base position, no offset)
  arr[15] → LOAD base r +8  (maximum offset)
```

## Code Changes

### 1. registers.ts

- `setArray()` now returns `{ startAddress, baseAddress, length }`
- `baseOffset = max(0, length - MAX_POSITIVE_OFFSET - 1)` where MAX_POSITIVE_OFFSET = 8
- `baseAddress = startAddress + baseOffset`
- `getArray()` returns the full struct with both addresses

Formula breakdown:

- length ≤ 9: baseOffset = 0 (base at start, all positive offsets)
- length = 10: baseOffset = 1 (base at index 1, offsets -1 to 8)
- length = 16: baseOffset = 7 (base at index 7, offsets -7 to 8)

### 2. expressionCompiler.ts

- Static index: `offset = index - (baseAddress - startAddress)`
- Dynamic index: Uses `startAddress + index` for address calculation
- Both approaches ensure correct memory access

### 3. statementCompiler.ts

- Array initialization: Uses calculated offsets from base
- Array assignment: Mirrors the read logic for write operations

## Test Results

### Small Array (3 elements)

```assembly
LDI r1 0        ; base at address 0 (index 0)
STORE r1 r2 0   ; arr[0] at offset 0
STORE r1 r2 1   ; arr[1] at offset 1
STORE r1 r2 2   ; arr[2] at offset 2
```

### Medium Array (9 elements) - Maximum with all positive offsets

```assembly
LDI r1 3        ; base at address 3 (index 0)
STORE r1 r0 0   ; arr[0] at offset 0
STORE r1 r2 1   ; arr[1] at offset 1
...
STORE r1 r2 8   ; arr[8] at offset 8 (max positive!)
```

### Array with 10 elements - First use of negative offset

```assembly
LDI r1 13       ; base at address 13 (index 1)
STORE r1 r0 -1  ; arr[0] at offset -1 (first negative!)
STORE r1 r2 0   ; arr[1] at offset 0
...
STORE r1 r2 8   ; arr[9] at offset 8
```

### Large Array (16 elements) - Full offset range

```assembly
LDI r1 29       ; base at address 29 (index 7)
STORE r1 r0 -7  ; arr[0] at offset -7 (min)
...
STORE r1 r2 0   ; arr[7] at offset 0
...
STORE r1 r2 8   ; arr[15] at offset +8 (max)
```

## Impact

1. **Intuitive for Small Arrays**: Arrays ≤ 9 elements use only positive offsets (0 to +8)
2. **Efficient for Large Arrays**: Can access up to 16 elements with immediate offsets (-7 to +8)
3. **Progressive Optimization**: Negative offsets only introduced when needed
4. **No Extra Instructions**: Static array access still requires only LDI + LOAD (2 instructions)
5. **Backward Compatible**: Dynamic access still works correctly with address calculation
6. **Memory Efficient**: No additional memory overhead

### Capacity Comparison

- **Naive approach**: Max 9 elements accessible with immediate offsets
- **Optimized approach**: Max 16 elements accessible with immediate offsets (77% improvement!)

## Memory Layout

```
0-223:   General purpose (arrays, variables)
         - Arrays now optimally positioned using negative offsets
224-239: Stack region (SP=232)
240-255: I/O region
```
