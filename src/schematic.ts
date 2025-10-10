import fs from "fs";
import nbt, { type NBT, type TagType } from "prismarine-nbt";
import { gzipSync } from "zlib";
import { asBitArray, BinaryString, Bit } from "./types/ISA";
import ISA from "./ISA";

class Schematic {
  width: number;
  height: number;
  length: number;
  blocks: Int8Array;
  _palette: Record<string, number>;

  constructor(width: number, height: number, length: number, palette: Record<string, number>) {
    const AIR = 0;

    this.width = width;
    this.height = height;
    this.length = length;

    this.blocks = new Int8Array(width * height * length).fill(AIR);
    this._palette = { "minecraft:air": AIR, ...palette };
  }

  _calculateIndex(x: number, y: number, z: number) {
    // const index = y * this.width * this.length + z * this.width + x;
    const strideXZ = this.width;
    const strideY = this.width * this.length;

    return y * strideY + z * strideXZ + x;
  }

  setBlock(x: number, y: number, z: number, paletteId: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.length) {
      throw new Error(`Coordinates out of bounds: (${x}, ${y}, ${z})`);
    }

    const isValidPaletteId = Object.keys(this._palette).some(
      (key) => this._palette[key] === paletteId,
    );
    if (!isValidPaletteId) {
      throw new Error(`Unknown block ID: ${paletteId}`);
    }

    const index = this._calculateIndex(x, y, z);
    this.blocks[index] = paletteId;
  }

  get palette() {
    return Object.fromEntries(
      Object.entries(this._palette).map(([name, id]) => [
        name,
        { type: "int" as const, value: id },
      ]),
    );
  }

  get paletteMax() {
    return Object.keys(this._palette).length;
  }

  dump() {
    const nbtData: NBT = {
      type: "compound",
      name: "Schematic",
      value: {
        Version: { type: "int", value: 2 },
        DataVersion: { type: "int", value: 3953 },
        Width: { type: "short", value: this.width },
        Height: { type: "short", value: this.height },
        Length: { type: "short", value: this.length },
        PaletteMax: { type: "int", value: this.paletteMax },
        Palette: { type: "compound", value: this.palette },
        BlockData: { type: "byteArray", value: Array.from(this.blocks) },
        BlockEntities: { type: "list", value: { type: "compound", value: [] } },
      },
    };

    const raw = nbt.writeUncompressed(nbtData);
    return gzipSync(raw);
  }
}

type Direction = "east" | "south" | "west" | "north";
interface Position2D {
  x: number;
  z: number;
}
interface Position3D extends Position2D {
  y: number;
}

function generatePositions(
  origin: Position3D = { x: 140, y: 100, z: 140 },
  direction: Direction = "south",
) {
  const memStart = { ...origin };
  const posList: Array<Position3D> = []; // 1024 entradas

  // matriz de rotação no plano XZ
  const rotations: Record<string, (x: number, z: number) => [number, number]> = {
    east: (x: number, z: number) => [x, z], // identidade
    south: (x: number, z: number) => [-z, x], // 90° CCW
    west: (x: number, z: number) => [-x, -z], // 180°
    north: (x: number, z: number) => [z, -x], // 270° CCW
  };

  const rotate = rotations[direction];

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 32; j++) {
      const pos = { ...memStart };

      if (i === 1) pos.x -= 2;
      pos.z += 2 * j;
      if (j >= 16) pos.z += 4;

      for (let k = 0; k < 16; k++) {
        // aplica rotação global conforme direção
        const ox = pos.x - memStart.x;
        const oz = pos.z - memStart.z;
        const [rx, rz] = rotate(ox, oz);

        posList.push({
          x: memStart.x + rx,
          y: pos.y,
          z: memStart.z + rz,
        });

        // movimento interno da coluna
        pos.x -= 7;
        if (k % 2 === 0) {
          pos.z += j < 16 ? 1 : -1;
        } else {
          pos.z -= j < 16 ? 1 : -1;
        }
      }
    }
  }

  return posList;
}

/**
 * Updated layout (compact stacking):
 * - 16 groups per side, each group has 32 instructions (32 * 16 = 512 per side)
 * - stepZ between consecutive instructions inside a group: 2
 * - Gap after each group (even index): 5 empty blocks, (odd index): 3 empty blocks (no gap after last group)
 * - Two sides (north/south) at x = 0 and x = 1 (reduced separation)
 * - Vertical bit layout (bottom = higher Y value):
 *     Low byte bits (LSB first) at Y: 32,30,28,26,24,22,20,18
 *     Gap of 3 blocks
 *     High byte bits (MSB first sequence mirrored for consistency) at Y: 15,13,11,9,7,5,3,1
 *   (All intra-byte spacing = 2, gap between MSB low and MSB high = 3)
 */
export default function generateInstructionMemorySchematic(
  machineCodeLines: BinaryString[],
  name: string,
) {
  const TOTAL_INSTRUCTIONS = 1024;

  // Pad to 1024 like python script
  const instructions: BinaryString[] = [...machineCodeLines];
  while (instructions.length < TOTAL_INSTRUCTIONS)
    instructions.push(ISA.instructions.NOOP.toMachine());
  if (instructions.length > TOTAL_INSTRUCTIONS)
    throw new Error(`Too many instructions: ${instructions.length}`);

  const posList = generatePositions();
  if (posList.length !== 1024) throw new Error("Position list generation failed (expected 1024)");

  // Determine bounds to size schematic
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  posList.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });

  // Vertical span (writing goes downward 32 blocks from start Y: 8 bits + gap + 8 bits => 32)
  const VERTICAL_DEPTH = 32; // deepest placed bit offset
  minY = minY - (VERTICAL_DEPTH + 2); // extra safety margin (was -30)

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const length = maxZ - minZ + 1;

  // Palette (include north/south repeaters now)
  const AIR = 0,
    PURPLE = 1,
    REP_NORTH = 2,
    REP_SOUTH = 3;
  const palette = {
    // "minecraft:air": AIR,
    "minecraft:purple_wool": PURPLE,
    "minecraft:repeater[facing=north]": REP_NORTH,
    "minecraft:repeater[facing=south]": REP_SOUTH,
  };

  function toLocal(p: Position3D): Position3D {
    return { x: p.x - minX, y: p.y - minY, z: p.z - minZ };
  }

  // ---------- Write instructions (python logic) ----------
  const schematic = new Schematic(width, height, length, palette);

  instructions.forEach((line, address) => {
    if (line.length !== 16) throw new Error("Invalid machine code line: " + line);

    // Flip directions: first half now faces south, second half faces north
    const face: Direction = address < 512 ? "south" : "north";
    const cur = toLocal(posList[address]);

    const placeBit = (bit: Bit) => {
      const paletteId = bit === "1" ? (face === "north" ? REP_NORTH : REP_SOUTH) : PURPLE;
      schematic.setBlock(cur.x, cur.y, cur.z, paletteId);

      cur.y -= 2;
    };

    const byte1: Bit[] = asBitArray(line.slice(8)); // lower half per python script
    for (const bit of byte1) placeBit(bit);

    cur.y -= 2; // gap between bytes

    const byte2: Bit[] = asBitArray(line.slice(0, 8)); // upper half
    for (const bit of byte2) placeBit(bit);
  });

  // const buffer = gzipSync(nbt.writeUncompressed(nbtData));
  fs.writeFileSync(`./dist/${name}/${name}.schem`, schematic.dump());

  console.log(`Schematic exported (gzipped): ${name}`);
}
