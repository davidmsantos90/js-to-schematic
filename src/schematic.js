import fs from "fs";
import nbt from "prismarine-nbt";
import { gzipSync } from "zlib";

class Schematic {
  constructor(width, height, length, palette) {
    const AIR = 0;

    this.width = width;
    this.height = height;
    this.length = length;

    this.blocks = new Int8Array(width * height * length).fill(AIR);
    this._palette = { "minecraft:air": AIR, ...palette };
  }

  _calculateIndex(x, y, z) {
    // const index = y * this.width * this.length + z * this.width + x;
    const strideXZ = this.width;
    const strideY = this.width * this.length;

    return y * strideY + z * strideXZ + x;
  }

  setBlock(x, y, z, paletteId) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.length) {
      throw new Error(`Coordinates out of bounds: (${x}, ${y}, ${z})`);
    }

    const isValidPaletteId = Object.keys(this._palette).some(key => this._palette[key] === paletteId);
    if (!isValidPaletteId) {
      throw new Error(`Unknown block ID: ${paletteId}`);
    }

    const index = this._calculateIndex(x, y, z);
    this.blocks[index] = paletteId;
  }

  get palette() {
    return Object.fromEntries(
      Object.entries(this._palette).map(([name, id]) => [
        name, { type: "int", value: id }
      ])
    );
  }

  get paletteMax() {
    return Object.keys(this._palette).length;
  }

  dump() {
    const nbtData = {
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

        BlockData: { type: "byteArray", value: this.blocks },
        BlockEntities: { type: "list", value: { type: "end", value: [] } }
      }
    };

    const raw = nbt.writeUncompressed(nbtData);
    return gzipSync(raw);
  }
};

function generatePositions(origin = { x: 140, y: 100, z: 140 }, direction = "south") {
  const memStart = { ...origin };
  const posList = []; // 1024 entradas

  // matriz de rotação no plano XZ
  const rotations = {
    east:  (x, z) => [ x, z ],            // identidade
    south: (x, z) => [ -z,  x ],          // 90° CCW
    west:  (x, z) => [ -x, -z ],          // 180°
    north: (x, z) => [  z, -x ],          // 270° CCW
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
          z: memStart.z + rz
        });

        // movimento interno da coluna
        pos.x -= 7;
        if (k % 2 === 0) {
          pos.z += (j < 16) ? 1 : -1;
        } else {
          pos.z -= (j < 16) ? 1 : -1;
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
export default function generateInstructionMemorySchematic(machineCodeLines, name) {
  const TOTAL_INSTRUCTIONS = 1024;
  const BITS_PER_INSTRUCTION = 16;

  // Pad to 1024 like python script
  const instructions = [...machineCodeLines];
  while (instructions.length < TOTAL_INSTRUCTIONS) instructions.push("0".repeat(BITS_PER_INSTRUCTION));
  if (instructions.length > TOTAL_INSTRUCTIONS) throw new Error(`Too many instructions: ${instructions.length}`);

  const posList = generatePositions();
  if (posList.length !== 1024) throw new Error("Position list generation failed (expected 1024)");

  // Determine bounds to size schematic
  let minX = Infinity, 
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;

  posList.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  });

  // Vertical span (writing goes downward 32 blocks from start Y: 8 bits + gap + 8 bits => 32)
  const VERTICAL_DEPTH = 32; // deepest placed bit offset
  minY = minY - (VERTICAL_DEPTH + 2); // extra safety margin (was -30)
  
  const width = (maxX - minX) + 1;
  const height = (maxY - minY) + 1;
  const length = (maxZ - minZ) + 1;

  // Palette (include north/south repeaters now)
  const AIR = 0, PURPLE = 1, REP_NORTH = 2, REP_SOUTH = 3;
  const palette = {
    // "minecraft:air": AIR,
    "minecraft:purple_wool": PURPLE,
    "minecraft:repeater[facing=north]": REP_NORTH,
    "minecraft:repeater[facing=south]": REP_SOUTH
  };

  function toLocal(p) { return { x: p.x - minX, y: p.y - minY, z: p.z - minZ }; }

  // ---------- Write instructions (python logic) ----------
  const schematic = new Schematic(width, height, length, palette);

  instructions.forEach((line, address) => {
    if (line.length !== 16) throw new Error("Invalid machine code line: " + line);
    
    // Flip directions: first half now faces south, second half faces north
    const face = address < 512 ? "south" : "north";
    const cur = toLocal(posList[address]);

    const placeBit = (bit) => {
      const paletteId = bit === '1' ? (face === 'north' ? REP_NORTH : REP_SOUTH) : PURPLE;
      schematic.setBlock(cur.x, cur.y, cur.z, paletteId);

      cur.y -= 2;
    };

    const byte1 = line.slice(8);   // lower half per python script
    const byte2 = line.slice(0, 8); // upper half

    for (let i = 0; i < 8; i++) placeBit(byte1[i]);
    cur.y -= 2; // gap between bytes
    for (let i = 0; i < 8; i++) placeBit(byte2[i]);
  });

  // const buffer = gzipSync(nbt.writeUncompressed(nbtData));
  fs.writeFileSync(`./dist/${name}/${name}.schem`, schematic.dump());

  console.log(`Schematic exported (gzipped): ${name}`);
}
