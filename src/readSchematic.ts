import fs from "fs";
import path from "path";
import zlib from "zlib";
import nbt from "prismarine-nbt";

function loadSchematic(filePath: string): void {
  const buffer = fs.readFileSync(filePath);

  try {
    // Try to decompress first (most schematics are gzipped)
    let data: Buffer;
    try {
      data = zlib.gunzipSync(buffer);
    } catch {
      // If decompression fails, use the raw buffer
      data = buffer;
    }

    parseNBT(data);
  } catch (error) {
    console.error("Failed to load schematic:", error);
  }
}

function parseNBT(data: Buffer): void {
  try {
    const result = nbt.parseUncompressed(data);
    const simplified = nbt.simplify(result);
    console.log("Schematic Data Structure:\n");
    console.dir(simplified, { depth: null });
  } catch (error) {
    console.error("Failed to parse schematic:", error);
  }
}

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

loadSchematic(sourcePath);
