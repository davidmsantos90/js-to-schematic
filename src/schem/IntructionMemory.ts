import ISA from "../ISA";
import { asBitArray, BinaryString, Bit } from "../types/ISA";
import { Direction, Position3D } from "../types/schematic";
import Schematic from "./Schematic";

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

      // 180° rotation: invert Z for second side
      if (i === 1) pos.z += 2; // was: pos.z -= 2
      // 180° rotation: invert X direction
      pos.x += 2 * j; // was: pos.x -= 2 * j
      if (j >= 16) pos.x += 4; // was: pos.x -= 4

      for (let k = 0; k < 16; k++) {
        // 16 grupos de 32 instruções
        posList.push({ ...pos });

        // 180° rotation: invert Z direction
        pos.z += 7; // was: pos.z -= 7
        if (k % 2 === 0) {
          // 180° rotation: swap increment/decrement directions
          pos.x += j < 16 ? 1 : -1; // was: pos.x -= j < 16 ? 1 : -1
        } else {
          pos.x -= j < 16 ? 1 : -1; // was: pos.x += j < 16 ? 1 : -1
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
export default function createSchematic(machineCodeLines: BinaryString[]) {
  const TOTAL_INSTRUCTIONS = 1024;

  const instructions: BinaryString[] = [...machineCodeLines];
  while (instructions.length < TOTAL_INSTRUCTIONS)
    instructions.push(ISA.instructions.NOOP.toMachine());

  if (instructions.length > TOTAL_INSTRUCTIONS)
    throw new Error(`Too many instructions: ${instructions.length}`);

  const { positions: posList, bounds, offset, origin } = generatePositions();
  if (posList.length !== 1024) throw new Error("Position list generation failed (expected 1024)");

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

  // ---------- Write instructions (python logic) ----------
  const schematic = new Schematic(width, height, length, palette, offset, origin);

  instructions.forEach((line, address) => {
    // console.log(`Writing instruction ${address}:`, posList[address]);

    if (line.length !== 16) throw new Error("Invalid machine code line: " + line);

    // 180° rotation: swap repeater directions (north <-> south)
    const face: Direction = address < 512 ? "north" : "south"; // was: "south" : "north"
    const cur = posList[address];

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

  return schematic;
}
