import fs from "fs";
import path from "path";

import assemble from "./src/assemble/index.js";
import compile from "./src/compile/index.js";
import buildSchematicFile from "./src/schem/index.js";

// Usage: node index.js <source.(js|as)>
const [, , argPath] = process.argv;
if (!argPath) {
  console.error("Usage: node index.js <source.(js|as)>");
  process.exit(1);
}

const sourcePath = path.resolve(argPath);
if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`);
  process.exit(1);
}

const ext = path.extname(sourcePath).toLowerCase();
const sourceCode = fs.readFileSync(sourcePath, "utf-8");
const name = path.basename(sourcePath, ext);

fs.mkdirSync(`./dist/${name}`, { recursive: true });

// 1. Compile or read assembly
console.log("Starting compilation/assembly reading...");
let assembly: string[];

if (ext === ".as") {
  // Read base assembly and combine with input assembly
  const baseAssemblyPath = path.resolve("./code-files/base.as");
  const baseAssembly = fs.readFileSync(baseAssemblyPath, "utf-8");

  // Combine: base assembly + blank line + input assembly
  const combinedAssembly = baseAssembly + "\n\n" + sourceCode;
  assembly = combinedAssembly.split(/\r?\n/);

  // Display the combined assembly
  console.log("==> Assembly:\n");
  assembly.forEach((line, index) => {
    console.log(`${index.toString().padStart(2, " ")}.  ${line}`);
  });
} else {
  // Compile JavaScript to assembly (already includes base)
  assembly = compile(sourceCode, name);
}

// 2. Assemble to machine code
console.log("\n\nAssembling to machine code...");
const machine = assemble(assembly, name);

// 3. Build schematic file
console.log("\n\nBuilding schematic file...");
buildSchematicFile(machine, name);
