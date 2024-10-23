export interface Position {
  x: number;
  y: number;
}

export interface Segment extends Position {}

export interface Velocity extends Position {}

export interface Player {
  id: string;
  position: Position;
  segments: Segment[];
  velocity: Velocity;
  angle: number;
  length: number;
  isDead: boolean;
  color: string;
}
