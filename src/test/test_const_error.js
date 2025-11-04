// Test that const cannot be reassigned

const x = 10;
let y = 20;

// This should work (let can be reassigned)
y = 30;

// This should fail (const cannot be reassigned)
x = 50;
