import type {
  ArrayExpression,
  ArrayPattern,
  AssignmentOperator,
  Expression,
  ExpressionStatement,
  MemberExpression,
} from "estree";

import { assertIdentifier } from "../../../types/assembly";
import { assertCompilerContext, CompilerContext, EstreeNode } from "../../../types/compile";
import { RegisterName } from "../../../types/ISA";
import registers from "../../memory/registers";
import compileAssignmentExpression from "../expression/assignmentExpression";
import { compileCallExpression } from "../expression/callExpression";
import compileValue, { compileCallExpressionWithReturn } from "../expression/compileValue";
import compileUpdateExpression from "../expression/updateExpression";

/** Handle array destructuring assignment: [a, b] = [b, a] */
const compileArrayDestructuringAssignment = function (
  this: CompilerContext,
  operator: AssignmentOperator,
  left: ArrayPattern,
  right: ArrayExpression,
): void {
  assertCompilerContext(this);

  if (left.type !== "ArrayPattern" || right.type !== "ArrayExpression") {
    throw new Error("Invalid array destructuring assignment");
  }

  if (operator !== "=") {
    throw new Error("Compound assignment not supported with destructuring");
  }

  const leftElements = left.elements;
  const rightElements = right.elements;

  if (leftElements.length !== rightElements.length) {
    throw new Error(
      `Destructuring assignment length mismatch: ${leftElements.length} vs ${rightElements.length}`,
    );
  }

  function getSharedName<T extends EstreeNode | null>(elements: T[]): string | null {
    let sharedName: string | null = null;

    const sameArray = elements.every((elem) => {
      if (elem?.type !== "MemberExpression") return false;

      const memberExpr = elem as MemberExpression;
      if (memberExpr.object.type !== "Identifier") return false;

      const { name } = memberExpr.object as any;
      if (sharedName == null) sharedName = name;

      return name === sharedName;
    });

    return sameArray ? sharedName : null;
  }

  // Optimize: check if we're swapping elements from the same array
  // If so, calculate the base address once and reuse it
  let arrayBaseReg: RegisterName | null = null;

  // Check if all elements are from the same array
  const sharedArrayName = getSharedName(rightElements);
  if (sharedArrayName) {
    // All elements are from the same array - load base address once
    const arrayInfo = registers.getArray(sharedArrayName!);

    arrayBaseReg = registers.next();
    this.emitInstruction(
      "LDI",
      [arrayBaseReg, `${arrayInfo!.base}`],
      null,
      `${sharedArrayName}.base`,
    );
  }

  // Check if left side is also from same array (for swap optimization)
  const leftSharedArrayName = getSharedName(leftElements);

  // Optimize: For simple 2-element swaps from same array, use 3 registers only
  // Pattern: [arr[a], arr[b]] = [arr[b], arr[a]] becomes: temp=arr[a]; arr[a]=arr[b]; arr[b]=temp
  const isTwoElementSwap =
    leftElements.length === 2 &&
    sharedArrayName != null &&
    leftSharedArrayName != null &&
    sharedArrayName === leftSharedArrayName &&
    leftElements.every((e) => e?.type === "MemberExpression") &&
    rightElements.every((e) => e?.type === "MemberExpression");

  if (isTwoElementSwap /* && arrayBaseReg*/) {
    // Optimized 2-element swap: only need 3 value registers
    const addrReg = registers.next(); // Reusable for address calculations
    const baseReg = arrayBaseReg; // Reuse the already-loaded base

    // Calculate first address (for arr[left[0]])
    const leftElem0 = leftElements[0] as MemberExpression;
    const leftIdx0 = leftElem0.property;
    let idx0Reg: RegisterName;

    if (leftIdx0.type === "Identifier") {
      idx0Reg = registers.get(leftIdx0.name);
    } else if (leftIdx0.type === "Literal") {
      idx0Reg = registers.next();
      this.emitInstruction("LDI", [idx0Reg, `${leftIdx0.value}`], null);
    } else {
      idx0Reg = compileValue.call(this, leftIdx0 as Expression);
    }

    this.emitInstruction("ADD", [baseReg!, idx0Reg, addrReg], null);

    // Load first value into r1 (temp = arr[idx0])
    const tempReg = registers.next();
    this.emitInstruction("LOAD", [addrReg, tempReg], leftElem0, this.astToSource(leftElem0));

    // Calculate second address (for arr[left[1]])
    const leftElem1 = leftElements[1] as MemberExpression;
    const leftIdx1 = leftElem1.property;
    let idx1Reg: RegisterName;

    if (leftIdx1.type === "Identifier") {
      idx1Reg = registers.get(leftIdx1.name);
    } else if (leftIdx1.type === "Literal") {
      idx1Reg = registers.next();
      this.emitInstruction("LDI", [idx1Reg, `${leftIdx1.value}`], null);
    } else {
      idx1Reg = compileValue.call(this, leftIdx1 as Expression);
    }

    this.emitInstruction("ADD", [baseReg!, idx1Reg, addrReg], null);

    // Load second value into r2 (r2 = arr[idx1])
    const value2Reg = registers.next();
    this.emitInstruction("LOAD", [addrReg, value2Reg], leftElem1, this.astToSource(leftElem1));

    // Now do the swap:
    // 1. Store r2 at first address (arr[idx0] = arr[idx1])
    this.emitInstruction("ADD", [baseReg!, idx0Reg, addrReg], null);
    this.emitInstruction(
      "STORE",
      [addrReg, value2Reg],
      null,
      `${this.astToSource(leftElem0)} <- ${this.astToSource(rightElements[0] as Expression)}`,
    );

    // 2. Store temp at second address (arr[idx1] = temp)
    this.emitInstruction("ADD", [baseReg!, idx1Reg, addrReg], null);
    this.emitInstruction(
      "STORE",
      [addrReg, tempReg],
      null,
      `${this.astToSource(leftElem1)} <- ${this.astToSource(rightElements[1] as Expression)}`,
    );

    // Free allocated registers
    registers.free(addrReg, tempReg, value2Reg);

    if (leftIdx0.type === "Literal" || leftIdx0.type !== "Identifier") {
      registers.free(idx0Reg);
    }

    if (leftIdx1.type === "Literal" || leftIdx1.type !== "Identifier") {
      registers.free(idx1Reg);
    }

    registers.free(arrayBaseReg!);

    return;
  }

  // General case: Evaluate all right-hand side values into temporary registers first
  // This prevents issues when variables appear on both sides (e.g., [a, b] = [b, a])

  // Optimization: Evaluate expressions before identifiers to avoid unnecessary copies
  // Build list of identifiers that will be overwritten on the left side
  const targetIdentifiers = new Set<string>();
  for (const elem of leftElements) {
    if (elem?.type === "Identifier") {
      targetIdentifiers.add(elem.name);
    }
  }

  // Check which identifiers are referenced in expressions on the right
  const identifiersInExpressions = new Set<string>();
  const checkIdentifiersInExpr = (expr: any): void => {
    switch (expr?.type) {
      case "Identifier":
        identifiersInExpressions.add(expr.name);
        break;
      case "BinaryExpression":
        checkIdentifiersInExpr(expr.left);
        checkIdentifiersInExpr(expr.right);
        break;
      case "MemberExpression":
        checkIdentifiersInExpr(expr.object);
        checkIdentifiersInExpr(expr.property);
        break;
      // Add more expression types as needed
    }
  };

  rightElements.forEach((elem) => {
    if (elem && elem.type !== "Identifier") {
      checkIdentifiersInExpr(elem);
    }
  });

  // An identifier needs a copy only if:
  // 1. It will be overwritten (in targetIdentifiers), AND
  // 2. It's referenced in an expression that will be evaluated later
  const identifiersNeedingCopy = new Set<string>();
  for (const id of targetIdentifiers) {
    if (identifiersInExpressions.has(id)) {
      identifiersNeedingCopy.add(id);
    }
  }

  // Separate right elements into expressions and identifiers
  interface EvalItem {
    index: number;
    element: Expression;
    isExpression: boolean;
  }
  const evalOrder: EvalItem[] = [];

  rightElements.forEach((elem, index) => {
    if (!elem) return;

    // Expressions should be evaluated first (they're safe)
    const isSimpleIdentifier = elem.type === "Identifier";
    const needsCopy = isSimpleIdentifier && identifiersNeedingCopy.has((elem as any).name);

    evalOrder.push({
      index,
      element: elem as Expression,
      isExpression: !needsCopy,
    });
  });

  // Sort: expressions first, then identifiers that need copying
  evalOrder.sort((a, b) => {
    if (a.isExpression === b.isExpression) return a.index - b.index;
    return a.isExpression ? -1 : 1;
  });

  const tempRegs: (RegisterName | null)[] = new Array(rightElements.length).fill(null);

  for (const { index, element } of evalOrder) {
    if (!element) {
      throw new Error("Sparse arrays not supported in destructuring");
    }

    // If we have a shared array base, use it for MemberExpression
    if (
      arrayBaseReg &&
      element.type === "MemberExpression" &&
      (element as MemberExpression).object.type === "Identifier" &&
      ((element as MemberExpression).object as any).name === sharedArrayName
    ) {
      const memberExpr = element as MemberExpression;
      let offsetReg: RegisterName;

      if (memberExpr.property.type === "Identifier") {
        offsetReg = registers.get(memberExpr.property.name);
      } else if (memberExpr.property.type === "Literal") {
        offsetReg = registers.next();
        this.emitInstruction("LDI", [offsetReg, `${memberExpr.property.value}`], null);
      } else {
        offsetReg = compileValue.call(this, memberExpr.property as Expression);
      }

      // Calculate address and load value
      const addrReg = registers.next();
      this.emitInstruction("ADD", [arrayBaseReg, offsetReg, addrReg], null);

      const valueReg = registers.next();
      this.emitInstruction("LOAD", [addrReg, valueReg], element, this.astToSource(element));

      // Use the loaded value directly as temp (no need for extra MOVE)
      tempRegs[index] = valueReg;

      // Free temporary registers
      if (memberExpr.property.type === "Literal") {
        registers.free(offsetReg);
      } else if (memberExpr.property.type !== "Identifier") {
        registers.free(offsetReg);
      }
      registers.free(addrReg);
    } else {
      // Original code path for non-array elements
      const sourceReg = compileValue.call(this, element as Expression);

      // Optimization: Since we evaluate expressions first, identifiers don't need copies
      // because all expressions that reference them have already been evaluated
      // Expression result or identifier - use directly (no copy needed!)
      tempRegs[index] = sourceReg;
    }
  }

  // Check if we're storing to elements from the same array on the left side
  let leftArrayBaseReg: RegisterName | null = null;

  if (leftSharedArrayName) {
    // All elements are to the same array - reuse base address if it's the same array
    if (leftSharedArrayName === sharedArrayName && arrayBaseReg) {
      // Same array on both sides, reuse the base register
      leftArrayBaseReg = arrayBaseReg;
    } else {
      // Different array, load its base address
      const arrayInfo = registers.getArray(leftSharedArrayName);
      if (arrayInfo) {
        leftArrayBaseReg = registers.next();
        this.emitInstruction(
          "LDI",
          [leftArrayBaseReg, `${arrayInfo.base}`],
          null,
          `${leftSharedArrayName}.base`,
        );
      }
    }
  }

  // Now assign the temporary registers to the left-hand side variables or array elements
  for (let i = 0; i < leftElements.length; i++) {
    const leftElem = leftElements[i];
    if (!leftElem) {
      throw new Error("Sparse arrays not supported in destructuring pattern");
    }

    const tempReg = tempRegs[i];
    if (!tempReg) {
      throw new Error("Internal error: temp register not allocated");
    }
    const rightElem = rightElements[i] as Expression;

    if (leftElem.type === "Identifier") {
      // Simple identifier assignment: [a, b] = ...
      const varName = leftElem.name;

      // Check if trying to reassign a const
      if (registers.isConst(varName)) {
        throw new Error(`Cannot reassign const variable '${varName}'`);
      }

      const destReg = registers.get(varName);
      const comment = `${varName} <- ${this.astToSource(rightElem)}`;
      this.emitInstruction("MOVE", [tempReg, destReg], rightElem, comment);
    } else if (leftElem.type === "MemberExpression") {
      // Array element assignment: [arr[i], arr[j]] = ...
      const memberExpr = leftElem as MemberExpression;
      assertIdentifier(memberExpr.object);

      const arrayName = memberExpr.object.name;
      const arrayInfo = registers.getArray(arrayName);

      if (!arrayInfo) {
        throw new Error(`${arrayName} is not an array`);
      }

      // Check if we can reuse the base address register
      const useSharedBase = leftArrayBaseReg && leftSharedArrayName === arrayName;

      if (memberExpr.property.type === "Literal") {
        // Static index: [arr[5], ...] = ...
        const index = memberExpr.property.value as number;
        if (index < 0 || index >= arrayInfo.size) {
          throw new Error(
            `Array index ${index} out of bounds for ${arrayName}[0..${arrayInfo.size - 1}]`,
          );
        }

        if (useSharedBase) {
          // Use shared base with offset
          const offsetReg = registers.next();
          this.emitInstruction("LDI", [offsetReg, `${index}`], null);

          const addrReg = registers.next();
          this.emitInstruction("ADD", [leftArrayBaseReg!, offsetReg, addrReg], null);

          this.emitInstruction(
            "STORE",
            [addrReg, tempReg],
            null,
            `${arrayName}[${index}] <- ${this.astToSource(rightElem)}`,
          );
          registers.free(offsetReg, addrReg);
        } else {
          // Calculate full address
          const address = arrayInfo.value + index;
          const addrReg = registers.next();
          this.emitInstruction("LDI", [addrReg, `${address}`], null);
          this.emitInstruction(
            "STORE",
            [addrReg, tempReg],
            null,
            `${arrayName}[${index}] <- ${this.astToSource(rightElem)}`,
          );
          registers.free(addrReg);
        }
      } else if (memberExpr.property.type === "Identifier") {
        // Dynamic index with identifier: [arr[i], ...] = ...
        const indexReg = registers.get(memberExpr.property.name);

        if (useSharedBase) {
          // Use shared base + index
          const addrReg = registers.next();
          this.emitInstruction("ADD", [leftArrayBaseReg!, indexReg, addrReg], null);

          this.emitInstruction(
            "STORE",
            [addrReg, tempReg],
            null,
            `${arrayName}[${memberExpr.property.name}] <- ${this.astToSource(rightElem)}`,
          );
          registers.free(addrReg);
        } else {
          // Load base and calculate address
          const baseReg = registers.next();
          this.emitInstruction("LDI", [baseReg, `${arrayInfo.value}`], null);

          const addrReg = registers.next();
          this.emitInstruction("ADD", [baseReg, indexReg, addrReg], null);

          this.emitInstruction(
            "STORE",
            [addrReg, tempReg],
            null,
            `${arrayName}[${memberExpr.property.name}] <- ${this.astToSource(rightElem)}`,
          );
          registers.free(baseReg, addrReg);
        }
      } else {
        // Expression in index: [arr[i + 1], ...] = ...
        const indexReg = compileValue.call(this, memberExpr.property as Expression);

        if (useSharedBase) {
          // Use shared base + computed index
          const addrReg = registers.next();
          this.emitInstruction("ADD", [leftArrayBaseReg!, indexReg, addrReg], null);

          this.emitInstruction(
            "STORE",
            [addrReg, tempReg],
            null,
            `${this.astToSource(memberExpr)} <- ${this.astToSource(rightElem)}`,
          );
          registers.free(addrReg);
        } else {
          // Load base and calculate address
          const baseReg = registers.next();
          this.emitInstruction("LDI", [baseReg, `${arrayInfo.value}`], null);

          const addrReg = registers.next();
          this.emitInstruction("ADD", [baseReg, indexReg, addrReg], null);

          this.emitInstruction(
            "STORE",
            [addrReg, tempReg],
            null,
            `${this.astToSource(memberExpr)} <- ${this.astToSource(rightElem)}`,
          );
          registers.free(baseReg, addrReg);
        }

        registers.free(indexReg);
      }
    } else {
      throw new Error(`Unsupported destructuring pattern element type: ${leftElem.type}`);
    }

    // Always free the temp register since we created it explicitly
    registers.free(tempReg);
  }

  // Free the base address registers if they were allocated
  if (arrayBaseReg && (!leftArrayBaseReg || leftArrayBaseReg !== arrayBaseReg)) {
    registers.free(arrayBaseReg);
  }

  if (leftArrayBaseReg && leftArrayBaseReg !== arrayBaseReg) {
    registers.free(leftArrayBaseReg);
  }
};

