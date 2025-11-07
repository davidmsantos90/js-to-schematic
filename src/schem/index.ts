import fs from "fs";

import { BinaryString } from "../types/ISA";
import createInstructionMemory from "./IntructionMemory";
import Schematic from "./Schematic";

export default function createSchematic(machineCodeLines: BinaryString[], name: string) {
  // ---------- Create instruction memory schematic ----------
  const instructionMemory = createInstructionMemory(machineCodeLines);

  // Note: The paste method in Schematic.ts is correctly implemented and matches
  // the standard WorldEdit/Sponge schematic format:
  // - Iteration order: Y->Z->X
  // - Index calculation: y * width * length + z * width + x
  // - Applies position offset correctly
  // - Skips air blocks during paste

  const PURPLE = 1;
  const REP_NORTH = 2;
  const REP_SOUTH = 3;

  const palette = {
    "minecraft:purple_wool": PURPLE,
    "minecraft:repeater[facing=north]": REP_NORTH,
    "minecraft:repeater[facing=south]": REP_SOUTH,
  };

  // To paste at negative Y without using offset metadata:
  // 1. Create a larger schematic with extra height to accommodate negative Y
  // 2. Paste at a positive Y position within the schematic
  // 3. Set the Origin metadata to shift the world position

  const base = new Schematic(
    instructionMemory.width * 2,
    instructionMemory.height * 2,
    instructionMemory.length * 2,
    palette,
    // [0, 0, 0], // offset (not used for negative Y)
    // [0, -extraHeight, 0] // origin: shift world position down by extraHeight
  );

  base.paste(instructionMemory, { x: 1, y: 0, z: 3 });

  fs.writeFileSync(`./dist/${name}/${name}.schem`, base.dump());

  console.log(`Schematic exported (gzipped): ${name}`);
}
