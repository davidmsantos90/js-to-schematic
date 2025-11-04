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
  offset: number[];
  origin: number[];

  constructor(
    width: number,
    height: number,
    length: number,
    palette: Record<string, number>,
    offset: number[] = [0, 0, 0],
    origin: number[] = [0, 0, 0],
  ) {
    const AIR = 0;

    this.width = width;
    this.height = height;
    this.length = length;
    this.offset = offset; // nova origem interna
    this.origin = origin; // origem para WE

    this.blocks = new Int8Array(width * height * length).fill(AIR);
    this._palette = { "minecraft:air": AIR, ...palette };
  }

  _calculateIndex(x: number, y: number, z: number) {
    const strideXZ = this.width;
    const strideY = this.width * this.length;

    return y * strideY + z * strideXZ + x;
  }

  setBlock(x: number, y: number, z: number, paletteId: number) {
    const localX = x; // - this.offset[0];
    const localY = y; // - this.offset[1];
    const localZ = z; // - this.offset[2];

    if (
      localX < 0 ||
      localX >= this.width ||
      localY < 0 ||
      localY >= this.height ||
      localZ < 0 ||
      localZ >= this.length
    ) {
      throw new Error(`Coordinates out of bounds after offset: (${localX}, ${localY}, ${localZ})`);
    }

    // console.log(`local coords: (${localX}, ${localY}, ${localZ}); paletteId: ${paletteId}`);

    const isValidPaletteId = Object.keys(this._palette).some(
      (key) => this._palette[key] === paletteId,
    );
    if (!isValidPaletteId) {
      throw new Error(`Unknown block ID: ${paletteId}`);
    }

    const index = this._calculateIndex(localX, localY, localZ);
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

  /**
   * Cola outro schematic dentro deste, com um offset opcional (tipo mcschematic.placeStructure)
   * @param incoming O schematic a colar
   * @param placePosition {x,y,z} deslocamento relativo (default: 0,0,0)
   */
  paste(incoming: Schematic, placePosition: Position3D = { x: 0, y: 0, z: 0 }) {
    for (let y = 0; y < incoming.height; y++) {
      for (let z = 0; z < incoming.length; z++) {
        for (let x = 0; x < incoming.width; x++) {
          const idx = incoming._calculateIndex(x, y, z);
          const blockId = incoming.blocks[idx];
          if (blockId !== incoming._palette["minecraft:air"]) {
            this.setBlock(x + placePosition.x, y + placePosition.y, z + placePosition.z, blockId);
          }
        }
      }
    }
  }

  dump() {
    const nbtData: NBT = {
      type: "compound",
      name: "Schematic",
      value: {
        Version: { type: "int", value: 2 },
        DataVersion: { type: "int", value: 4440 },

        Width: { type: "short", value: this.width }, // X
        Height: { type: "short", value: this.height }, // Y
        Length: { type: "short", value: this.length }, // Z
        Offset: { type: "intArray", value: this.offset.map((v) => -v) },

        Metadata: {
          type: "compound",
          value: {
            WorldEdit: {
              type: "compound",
              value: {
                Version: { type: "string", value: "7.3.16" },
                EditingPlatform: { type: "string", value: "enginehub:fabric" },
                Origin: {
                  type: "intArray",
                  value: [0, 0, 0], // this.origin
                },
                Platforms: {
                  type: "compound",
                  value: {
                    "enginehub:fabric": {
                      type: "compound",
                      value: {
                        Name: { type: "string", value: "Fabric-Official" },
                        Version: { type: "string", value: "7.3.16+cbf4bd5" },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // version 2
        PaletteMax: { type: "int", value: this.paletteMax },
        Palette: { type: "compound", value: this.palette },
        BlockData: { type: "byteArray", value: Array.from(this.blocks) },
        BlockEntities: { type: "list", value: { type: "compound", value: [] } },

        // version 3
        // Blocks: {
        //   type: "compound",
        //   value: {
        //     Palette: { type: "compound", value: this.palette },
        //     Data: { type: "byteArray", value: Array.from(this.blocks) },
        //     BlockEntities: { type: "list", value: { type: "compound", value: [] } }
        //   }
        // },
      },
    };

    // console.log("Schematic NBT structure:", nbtData);

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

// matriz de rotação no plano XZ
const rotations: Record<string, (x: number, z: number) => [number, number]> = {
  north: (x: number, z: number) => [x, z], // identidade (facing north: X increases, Z decreases)
  east: (x: number, z: number) => [-z, x], // 90° CW from north
  south: (x: number, z: number) => [-x, -z], // 180° from north
  west: (x: number, z: number) => [z, -x], // 270° CW from north (or 90° CCW)
};

function generatePositions(
  origin: Position3D = { x: 0, y: 0, z: 0 },
  direction: Direction = "south",
) {
  const memStart = { ...origin };
  const posList: Array<Position3D> = []; // 1024 entradas

  for (let i = 0; i < 2; i++) {
    // duas "faces" (norte/sul)
    for (let j = 0; j < 32; j++) {
      // 32 colunas por face
      const pos = { ...memStart };

      if (i === 1) pos.z -= 2; // Z increases for second side
      pos.x -= 2 * j; // Z decreases over time (facing north)
      if (j >= 16) pos.x -= 4; // Additional gap, Z continues decreasing

      for (let k = 0; k < 16; k++) {
        // 16 grupos de 32 instruções
        posList.push({ ...pos });

        pos.z -= 7;
        if (k % 2 === 0) {
          pos.x -= j < 16 ? 1 : -1; // Z decreases (was +=)
          // pos.x += j < 16 ? 1 : -1;
        } else {
          pos.x += j < 16 ? 1 : -1; // Z increases (was -=)
          //  pos.x -= j < 16 ? 1 : -1;
        }
      }
    }
  }

  // ---------- Compute bounds ----------
  const VERTICAL_DEPTH = 32; // deepest placed bit offset

  const min = {
    x: Math.min(...posList.map((p) => p.x)),
    y: -(VERTICAL_DEPTH + 2),
    z: Math.min(...posList.map((p) => p.z)),
  };
  const max = {
    x: Math.max(...posList.map((p) => p.x)),
    y: 0,
    z: Math.max(...posList.map((p) => p.z)),
  };

  // ---------- Transladar para positivo ----------
  const translation = {
    x: -min.x, // mover tudo de modo a que min.x = 0
    y: -min.y,
    z: -min.z,
  };

  const shiftedPositions = posList.map((p) => ({
    x: p.x + translation.x,
    y: p.y + translation.y,
    z: p.z + translation.z,
  }));

  const shiftedOrigin = {
    x: origin.x + translation.x,
    y: origin.y + translation.y,
    z: origin.z + translation.z,
  };

  // ---------- Compute offset ----------
  const offset = {
    x: min.x - origin.x,
    y: min.y - origin.y,
    z: min.z - origin.z,
  };

  // console.log("Offset:", offset);
  // console.log("Origin:", shiftedOrigin);
  // console.log("Bounds:", min, max);

  return {
    positions: shiftedPositions,
    origin: [shiftedOrigin.x, shiftedOrigin.y, shiftedOrigin.z],
    offset: [offset.x, offset.y, offset.z],
    bounds: { min, max },
    translation,
  };
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

  // orig [ -131, 224, 557 ]
  // Pad to 1024 like python script
  const instructions: BinaryString[] = [...machineCodeLines];
  while (instructions.length < TOTAL_INSTRUCTIONS)
    instructions.push(ISA.instructions.NOOP.toMachine());
  if (instructions.length > TOTAL_INSTRUCTIONS)
    throw new Error(`Too many instructions: ${instructions.length}`);

  const { positions: posList, bounds, offset, origin } = generatePositions();
  if (posList.length !== 1024) throw new Error("Position list generation failed (expected 1024)");

  // Determine bounds to size schematic
  // let minX = Infinity,
  //   maxX = -Infinity,
  //   minY = Infinity,
  //   maxY = -Infinity,
  //   minZ = Infinity,
  //   maxZ = -Infinity;

  // posList.forEach((p) => {
  //   if (p.x < minX) minX = p.x;
  //   if (p.x > maxX) maxX = p.x;
  //   if (p.y < minY) minY = p.y;
  //   if (p.y > maxY) maxY = p.y;
  //   if (p.z < minZ) minZ = p.z;
  //   if (p.z > maxZ) maxZ = p.z;
  // });

  // Vertical span (writing goes downward 32 blocks from start Y: 8 bits + gap + 8 bits => 32)
  // const VERTICAL_DEPTH = 32; // deepest placed bit offset
  // minY = minY - (VERTICAL_DEPTH + 2); // extra safety margin (was -30)

  const width = bounds.max.x - bounds.min.x + 1;
  const height = bounds.max.y - bounds.min.y + 1;
  const length = bounds.max.z - bounds.min.z + 1;
  // console.log(`Schematic size: ${width} x ${height} x ${length} (W x H x L)`);

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

  //function toLocal(p: Position3D): Position3D {
  //  return { x: p.x - minX, y: p.y - minY, z: p.z - minZ };
  //}

  // ---------- Write instructions (python logic) ----------
  // const baseSchematic = new Schematic(width * 2, height * 2, length * 2, palette);
  const schematic = new Schematic(width, height, length, palette, offset, origin);

  instructions.forEach((line, address) => {
    // console.log(`Writing instruction ${address}:`, posList[address]);

    if (line.length !== 16) throw new Error("Invalid machine code line: " + line);

    // Flip directions: first half now faces south, second half faces north
    const face: Direction = address < 512 ? "south" : "north"; // "north" : "south";
    const cur = posList[address]; // toLocal(posList[address]); //

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

  // baseSchematic.paste(schematic, { x: width, y: -height, z: -length });

  // const buffer = gzipSync(nbt.writeUncompressed(nbtData));
  fs.writeFileSync(`./dist/${name}/${name}.schem`, schematic.dump());

  console.log(`Schematic exported (gzipped): ${name}`);
}
