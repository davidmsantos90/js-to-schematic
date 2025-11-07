// Test for-in statement compilation (iterating over array indices)
const arr = [10, 20, 30, 40, 50];

for (const i in arr) {
  const value = arr[i];
}
