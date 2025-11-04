import type {
  ArrayExpression,
  ArrayPattern,
  AssignmentExpression,
  CallExpression,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  IfStatement,
  MemberExpression,
  ReturnStatement,
  Statement,
  UpdateExpression,
  VariableDeclaration,
} from "estree";
import { STACK_POINTER_REGISTER, ZERO_REGISTER, type RegisterName } from "../../types/ISA.js";
import { assertIdentifier } from "../../types/assembly.js";
import registers from "../memory/registers.js";

import type { CompilerContext } from "../CompilerContext.js";
import type { CompileValueFn, CompileComparisonFn } from "./expressionCompiler.js";
import type { CompileStatementFn } from "./loopCompiler.js";

export type StatementCompiler = (
  context: CompilerContext,
  dependencies: {
    compileValue: CompileValueFn;
    compileComparison: CompileComparisonFn;
    compileUpdateExpression: (node: UpdateExpression) => void;
  },
) => {
  compileVariableDeclaration: (node: VariableDeclaration) => void;
  compileExpressionStatement: (node: ExpressionStatement) => void;
  compileIfStatement: (node: IfStatement, compileStatement: CompileStatementFn) => void;
  compileFunctionDeclaration: (
    node: FunctionDeclaration,
    compileStatement: CompileStatementFn,
  ) => void;
  compileReturnStatement: (statement?: ReturnStatement) => void;
  compileAssignmentExpression: (expression: Expression, name: string) => void;
  compileCallExpressionWithReturn: (
    callExpr: CallExpression,
    commentPrefix?: string,
  ) => RegisterName;
};

