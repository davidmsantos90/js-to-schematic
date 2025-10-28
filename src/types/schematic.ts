export type Direction = "east" | "south" | "west" | "north";

export interface Position2D {
  x: number;
  z: number;
}
export interface Position3D extends Position2D {
  y: number;
}