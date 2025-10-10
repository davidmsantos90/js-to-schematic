import fs from "fs";
import path from "path";

import compile from "./src/compile/index.js";
import assemble from "./src/assemble/index.js";
import buildSchematicFile from "./src/schematic.js";

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
const assembly = ext === ".as" ? sourceCode.split(/\r?\n/) : compile(sourceCode, name);

// 2. Assemble to machine code
console.log("Assembling to machine code...");
const machine = assemble(assembly, name);

// 3. Build schematic file
console.log("Building schematic file...");
buildSchematicFile(machine, name, { offsetStrategy: "opposite-corner" });