export const createStatementCompiler: StatementCompiler = (
  context: CompilerContext,
  {
    compileValue,
    compileComparison,
    compileUpdateExpression,
  }: {
    compileValue: CompileValueFn;
    compileComparison: CompileComparisonFn;
    compileUpdateExpression: (node: UpdateExpression) => void;
  },
) => {
  const compileCallExpression = (callExpr: CallExpression): void => {
    assertIdentifier(callExpr.callee);
    const fnName = callExpr.callee.name;

    // Store each argument to stack (r15 is already set to STACK_POINTER)
    // First arg at [r15+0], second at [r15-1], third at [r15-2], etc.
    for (let i = 0; i < callExpr.arguments.length; i++) {
      const arg = callExpr.arguments[i];
      const argReg = compileValue(arg as Expression);

      // STORE arg to stack, showing the expression being stored
      const operands = [STACK_POINTER_REGISTER, argReg];
      if (i > 0) {
        operands.push(`-${i}`);
      }

      const comment = `mem[SP${i > 0 ? " - " + i : ""}] <- `;

      context.emitInstruction("STORE", operands, arg as Expression, comment);

      // Free the register - it's no longer needed
      if (arg.type !== "Identifier") {
        registers.free(argReg);
      }
    }

    const { startLabel } = context.newLabel(fnName);
    context.emitInstruction("CALL", [startLabel], callExpr);

    // Note: Return value (if any) is at [r15 + 1]
  };

  const compileCallExpressionWithReturn = (
    callExpr: CallExpression,
    commentPrefix?: string,
  ): RegisterName => {
    // Execute the call
    compileCallExpression(callExpr);

    // Load return value from stack at [r15 + 1] into a new register (r15 is still STACK_POINTER)
    const resultReg = registers.next();
    const fullPrefix = commentPrefix
      ? `${commentPrefix.replace(/\s*=\s*$/, "")} <- mem[SP + 1]`
      : `mem[SP + 1]`;
    context.emitInstruction("LOAD", [STACK_POINTER_REGISTER, resultReg, "1"], callExpr, fullPrefix);

    return resultReg;
  };

  const compileAssignmentExpression = (expression: Expression, name: string): void => {
    switch (expression.type) {
      case "ArrayExpression": {
        // Array initialization: let arr = [1, 2, 3]
        const elements = expression.elements;
        if (elements.some((el) => el === null)) {
          throw new Error("Sparse arrays are not supported");
        }

        const arrayInfo = registers.setArray(name, elements.length);

        // Load array base address once
        const baseReg = registers.next();
        context.emitInstruction("LDI", [baseReg, `${arrayInfo.base}`], null, `${name}.base`);

        // Allocate a register for element values (reused)
        const valueReg = registers.next();

        // Store each element using base address + offset
        // Hardware supports 4-bit signed offset: -8 to +7
        elements.forEach((element, index) => {
          if (!element) return; // Skip null elements (sparse arrays)

          // Load value into the reused register
          if (element.type === "Identifier") {
            const srcReg = registers.get(element.name);
            context.emitInstruction("MOVE", [srcReg, valueReg], element);
          } else if (element.type === "Literal") {
            // For literals, load directly into valueReg
            context.emitInstruction("LDI", [valueReg, `${element.value}`], null);
          } else {
            // For expressions, compile and move to valueReg
            const tempReg = compileValue(element as Expression);
            if (tempReg !== valueReg) {
              context.emitInstruction("MOVE", [tempReg, valueReg], null);
              registers.free(tempReg);
            }
          }

          const operands = [baseReg, valueReg, `${index}`];
          const comment = `${name}[${index}] <- `;

          // Store value at base + offset
          // Use offset directly in STORE instruction (more efficient)
          context.emitInstruction("STORE", operands, element, comment);
        });

        // Free the registers after all stores
        registers.free(baseReg, valueReg);

        break;
      }

      case "CallExpression": {
        compileCallExpression(expression);

        // Load return value from stack at [r15 + 1] into variable's register (r15 = STACK_POINTER)
        const destinationReg = registers.set(name);
        context.emitInstruction(
          "LOAD",
          [STACK_POINTER_REGISTER, destinationReg, "1"],
          expression,
          `${name} <- mem[SP + 1]`,
        );
        break;
      }

      case "Identifier": {
        // caso: x = y or let x = constY
        // Check if source is a const variable (define-based)
        const constInfo = registers.getConst(expression.name);
        if (constInfo != null) {
          // Load const value using define name (assembler will substitute)
          const destinationReg = registers.set(name);
          context.emitInstruction(
            "LDI",
            [destinationReg, expression.name],
            expression,
            `${name} = `,
          );
          break;
        }

        // Regular register variable - will throw if it was a const (out of scope)
        const srcReg = registers.get(expression.name);
        if (!srcReg) throw new Error(`Variable ${expression.name} not defined`);

        const destinationReg = registers.set(name);
        context.emitInstruction("MOVE", [srcReg, destinationReg], expression, `${name} = `);
        break;
      }

      case "Literal": {
        // Fall through to default for all literals including 0
      }

      default: {
        registers.set(name, compileValue(expression, name));
      }
    }
  };

  const compileVariableDeclaration = (node: VariableDeclaration): void => {
    const isConst = node.kind === "const";

    for (const { id, init } of node.declarations) {
      assertIdentifier(id);

      if (isConst) {
        // Const variables are stored in memory
        compileConstDeclaration(id.name, init!);
      } else {
        // Let variables use registers (current behavior)
        compileAssignmentExpression(init!, id.name);
      }
    }
  };

  const compileConstDeclaration = (name: string, init: Expression): void => {
    // Only support literal values for const
    if (init.type !== "Literal") {
      throw new Error(`Const '${name}' must be initialized with a literal value`);
    }

    // Register the const with its value
    const value = init.value as string | number;
    registers.setConst(name, value);

    // Emit define directive
    context.emitDefine(name, value);
  };

  const compileExpressionStatement = (node: ExpressionStatement): void => {
    switch (node.expression.type) {
      case "AssignmentExpression": {
        const { left, right, operator } = node.expression;

        // Handle array destructuring assignment: [a, b] = [b, a]
        if (left.type === "ArrayPattern" && right.type === "ArrayExpression") {
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

          // Optimize: check if we're swapping elements from the same array
          // If so, calculate the base address once and reuse it
          let arrayBaseReg: RegisterName | null = null;
          let sharedArrayName: string | null = null;

          // Check if all elements are from the same array
          const allFromSameArray = rightElements.every((elem) => {
            if (!elem || elem.type !== "MemberExpression") return false;
            const memberExpr = elem as MemberExpression;
            if (memberExpr.object.type !== "Identifier") return false;
            const arrayName = (memberExpr.object as any).name;
            if (sharedArrayName === null) {
              sharedArrayName = arrayName;
              return true;
            }
            return arrayName === sharedArrayName;
          });

          if (allFromSameArray && sharedArrayName) {
            // All elements are from the same array - load base address once
            const arrayInfo = registers.getArray(sharedArrayName);
            if (arrayInfo) {
              arrayBaseReg = registers.next();
              context.emitInstruction(
                "LDI",
                [arrayBaseReg, `${arrayInfo.value}`],
                null,
                `${sharedArrayName}.base`,
              );
            }
          }

          // Check if left side is also from same array (for swap optimization)
          let leftSharedArrayName: string | null = null;
          const allLeftFromSameArray = leftElements.every((elem) => {
            if (!elem || elem.type !== "MemberExpression") return false;
            const memberExpr = elem as MemberExpression;
            if (memberExpr.object.type !== "Identifier") return false;
            const arrayName = (memberExpr.object as any).name;
            if (leftSharedArrayName === null) {
              leftSharedArrayName = arrayName;
              return true;
            }
            return arrayName === leftSharedArrayName;
          });

          // Optimize: For simple 2-element swaps from same array, use 3 registers only
          // Pattern: [arr[a], arr[b]] = [arr[b], arr[a]] becomes: temp=arr[a]; arr[a]=arr[b]; arr[b]=temp
          const isTwoElementSwap =
            leftElements.length === 2 &&
            allFromSameArray &&
            allLeftFromSameArray &&
            sharedArrayName === leftSharedArrayName &&
            leftElements.every((e) => e?.type === "MemberExpression") &&
            rightElements.every((e) => e?.type === "MemberExpression");

          if (isTwoElementSwap && arrayBaseReg) {
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
              context.emitInstruction("LDI", [idx0Reg, `${leftIdx0.value}`], null);
            } else {
              idx0Reg = compileValue(leftIdx0 as Expression);
            }

            context.emitInstruction("ADD", [baseReg, idx0Reg, addrReg], null);

            // Load first value into r1 (temp = arr[idx0])
            const tempReg = registers.next();
            context.emitInstruction(
              "LOAD",
              [addrReg, tempReg],
              leftElem0,
              context.astToSource(leftElem0),
            );

            // Calculate second address (for arr[left[1]])
            const leftElem1 = leftElements[1] as MemberExpression;
            const leftIdx1 = leftElem1.property;
            let idx1Reg: RegisterName;

            if (leftIdx1.type === "Identifier") {
              idx1Reg = registers.get(leftIdx1.name);
            } else if (leftIdx1.type === "Literal") {
              idx1Reg = registers.next();
              context.emitInstruction("LDI", [idx1Reg, `${leftIdx1.value}`], null);
            } else {
              idx1Reg = compileValue(leftIdx1 as Expression);
            }

            context.emitInstruction("ADD", [baseReg, idx1Reg, addrReg], null);

            // Load second value into r2 (r2 = arr[idx1])
            const value2Reg = registers.next();
            context.emitInstruction(
              "LOAD",
              [addrReg, value2Reg],
              leftElem1,
              context.astToSource(leftElem1),
            );

            // Now do the swap:
            // 1. Store r2 at first address (arr[idx0] = arr[idx1])
            context.emitInstruction("ADD", [baseReg, idx0Reg, addrReg], null);
            context.emitInstruction(
              "STORE",
              [addrReg, value2Reg],
              null,
              `${context.astToSource(leftElem0)} <- ${context.astToSource(rightElements[0] as Expression)}`,
            );

            // 2. Store temp at second address (arr[idx1] = temp)
            context.emitInstruction("ADD", [baseReg, idx1Reg, addrReg], null);
            context.emitInstruction(
              "STORE",
              [addrReg, tempReg],
              null,
              `${context.astToSource(leftElem1)} <- ${context.astToSource(rightElements[1] as Expression)}`,
            );

            // Free allocated registers
            registers.free(addrReg, tempReg, value2Reg);
            if (leftIdx0.type === "Literal" || leftIdx0.type !== "Identifier") {
              registers.free(idx0Reg);
            }
            if (leftIdx1.type === "Literal" || leftIdx1.type !== "Identifier") {
              registers.free(idx1Reg);
            }
            registers.free(arrayBaseReg);

            break;
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
            if (!expr) return;
            if (expr.type === "Identifier") {
              identifiersInExpressions.add(expr.name);
            } else if (expr.type === "BinaryExpression") {
              checkIdentifiersInExpr(expr.left);
              checkIdentifiersInExpr(expr.right);
            } else if (expr.type === "MemberExpression") {
              checkIdentifiersInExpr(expr.object);
              checkIdentifiersInExpr(expr.property);
            }
            // Add more expression types as needed
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
                context.emitInstruction("LDI", [offsetReg, `${memberExpr.property.value}`], null);
              } else {
                offsetReg = compileValue(memberExpr.property as Expression);
              }

              // Calculate address and load value
              const addrReg = registers.next();
              context.emitInstruction("ADD", [arrayBaseReg, offsetReg, addrReg], null);

              const valueReg = registers.next();
              context.emitInstruction(
                "LOAD",
                [addrReg, valueReg],
                element,
                context.astToSource(element),
              );

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
              const sourceReg = compileValue(element as Expression);

              // Optimization: Since we evaluate expressions first, identifiers don't need copies
              // because all expressions that reference them have already been evaluated
              // Expression result or identifier - use directly (no copy needed!)
              tempRegs[index] = sourceReg;
            }
          }

          // Check if we're storing to elements from the same array on the left side
          let leftArrayBaseReg: RegisterName | null = null;

          if (allLeftFromSameArray && leftSharedArrayName) {
            // All elements are to the same array - reuse base address if it's the same array
            if (leftSharedArrayName === sharedArrayName && arrayBaseReg) {
              // Same array on both sides, reuse the base register
              leftArrayBaseReg = arrayBaseReg;
            } else {
              // Different array, load its base address
              const arrayInfo = registers.getArray(leftSharedArrayName);
              if (arrayInfo) {
                leftArrayBaseReg = registers.next();
                context.emitInstruction(
                  "LDI",
                  [leftArrayBaseReg, `${arrayInfo.value}`],
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
              const comment = `${varName} <- ${context.astToSource(rightElem)}`;
              context.emitInstruction("MOVE", [tempReg, destReg], rightElem, comment);
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
                  context.emitInstruction("LDI", [offsetReg, `${index}`], null);

                  const addrReg = registers.next();
                  context.emitInstruction("ADD", [leftArrayBaseReg!, offsetReg, addrReg], null);

                  context.emitInstruction(
                    "STORE",
                    [addrReg, tempReg],
                    null,
                    `${arrayName}[${index}] <- ${context.astToSource(rightElem)}`,
                  );
                  registers.free(offsetReg, addrReg);
                } else {
                  // Calculate full address
                  const address = arrayInfo.value + index;
                  const addrReg = registers.next();
                  context.emitInstruction("LDI", [addrReg, `${address}`], null);
                  context.emitInstruction(
                    "STORE",
                    [addrReg, tempReg],
                    null,
                    `${arrayName}[${index}] <- ${context.astToSource(rightElem)}`,
                  );
                  registers.free(addrReg);
                }
              } else if (memberExpr.property.type === "Identifier") {
                // Dynamic index with identifier: [arr[i], ...] = ...
                const indexReg = registers.get(memberExpr.property.name);

                if (useSharedBase) {
                  // Use shared base + index
                  const addrReg = registers.next();
                  context.emitInstruction("ADD", [leftArrayBaseReg!, indexReg, addrReg], null);

                  context.emitInstruction(
                    "STORE",
                    [addrReg, tempReg],
                    null,
                    `${arrayName}[${memberExpr.property.name}] <- ${context.astToSource(rightElem)}`,
                  );
                  registers.free(addrReg);
                } else {
                  // Load base and calculate address
                  const baseReg = registers.next();
                  context.emitInstruction("LDI", [baseReg, `${arrayInfo.value}`], null);

                  const addrReg = registers.next();
                  context.emitInstruction("ADD", [baseReg, indexReg, addrReg], null);

                  context.emitInstruction(
                    "STORE",
                    [addrReg, tempReg],
                    null,
                    `${arrayName}[${memberExpr.property.name}] <- ${context.astToSource(rightElem)}`,
                  );
                  registers.free(baseReg, addrReg);
                }
              } else {
                // Expression in index: [arr[i + 1], ...] = ...
                const indexReg = compileValue(memberExpr.property as Expression);

                if (useSharedBase) {
                  // Use shared base + computed index
                  const addrReg = registers.next();
                  context.emitInstruction("ADD", [leftArrayBaseReg!, indexReg, addrReg], null);

                  context.emitInstruction(
                    "STORE",
                    [addrReg, tempReg],
                    null,
                    `${context.astToSource(memberExpr)} <- ${context.astToSource(rightElem)}`,
                  );
                  registers.free(addrReg);
                } else {
                  // Load base and calculate address
                  const baseReg = registers.next();
                  context.emitInstruction("LDI", [baseReg, `${arrayInfo.value}`], null);

                  const addrReg = registers.next();
                  context.emitInstruction("ADD", [baseReg, indexReg, addrReg], null);

                  context.emitInstruction(
                    "STORE",
                    [addrReg, tempReg],
                    null,
                    `${context.astToSource(memberExpr)} <- ${context.astToSource(rightElem)}`,
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
          const valueReg = compileValue(right, "", right.type === "Literal");

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
            context.emitInstruction("LDI", [addrReg, `${address}`], null);
            context.emitInstruction(
              "STORE",
              [addrReg, valueReg],
              right,
              `${arrayName}[${index}] <- `,
            );
            registers.free(addrReg);
          } else if (memberExpr.property.type === "Identifier") {
            // Dynamic index with identifier: arr[i] = value
            const indexReg = registers.get(memberExpr.property.name);

            // Load array start address
            const addrReg = registers.next();
            context.emitInstruction("LDI", [addrReg, `${arrayInfo.value}`], null);

            // Calculate actual address: startAddress + index
            const finalAddrReg = registers.next();
            context.emitInstruction("ADD", [addrReg, indexReg, finalAddrReg], null);

            // Store value at calculated address
            context.emitInstruction(
              "STORE",
              [finalAddrReg, valueReg],
              right,
              `${arrayName}[${memberExpr.property.name}] <- `,
            );
            registers.free(addrReg, finalAddrReg);
          } else {
            // Expression in index: arr[i + 1] = value
            const indexReg = compileValue(memberExpr.property as Expression);

            // Load array start address
            const addrReg = registers.next();
            context.emitInstruction("LDI", [addrReg, `${arrayInfo.value}`], null);

            // Calculate actual address: startAddress + index
            const finalAddrReg = registers.next();
            context.emitInstruction("ADD", [addrReg, indexReg, finalAddrReg], null);

            // Store value at calculated address - use astToSource for the full expression
            context.emitInstruction(
              "STORE",
              [finalAddrReg, valueReg],
              right,
              `${context.astToSource(memberExpr)} <- `,
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
            rightReg = compileCallExpressionWithReturn(right, commentPrefix);
          } else {
            rightReg = compileValue(right);
          }

          const varReg = registers.get(left.name);

          // Convert compound operator to instruction
          const binaryOp = operator.slice(0, -1);

          switch (binaryOp) {
            case "+":
              // Check if right side is a literal (can use ADDI)
              if (right.type === "Literal") {
                context.emitInstruction(
                  "ADDI",
                  [varReg, right.value as string],
                  right,
                  `${left.name} += `,
                );
              } else {
                context.emitInstruction(
                  "ADD",
                  [varReg, rightReg, varReg],
                  right,
                  `${left.name} += `,
                );
              }
              break;
            case "-":
              // Check if right side is a literal (can use SUBI)
              if (right.type === "Literal") {
                context.emitInstruction(
                  "SUBI",
                  [varReg, right.value as string],
                  right,
                  `${left.name} -= `,
                );
              } else {
                context.emitInstruction(
                  "SUB",
                  [varReg, rightReg, varReg],
                  right,
                  `${left.name} -= `,
                );
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
          compileAssignmentExpression(right, left.name);
        }
        break;
      }

      case "CallExpression": {
        compileCallExpression(node.expression);
        break;
      }

      case "UpdateExpression": {
        compileUpdateExpression(node.expression);
        break;
      }

      default:
        throw new Error("Unsupported expression type: " + node.expression.type);
    }
  };

  const compileIfStatement = (node: IfStatement, compileStatement: CompileStatementFn): void => {
    const { key, startLabel, endLabel } = context.newLabel("if", true);
    const elseLabel = `${key}_else`;

    if (node.test.type === "BinaryExpression") {
      const falseLabel = node.alternate ? elseLabel : endLabel;
      compileComparison(node.test, startLabel, falseLabel);
    }

    context.emitLabel(startLabel);
    compileStatement(node.consequent);

    if (node.alternate) {
      context.emitInstruction("JUMP", [endLabel]);
      context.emitLabel(elseLabel);
      compileStatement(node.alternate);
    }

    context.emitLabel(endLabel);
  };

  const compileFunctionDeclaration = (
    node: FunctionDeclaration,
    compileStatement: CompileStatementFn,
  ): void => {
    const fnName = node.id!.name;
    const { startLabel, endLabel } = context.newLabel(fnName);

    context.emitInstruction("JUMP", [endLabel]); // don't execute function body on declaration

    context.emitLabel(startLabel);

    // Load parameters from stack into registers (r15 = STACK_POINTER)
    // First param at [r15+0], second at [r15-1], third at [r15-2], etc.
    node.params.forEach((param, index) => {
      assertIdentifier(param);
      const paramName = param.name;
      const paramReg = registers.set(paramName);

      // Calculate offset: first param at 0, second at -1, etc.
      const operands = [STACK_POINTER_REGISTER, paramReg];
      if (index > 0) {
        operands.push(`-${index}`);
      }

      const comment = `${paramName} <- mem[SP${index > 0 ? " - " + index : ""}]`;

      context.emitInstruction("LOAD", operands, null, comment);
    });

    compileStatement(node.body);

    if (node.body.body.every(({ type }) => type !== "ReturnStatement")) {
      compileReturnStatement();
    }

    context.emitLabel(endLabel);
  };

  const compileReturnStatement = (statement?: ReturnStatement): void => {
    if (statement?.argument) {
      const valueReg = compileValue(statement.argument);

      // Store return value at [r15 + 1] (r15 = STACK_POINTER), showing the expression being stored
      context.emitInstruction(
        "STORE",
        [STACK_POINTER_REGISTER, valueReg, "1"],
        statement.argument,
        `mem[SP + 1] <- `,
      );
    }

    // Put the return comment only on the RET instruction (astToSource already adds "return")
    context.emitInstruction("RET", [], statement);
  };

  return {
    compileVariableDeclaration,
    compileExpressionStatement,
    compileIfStatement,
    compileFunctionDeclaration,
    compileReturnStatement,
    compileAssignmentExpression,
    compileCallExpressionWithReturn,
  };
};
