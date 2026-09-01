export const GAUGE_CX = 60;
export const GAUGE_CY = 54;
export const GAUGE_R = 46;
export const GAUGE_STROKE_WIDTH = 10;

/** Degrees a round cap extends along the arc (strokeWidth/2 / radius). */
export const gaugeJoinInsetDeg = (
  strokeWidth = GAUGE_STROKE_WIDTH,
  radius = GAUGE_R,
) => (strokeWidth / 2 / radius) * (180 / Math.PI);

/**
 * Inset interior joins so round caps meet instead of stacking into blobs.
 * Outer ends (180° / 0°) stay flush.
 */
export const insetArcJoins = (
  startDeg: number,
  endDeg: number,
  insetStart: boolean,
  insetEnd: boolean,
  insetDeg: number,
): { startDeg: number; endDeg: number } | null => {
  const span = startDeg - endDeg;
  if (span <= 0.05) return null;
  const maxInset = Math.max(0, span / 2 - 0.15);
  const used = Math.min(Math.max(0, insetDeg), maxInset);
  const nextStart = insetStart ? startDeg - used : startDeg;
  const nextEnd = insetEnd ? endDeg + used : endDeg;
  if (nextStart - nextEnd <= 0.05) return null;
  return { startDeg: nextStart, endDeg: nextEnd };
};

export const pointOnGaugeArc = (degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  return {
    x: GAUGE_CX + GAUGE_R * Math.cos(rad),
    y: GAUGE_CY - GAUGE_R * Math.sin(rad),
  };
};

export const describeGaugeTopArc = (startDeg: number, endDeg: number) => {
  const start = pointOnGaugeArc(startDeg);
  const end = pointOnGaugeArc(endDeg);
  const delta = Math.abs(startDeg - endDeg);
  if (delta < 0.01) return '';
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = startDeg > endDeg ? 1 : 0;
  return `M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
};
