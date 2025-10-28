import nbt, { Compound, NBT } from "prismarine-nbt";
import { gzipSync } from "zlib";
import { Position3D } from "../types/schematic";

const getMetadataTag = (origin: number[]): Compound => ({
  type: "compound",
  value: {
    WorldEdit: {
      type: "compound",
      value: {
        Version: { type: "string", value: "7.3.16" },
        EditingPlatform: { type: "string", value: "enginehub:fabric" },
        Origin: {
          type: "intArray",
          value: origin
        },
        Platforms: {
          type: "compound",
          value: {
            "enginehub:fabric": {
              type: "compound",
              value: {
                Name: { type: "string", value: "Fabric-Official" },
                Version: { type: "string", value: "7.3.16+cbf4bd5" }
              }
            }
          }
        }
      }
    }
  }
});

export default class Schematic {
  width: number;
  height: number;
  length: number;
  blocks: Int8Array;
  private _palette: Record<string, number>;
  offset: number[];
  origin: number[];

  constructor(
    width: number, height: number, length: number,
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
    const localX = x// - this.offset[0];
    const localY = y// - this.offset[1];
    const localZ = z// - this.offset[2];

    if (
      localX < 0 || localX >= this.width ||
      localY < 0 || localY >= this.height ||
      localZ < 0 || localZ >= this.length
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
      ])
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
            this.setBlock(
              x + placePosition.x,
              y + placePosition.y,
              z + placePosition.z,
              blockId
            );
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
        Offset: { type: "intArray", value: this.offset.map(v => -v) },

        Metadata: getMetadataTag(this.origin),

        // version 2
        PaletteMax: { type: "int", value: this.paletteMax },
        Palette: { type: "compound", value: this.palette },
        BlockData: { type: "byteArray", value: Array.from(this.blocks) },
        BlockEntities: { type: "list", value: { type: "compound", value: [] } }

        // version 3
        // Blocks: {
        //   type: "compound",
        //   value: {
        //     Palette: { type: "compound", value: this.palette },
        //     Data: { type: "byteArray", value: Array.from(this.blocks) },
        //     BlockEntities: { type: "list", value: { type: "compound", value: [] } }
        //   }
        // }
      }
    };

    // console.log("Schematic NBT structure:", nbtData);

    const raw = nbt.writeUncompressed(nbtData);
    return gzipSync(raw);
  }
};
