// Test basic try-catch
function basicTryCatch() {
  try {
    let x = 10;
    throw x;
  } catch (e) {
    return e + 1;
  }
}

// Test try-catch-finally
function tryCatchFinally() {
  let result = 0;
  try {
    result = 10;
    throw 5;
  } catch (e) {
    result = result + e;
  } finally {
    result = result + 1;
  }
  return result;
}

// Test try-finally without catch
function tryFinally() {
  let x = 0;
  try {
    x = 10;
  } finally {
    x = x + 5;
  }
  return x;
}

// Test nested try-catch
function nestedTryCatch() {
  try {
    try {
      throw 1;
    } catch (inner) {
      throw inner + 10;
    }
  } catch (outer) {
    return outer + 100;
  }
}

// Test try-catch with conditional throw
function conditionalThrow(shouldThrow) {
  try {
    if (shouldThrow) {
      throw 42;
    }
    return 100;
  } catch (e) {
    return e;
  }
}
