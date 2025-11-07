import { Expression, Identifier, Pattern, Super } from "estree";

export interface AssemblyEntry {
  type: "instruction" | "label" | "blank" | "define";
  text: string;
  comment?: string | null;
}

export function isIdentifier(pattern: Pattern | Expression | Super): pattern is Identifier {
  return pattern != null && pattern.type === "Identifier";
}

export function assertIdentifier(
  pattern: Pattern | Expression | Super,
): asserts pattern is Identifier {
  if (!isIdentifier(pattern)) {
    throw new Error(`Not an Identifier: ${JSON.stringify(pattern, null, 2)}`);
  }
}
