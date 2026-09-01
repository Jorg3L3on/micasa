export const MICASA_MARK_SIZE = { width: 196, height: 78 } as const;
export const MICASA_MARK_VIEWBOX = `0 0 ${MICASA_MARK_SIZE.width} ${MICASA_MARK_SIZE.height}`;
/** Half-thickness of each capsule — fat rounded bars like Zigzag / Workia. */
export const MICASA_MARK_RADIUS = 10.5;

export type MicasaMarkNode = {
  readonly x: number;
  readonly y: number;
};

/**
 * Three-peak rooftop zigzag. Two peaks fill into a letter M when the bars are
 * this thick; a third peak keeps the glyph in the zigzag family (not M / W / Z).
 */
export const MICASA_MARK_NODES: readonly MicasaMarkNode[] = [
  { x: 16, y: 56 },
  { x: 44, y: 22 },
  { x: 72, y: 56 },
  { x: 100, y: 22 },
  { x: 128, y: 56 },
  { x: 156, y: 22 },
  { x: 184, y: 56 },
];

export type MicasaMarkBar = {
  readonly index: number;
  readonly start: MicasaMarkNode;
  readonly end: MicasaMarkNode;
  readonly length: number;
  readonly angleDeg: number;
};

export const getMicasaMarkBars = (
  nodes: readonly MicasaMarkNode[] = MICASA_MARK_NODES,
): MicasaMarkBar[] =>
  nodes.slice(0, -1).map((start, index) => {
    const end = nodes[index + 1];
    if (!end) {
      throw new Error('MiCasa mark nodes must include a pair for each bar');
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return {
      index,
      start,
      end,
      length: Math.hypot(dx, dy),
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });

export const MICASA_MARK_BARS = getMicasaMarkBars();

/** Horizontal stadium in local space; rotate by `angleDeg` around `start`. */
export const getMicasaMarkCapsuleRect = (length: number, radius = MICASA_MARK_RADIUS) => ({
  x: -radius,
  y: -radius,
  width: length + radius * 2,
  height: radius * 2,
  rx: radius,
});

export const getMicasaMarkBarTransform = (bar: MicasaMarkBar) =>
  `translate(${bar.start.x} ${bar.start.y}) rotate(${bar.angleDeg})`;

/** Per-bar fill: specular top edge → body → shade, blue → violet across the glyph. */
export const MICASA_MARK_BAR_PALETTE = [
  { highlight: '#d2e4ff', mid: '#6ea4ff', shade: '#3d6cf0' },
  { highlight: '#c8d8ff', mid: '#5b8cff', shade: '#3a5cf8' },
  { highlight: '#c5d0ff', mid: '#5b64fc', shade: '#3a37fc' },
  { highlight: '#d4c4ff', mid: '#7b5cf6', shade: '#6b3aed' },
  { highlight: '#e4c4ff', mid: '#a06cff', shade: '#9333ea' },
  { highlight: '#efc6ff', mid: '#c084fc', shade: '#a855f7' },
] as const;