const compileExpressionStatement = function (
  this: CompilerContext,
  node: ExpressionStatement,
): void {
  assertCompilerContext(this);

  switch (node.expression.type) {
    case "AssignmentExpression": {
      const { left, right, operator } = node.expression;

      // Handle array destructuring assignment: [a, b] = [b, a]
      if (left.type === "ArrayPattern" && right.type === "ArrayExpression") {
        compileArrayDestructuringAssignment.call(this, operator, left, right);
        break;
      }

      // Handle array element assignment: arr[i] = value
      if (left.type === "MemberExpression") {
        const memberExpr = left as MemberExpression;
        assertIdentifier(memberExpr.object);

        const arrayName = memberExpr.object.name;
        const arrayInfo = registers.getArray(arrayName);
        if (!arrayInfo) {
          throw new Error(`${arrayName} is not an array`);
        }

        // Get value to store (suppress LDI comment for literals since STORE will show the value)
        const valueReg = compileValue.call(this, right, "", right.type === "Literal");

        if (memberExpr.property.type === "Literal") {
          // Static index: arr[5] = value
          const index = memberExpr.property.value as number;
          if (index < 0 || index >= arrayInfo.size) {
            throw new Error(
              `Array index ${index} out of bounds for ${arrayName}[0..${arrayInfo.size - 1}]`,
            );
          }

          // Calculate actual memory address
          const address = arrayInfo.value + index;
          const addrReg = registers.next();
          this.emitInstruction("LDI", [addrReg, `${address}`], null);
          this.emitInstruction("STORE", [addrReg, valueReg], right, `${arrayName}[${index}] <- `);

          registers.free(addrReg);
        } else if (memberExpr.property.type === "Identifier") {
          // Dynamic index with identifier: arr[i] = value
          const indexReg = registers.get(memberExpr.property.name);

          // Load array start address
          const addrReg = registers.next();
          this.emitInstruction("LDI", [addrReg, `${arrayInfo.value}`], null);

          // Calculate actual address: startAddress + index
          const finalAddrReg = registers.next();
          this.emitInstruction("ADD", [addrReg, indexReg, finalAddrReg], null);

          // Store value at calculated address
          this.emitInstruction(
            "STORE",
            [finalAddrReg, valueReg],
            right,
            `${arrayName}[${memberExpr.property.name}] <- `,
          );
          registers.free(addrReg, finalAddrReg);
        } else {
          // Expression in index: arr[i + 1] = value
          const indexReg = compileValue.call(this, memberExpr.property as Expression);

          // Load array start address
          const addrReg = registers.next();
          this.emitInstruction("LDI", [addrReg, `${arrayInfo.value}`], null);

          // Calculate actual address: startAddress + index
          const finalAddrReg = registers.next();
          this.emitInstruction("ADD", [addrReg, indexReg, finalAddrReg], null);

          // Store value at calculated address - use astToSource for the full expression
          this.emitInstruction(
            "STORE",
            [finalAddrReg, valueReg],
            right,
            `${this.astToSource(memberExpr)} <- `,
          );
          registers.free(indexReg, addrReg, finalAddrReg);
        }

        if (right.type !== "Identifier") {
          registers.free(valueReg);
        }
        break;
      }

      assertIdentifier(left);

      // Check if trying to reassign a const
      if (registers.isConst(left.name)) {
        throw new Error(`Cannot reassign const variable '${left.name}'`);
      }

      // Handle compound assignment operators like +=, -=
      if (operator !== "=") {
        if (!registers.has(left.name)) {
          throw new Error(`Variable ${left.name} not defined for compound assignment`);
        }

        // For compound assignment, evaluate the right side first
        // If it's a call expression, pass the assignment context
        let rightReg: RegisterName;
        if (right.type === "CallExpression") {
          const commentPrefix = `${left.name} ${operator} `;
          rightReg = compileCallExpressionWithReturn.call(this, right, commentPrefix);
        } else {
          rightReg = compileValue.call(this, right);
        }

        const varReg = registers.get(left.name);

        // Convert compound operator to instruction
        const binaryOp = operator.slice(0, -1);

        switch (binaryOp) {
          case "+":
            // Check if right side is a literal (can use ADDI)
            if (right.type === "Literal") {
              this.emitInstruction(
                "ADDI",
                [varReg, right.value as string],
                right,
                `${left.name} += `,
              );
            } else {
              this.emitInstruction("ADD", [varReg, rightReg, varReg], right, `${left.name} += `);
            }
            break;
          case "-":
            // Check if right side is a literal (can use SUBI)
            if (right.type === "Literal") {
              this.emitInstruction(
                "SUBI",
                [varReg, right.value as string],
                right,
                `${left.name} -= `,
              );
            } else {
              this.emitInstruction("SUB", [varReg, rightReg, varReg], right, `${left.name} -= `);
            }
            break;
          default:
            throw new Error(`Unsupported compound assignment operator: ${operator}`);
        }

        // Free the right register if it's not the variable register
        if (rightReg !== varReg) {
          registers.free(rightReg);
        }
      } else {
        compileAssignmentExpression.call(this, right, left.name);
      }
      break;
    }

    case "CallExpression": {
      compileCallExpression.call(this, node.expression);
      break;
    }

    case "UpdateExpression": {
      compileUpdateExpression.call(this, node.expression);
      break;
    }

    default:
      throw new Error("Unsupported expression type: " + node.expression.type);
  }
};

export default compileExpressionStatement;
