/**
 * Hero particle engine: one WebGL 1 draw call that morphs the particles
 * through six scenes (storm, dial, split, paycheck rain, payment towers,
 * MiCasa mark) and a 2D canvas on top for labels. Ported from the approved
 * prototype; the constants were tuned there, so change them with care.
 *
 * Loaded with a dynamic import after first paint. No library.
 */

import {
  EXPENSES,
  PAYCHECK,
  formatPesos,
  SCENES,
  STILL_SCENE,
  type LandingIcon,
} from '@/components/landing/landing-data';

export type HeroEngineOptions = {
  glCanvas: HTMLCanvasElement;
  labelCanvas: HTMLCanvasElement;
  /** Headline block; the scene is framed below it. */
  textEl: HTMLElement;
  /** Control bar; the scene is framed above it. */
  railEl: HTMLElement;
  /** Reduced motion: no clock, no autoplay, scenes change at once. */
  reduced: boolean;
  /** Autoplay moved to another scene. */
  onScene: (scene: number) => void;
  /**
   * The WebGL context was lost, or the device cannot hold a usable frame rate
   * even at the lowest quality. The caller shows the still.
   */
  onLost: () => void;
};

export type HeroEngine = {
  /** Jump to a scene (timed mode). Autoplay waits 12s after a jump. */
  goTo: (scene: number) => void;
  /** Paused: no autoplay and the ambient motion freezes. Scenes still change on request. */
  setPlaying: (playing: boolean) => void;
  /** Scroll-driven progress 0 to 5, or null to go back to the timer. */
  setScroll: (progress: number | null) => void;
  /** Pointer in clip space (-1 to 1, y up). */
  setPointer: (x: number, y: number, inside: boolean) => void;
  destroy: () => void;
};

const TAU = Math.PI * 2;
const STRIDE = 18;
const SCENE_COUNT = SCENES.length;
const SEG = SCENES.map((scene) => scene.transition);
const HOLD = SCENES.map((scene) => scene.hold);
const USER_HOLD_MS = 12_000;

type Bill = {
  day: number;
  name: string;
  amount: number;
  text: string;
  icon: LandingIcon;
  iconColor: string;
  labelRadius: number;
  /** Tower height. */
  h: number;
  /** Order in which the towers rise, 0 to 1. */
  delay: number;
  /** Storm orbit. */
  rho: number;
  th: number;
  y0: number;
};

/** Below this alpha a label's second line is not drawn. */
const LABEL_FADE_MIN = 0.05;
/** Above this scene mix the second line moves with the label's fade. */
const LABEL_MIX_MIN = 0.02;

/** Tallest tower, and the expense that reaches it. */
const TOWER_SPAN = 0.42;
const TOWER_TOP_PESOS = 7500;

const BILLS: Bill[] = EXPENSES.map((expense, index) => ({
  day: expense.day,
  name: expense.name,
  amount: expense.amount,
  text: `$${expense.amount.toLocaleString('es-MX')}`,
  icon: expense.icon,
  iconColor: expense.iconColor,
  labelRadius: expense.labelRadius,
  h: 0.1 + (TOWER_SPAN * expense.amount) / TOWER_TOP_PESOS,
  delay: index / (EXPENSES.length - 1),
  rho: 0.8 + 0.9 * ((index * 0.618) % 1),
  th: index * 2.4,
  y0: (((index * 0.37) % 1) - 0.5) * 0.6,
}));

const BILL_AT = new Map<number, { bill: Bill; index: number }>(
  BILLS.map((bill, index) => [bill.day, { bill, index }]),
);

/** "¿Cuánto queda?" drifting in the storm. */
const ASK = [
  { rho: 1.35, th: 1.1, y0: 0.22 },
  { rho: 0.95, th: 4.3, y0: -0.28 },
  { rho: 1.8, th: 2.9, y0: 0.05 },
];

/** A loose charge label: a minus sign and whole pesos. */
const charge = (pesos: number): string => `−${formatPesos(pesos)}`;

/** Small loose charges in the storm. Decoration; not counted in "Libre". */
const NOISE = [
  { txt: charge(65), rho: 0.6, th: 0.4, y0: 0.18 },
  { txt: charge(180), rho: 1.1, th: 2.2, y0: -0.2 },
  { txt: charge(320), rho: 1.6, th: 5.4, y0: 0.3 },
  { txt: charge(900), rho: 2.0, th: 3.7, y0: -0.12 },
  { txt: charge(140), rho: 0.85, th: 5.9, y0: -0.34 },
  { txt: charge(49), rho: 1.45, th: 0.2, y0: 0.1 },
  { txt: charge(1_200), rho: 2.2, th: 1.6, y0: 0.2 },
  { txt: charge(75), rho: 1.2, th: 3.3, y0: 0.34 },
];

const HALF_NAMES = [
  ['PRIMERA QUINCENA', 'último día → 14', '#8f9bff'],
  ['SEGUNDA QUINCENA', '15 → penúltimo', '#e08cff'],
] as const;

/** Camera per scene: azimuth, elevation, distance, aperture. */
const CAMERA = [
  { az: 0.7, el: 0.36, d: 3.0, ap: 0.3 },
  { az: 0.3, el: 0.44, d: 3.9, ap: 0.25 },
  { az: 0.0, el: 0.52, d: 4.0, ap: 0.18 },
  { az: -0.14, el: 0.3, d: 4.0, ap: 0.22 },
  { az: 0.2, el: 0.36, d: 4.2, ap: 0.22 },
  { az: 0.0, el: 0.15, d: 5.6, ap: 0.16 },
];

/** Brand mark strokes (viewBox 0 0 100 100), sampled for the last scene. */
const LOGO_SEGMENTS = [
  [10, 44, 50, 12],
  [50, 12, 90, 44],
  [22, 90, 22, 56],
  [22, 56, 50, 78],
  [50, 78, 78, 56],
  [78, 56, 78, 90],
];
const LOGO_SCALE = 0.023;

const VERTEX_SHADER = `
precision highp float;
attribute vec3 aRing;
attribute vec3 aNeb;
attribute vec4 aLogo;
attribute vec4 aP;
attribute vec4 aQ;
uniform mat4 uVP;
uniform float uTime, uForm, uSplit, uRain, uBills, uLogo, uShock, uFlow;
uniform float uPx, uShift, uFocus, uAper, uAspect, uGain, uMaxPt;
uniform vec2 uMouse;
varying vec3 vCol;
varying float vBlur;
float ss(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main() {
  float rnd = aP.x; float d1 = aP.y; float d2 = aP.z; float sz = aP.w;
  float side = aQ.x; float tower = aQ.y; float bdel = aQ.z; float kind = aQ.w;
  vec3 pos; vec3 col; float alpha = 1.0; float dof = 1.0; float szMul = 1.0;
  float halo = step(0.93, fract(rnd * 17.31)) * (1.0 - step(1.5, kind));
  if (kind > 1.5) {
    pos = aRing + 0.12 * vec3(sin(uTime * 0.21 + rnd * 50.0), cos(uTime * 0.17 + rnd * 31.0), sin(uTime * 0.19 + rnd * 77.0));
    col = mix(vec3(0.55, 0.65, 1.0), vec3(1.0, 0.95, 1.0), rnd);
    alpha = 0.4 + 0.3 * sin(uTime * (0.5 + rnd) + rnd * 90.0);
    dof = bdel;
  } else {
    vec3 nb = aNeb;
    float rr0 = length(nb.xz);
    float a0 = atan(nb.z, nb.x) - rr0 * 2.3;
    float rr = 0.12 + mod(rr0 - 0.12 + uFlow * (0.06 + 0.07 * rnd), 2.7);
    float an = a0 + rr * 2.3 + uTime * 0.14 + 0.35 * sin(uTime * 0.23 + rr * 1.6);
    nb.xz = rr * vec2(cos(an), sin(an));
    nb.y += 0.11 * sin(uTime * 0.9 + rnd * 40.0 + rr * 3.0) + 0.05 * rr * sin(an * 2.0 + uTime * 0.6);
    float wv = (rr - mod(uTime * 0.55, 4.4)) * 2.4;
    float nebA = smoothstep(0.12, 0.24, rr) * (1.0 - smoothstep(2.3, 2.82, rr)) * (1.0 + 1.5 * exp(-wv * wv));
    vec3 rg = aRing;
    rg.y += 0.008 * sin(uTime * 1.3 + rnd * 60.0);
    float bl = ss(uBills * 1.5 - bdel * 0.5) * step(0.0001, tower);
    rg.y += tower * bl;
    float sh = uShock * exp(-abs(aRing.x) * 5.0);
    rg.x += side * sh * 0.2;
    rg.y += sh * 0.22 * rnd;
    float g = side * 0.16 * uSplit;
    float cg = cos(g); float sg = sin(g);
    rg.xz = vec2(rg.x * cg - rg.z * sg, rg.x * sg + rg.z * cg);
    rg.x += side * 0.52 * uSplit;
    float f = ss(uForm * 1.7 - d1 * 0.7);
    vec3 sideCol = mix(vec3(0.36, 0.46, 1.0), vec3(0.86, 0.36, 1.0), step(0.0, side));
    vec3 wholeCol = mix(vec3(0.62, 0.72, 1.0), vec3(0.92, 0.72, 1.0), smoothstep(-0.9, 0.9, aRing.x));
    vec3 halfCol = mix(wholeCol, sideCol, uSplit);
    float rl = length(aRing.xz);
    float rim = (1.0 - smoothstep(0.0, 0.006, abs(rl - 1.0))) + (1.0 - smoothstep(0.0, 0.006, abs(rl - 0.56)));
    halfCol *= 1.0 + 1.1 * rim;
    vec3 nebCol = mix(vec3(0.28, 0.36, 1.0), vec3(0.72, 0.32, 1.0), ss(rnd * 1.4));
    nebCol = mix(nebCol, vec3(1.0, 0.42, 0.6), step(0.88, rnd));
    nebCol = mix(nebCol, vec3(1.0, 0.9, 1.0), 0.75 * exp(-rr * 2.2)) * 1.3;
    if (kind < 0.5) {
      pos = mix(nb, rg, f);
      col = mix(nebCol, halfCol * (1.0 + 0.35 * uRain), f);
      alpha = mix(nebA, 1.0, f);
    } else {
      float fr = clamp((uRain * 1.7 - d2) / 0.7, 0.0, 1.0);
      vec3 sky = rg + vec3(0.0, 2.2 + rnd * 1.8, 0.0);
      vec3 rp = mix(sky, rg, fr * fr);
      pos = mix(nb, rp, f);
      float landed = clamp((uRain * 1.7 - d2 - 0.7) / 0.5, 0.0, 1.0);
      vec3 rc = mix(vec3(0.16, 0.95, 0.62) * 2.4, halfCol * 1.3, landed);
      col = mix(nebCol, rc, f);
      szMul = 1.0 + 1.5 * step(0.001, fr) * (1.0 - landed) * f;
      alpha = mix(nebA, smoothstep(0.0, 0.08, fr), f);
    }
    col = mix(col, vec3(1.0, 0.74, 0.32) * 1.25, bl);
    float tr = sin(3.14159 * f);
    pos += tr * 0.3 * vec3(sin(rnd * 91.0 + uTime), cos(rnd * 57.0 + uTime * 1.3), sin(rnd * 23.0 - uTime));
    float fl = ss(uLogo * 1.7 - d2 * 0.7);
    vec3 lg = aLogo.xyz;
    float dust = step(0.5, aLogo.w);
    float a2 = uTime * 0.1 * dust;
    float c2 = cos(a2); float s2 = sin(a2);
    lg.xz = vec2(lg.x * c2 - lg.z * s2, lg.x * s2 + lg.z * c2);
    vec3 markCol = mix(vec3(0.20, 0.42, 1.0), vec3(0.62, 0.28, 0.95), clamp((aLogo.x - aLogo.y) * 0.3 + 0.5, 0.0, 1.0)) * 1.35;
    vec3 lgCol = mix(markCol, sideCol * 0.9, dust);
    float tl = sin(3.14159 * fl);
    pos = mix(pos, lg, fl) + tl * 0.45 * vec3(sin(rnd * 33.0 + uTime * 1.1), cos(rnd * 71.0 + uTime), sin(rnd * 13.0 + uTime * 0.7));
    col = mix(col, lgCol, fl);
    alpha *= mix(1.0, mix(1.05, 0.5, dust), fl);
    alpha *= 0.72 + 0.28 * sin(uTime * 2.1 + rnd * 120.0);
  }
  vec4 clip = uVP * vec4(pos, 1.0);
  float depth = max(clip.w, 0.0001);
  vec2 ndc = clip.xy / depth;
  vec2 dm = ndc - uMouse;
  dm.x *= uAspect;
  float md2 = dot(dm, dm);
  float nearM = exp(-md2 * 26.0);
  vec2 dirM = dm / (sqrt(md2) + 0.0001);
  dirM.x /= uAspect;
  clip.xy += dirM * nearM * 0.05 * depth;
  clip.y += uShift * depth;
  gl_Position = clip;
  float coc = abs(depth - uFocus) * uAper * dof;
  float sharp = uPx * (0.7 + 1.5 * sz) * szMul * mix(1.0, 7.0, halo) / depth;
  float size = min(sharp * (1.0 + coc), uMaxPt);
  float fade = smoothstep(0.05, 0.35, depth);
  float en = 1.0 / ((1.0 + coc) * (1.0 + coc));
  vCol = col * alpha * en * fade * uGain * (1.0 + 1.6 * nearM) * (0.55 + 0.45 * sz) * mix(1.0, 0.07, halo);
  vBlur = clamp(coc * 0.9, 0.0, 1.0) * (1.0 - halo);
  gl_PointSize = max(size, 1.6);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vCol;
varying float vBlur;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float core = exp(-d * d * 20.0);
  float disc = smoothstep(0.5, 0.42, d) * (0.5 + 0.5 * smoothstep(0.1, 0.46, d));
  float a = mix(core, disc * 0.8, vBlur) * smoothstep(0.5, 0.45, d);
  vec3 c = vCol * a;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}
`;

const UNIFORM_NAMES = [
  'uVP',
  'uTime',
  'uForm',
  'uSplit',
  'uRain',
  'uBills',
  'uLogo',
  'uShock',
  'uPx',
  'uShift',
  'uFocus',
  'uAper',
  'uAspect',
  'uGain',
  'uMaxPt',
  'uMouse',
  'uFlow',
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const smoother = (x: number) => {
  const c = clamp01(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
};
/** Dial angle of day position `u` (0 to 30). Day 0 sits at the far side. */
const dialAngle = (u: number) => -Math.PI / 2 - (u / 30) * TAU;
const gauss = () =>
  (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.7;

const perspective = (fovy: number, aspect: number, near: number, far: number) => {
  const t = 1 / Math.tan(fovy / 2);
  return [
    t / aspect, 0, 0, 0,
    0, t, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
};

const lookAt = (eye: number[], center: number[]) => {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  const zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
  zx /= zl;
  zy /= zl;
  zz /= zl;
  let xx = zz;
  const xy = 0;
  let xz = -zx;
  const xl = Math.sqrt(xx * xx + xz * xz) || 1;
  xx /= xl;
  xz /= xl;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ];
};

const multiply = (a: number[], b: number[]) => {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/** Icon tile for an expense tag, drawn on a 14-unit grid. */
const drawIcon = (
  ctx: CanvasRenderingContext2D,
  icon: LandingIcon,
  color: string,
  x: number,
  y: number,
  size: number,
  alpha: number,
) => {
  const k = (size * 0.62) / 14;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha * 0.26;
  ctx.fillStyle = color;
  ctx.beginPath();
  roundRect(ctx, x, y, size, size, size * 0.28);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.translate(x + size / 2 - 7 * k, y + size / 2 - 7 * k);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (icon === 'house') {
    ctx.moveTo(1, 7); ctx.lineTo(7, 1.8); ctx.lineTo(13, 7);
    ctx.moveTo(3, 6.6); ctx.lineTo(3, 12.2); ctx.lineTo(11, 12.2); ctx.lineTo(11, 6.6);
  } else if (icon === 'cart') {
    ctx.moveTo(0.8, 2); ctx.lineTo(3, 2); ctx.lineTo(4.8, 9); ctx.lineTo(11, 9); ctx.lineTo(12.6, 4.2); ctx.lineTo(3.6, 4.2);
    ctx.moveTo(6.4, 11.8); ctx.arc(5.6, 11.8, 0.8, 0, 6.3);
    ctx.moveTo(11.2, 11.8); ctx.arc(10.4, 11.8, 0.8, 0, 6.3);
  } else if (icon === 'wifi') {
    ctx.arc(7, 11.5, 8.6, -2.36, -0.78);
    ctx.moveTo(7 + 5.4 * Math.cos(-2.36), 11.5 + 5.4 * Math.sin(-2.36)); ctx.arc(7, 11.5, 5.4, -2.36, -0.78);
    ctx.moveTo(7 + 2.4 * Math.cos(-2.36), 11.5 + 2.4 * Math.sin(-2.36)); ctx.arc(7, 11.5, 2.4, -2.36, -0.78);
  } else if (icon === 'card') {
    roundRect(ctx, 1, 3, 12, 8.4, 1.6);
    ctx.moveTo(1, 6.2); ctx.lineTo(13, 6.2);
    ctx.moveTo(3.4, 9); ctx.lineTo(6, 9);
  } else if (icon === 'bolt') {
    ctx.moveTo(8.2, 1); ctx.lineTo(3, 8); ctx.lineTo(6.8, 8); ctx.lineTo(5.8, 13); ctx.lineTo(11, 6); ctx.lineTo(7.2, 6); ctx.closePath();
  } else if (icon === 'bank') {
    ctx.moveTo(1, 5); ctx.lineTo(7, 1.6); ctx.lineTo(13, 5); ctx.closePath();
    ctx.moveTo(3, 6.8); ctx.lineTo(3, 10.6); ctx.moveTo(7, 6.8); ctx.lineTo(7, 10.6); ctx.moveTo(11, 6.8); ctx.lineTo(11, 10.6);
    ctx.moveTo(1, 12.6); ctx.lineTo(13, 12.6);
  } else if (icon === 'cap') {
    ctx.moveTo(0.8, 5.2); ctx.lineTo(7, 2.2); ctx.lineTo(13.2, 5.2); ctx.lineTo(7, 8.2); ctx.closePath();
    ctx.moveTo(3.4, 6.8); ctx.lineTo(3.4, 10); ctx.lineTo(7, 11.8); ctx.lineTo(10.6, 10); ctx.lineTo(10.6, 6.8);
  } else {
    ctx.arc(7, 7, 5.8, 0, 6.3);
    ctx.moveTo(7, 3.6); ctx.lineTo(7, 10.4);
    ctx.moveTo(9, 5.4); ctx.quadraticCurveTo(5, 4.2, 5.2, 6.2); ctx.quadraticCurveTo(5.4, 7.2, 7, 7.2); ctx.quadraticCurveTo(9, 7.4, 8.8, 8.6); ctx.quadraticCurveTo(8.4, 9.8, 5, 8.8);
  }
  ctx.stroke();
  ctx.restore();
};

/**
 * Particle buffer. Per particle: aRing (dial position), aNeb (storm position),
 * aLogo (mark or platform position + flag), aP (random, form delay, rain/logo
 * delay, size), aQ (side, tower height, bill delay, kind 0 ring / 1 rain / 2 star).
 */
const buildParticles = (count: number, stars: number) => {
  const logoLengths: number[] = [];
  let logoTotal = 0;
  for (const s of LOGO_SEGMENTS) {
    const length = Math.hypot(s[2] - s[0], s[3] - s[1]);
    logoLengths.push(length);
    logoTotal += length;
  }
  const logoPoint = () => {
    let pick = Math.random() * logoTotal;
    let si = 0;
    while (si < LOGO_SEGMENTS.length - 1 && pick > logoLengths[si]) {
      pick -= logoLengths[si];
      si++;
    }
    const s = LOGO_SEGMENTS[si];
    const tt = Math.random();
    let x = s[0] + (s[2] - s[0]) * tt;
    let y = s[1] + (s[3] - s[1]) * tt;
    if (Math.random() < 0.3) {
      const nx = -(s[3] - s[1]) / logoLengths[si];
      const ny = (s[2] - s[0]) / logoLengths[si];
      const sign = Math.random() < 0.5 ? -8 : 8;
      x += nx * sign;
      y += ny * sign;
    } else {
      const radius = 8 * Math.sqrt(Math.random());
      const angle = Math.random() * TAU;
      x += radius * Math.cos(angle);
      y += radius * Math.sin(angle);
    }
    return [(x - 50) * LOGO_SCALE, -(y - 51) * LOGO_SCALE + 0.1, (Math.random() - 0.5) * 0.06];
  };

  const data = new Float32Array((count + stars) * STRIDE);
  let o = 0;
  let made = 0;
  let guard = 0;
  while (made < count && guard < count * 4) {
    guard++;
    const isRain = made >= count * 0.74;
    const cls = isRain ? 1 : Math.random();
    let u = Math.random() * 30;
    const k = Math.floor(u);
    let fr = u - k;
    let r: number;
    let y = 0;
    if (cls < 0.08) {
      // Dividers between days.
      fr = Math.random() < 0.5 ? 0.1 : 0.9;
      u = k + fr;
      r = 0.56 + 0.44 * Math.random();
    } else if (cls < 0.11) {
      // Outer orbit.
      r = 1.2;
    } else {
      // 20% gap between day blocks.
      if (fr < 0.1 || fr > 0.9) continue;
      if (cls < 0.23) r = 1.0;
      else if (cls < 0.3) r = 0.56;
      else {
        r = Math.sqrt(0.3136 + 0.6864 * Math.random());
        y = (Math.random() - 0.5) * 0.02;
      }
    }
    const a = dialAngle(u);
    const side = k < 15 ? -1 : 1;
    const bill = r <= 1.001 ? BILL_AT.get(k)?.bill : undefined;
    const rnd0 = Math.random();
    const group = isRain ? 8 : 1;
    for (let gi = 0; gi < group && made < count; gi++) {
      let rx = r * Math.cos(a);
      let rz = r * Math.sin(a);
      if (isRain) {
        rx += (Math.random() - 0.5) * 0.03;
        rz += (Math.random() - 0.5) * 0.03;
      }
      const tower = bill ? (Math.random() < 0.22 ? bill.h : bill.h * Math.random()) : 0;
      const rho = 0.12 + 2.7 * Math.pow(Math.random(), 1.15);
      const arm = Math.floor(Math.random() * 3);
      const th =
        Math.random() < 0.78 ? (arm * TAU) / 3 + rho * 2.3 + gauss() * 0.5 : Math.random() * TAU;
      const thick = Math.max(0.05, 0.2 - 0.05 * rho);
      const dust = Math.random() < 0.38;
      let lx: number;
      let ly: number;
      let lz: number;
      if (dust) {
        lx = rx * 1.55;
        ly = -1.1 + y;
        lz = rz * 1.55;
      } else {
        const lp = logoPoint();
        lx = lp[0];
        ly = lp[1];
        lz = lp[2];
      }
      data[o++] = rx; data[o++] = y; data[o++] = rz;
      data[o++] = rho * Math.cos(th); data[o++] = gauss() * thick; data[o++] = rho * Math.sin(th);
      data[o++] = lx; data[o++] = ly; data[o++] = lz; data[o++] = dust ? 1 : 0;
      data[o++] = Math.random();
      data[o++] = (u / 30) * 0.72 + Math.random() * 0.28;
      data[o++] = isRain ? rnd0 * 0.93 + gi * 0.008 : Math.random();
      data[o++] = Math.random();
      data[o++] = side; data[o++] = tower; data[o++] = bill ? bill.delay : 0; data[o++] = isRain ? 1 : 0;
      made++;
    }
  }
  for (let i = 0; i < stars; i++) {
    const near = Math.random() < 0.3;
    const radius = near ? 2.2 + Math.random() * 3.6 : 9 + Math.random() * 10;
    const zz = Math.random() * 2 - 1;
    const ph = Math.random() * TAU;
    const rr = Math.sqrt(1 - zz * zz);
    data[o++] = rr * Math.cos(ph) * radius; data[o++] = zz * radius * (near ? 0.6 : 1); data[o++] = rr * Math.sin(ph) * radius;
    data[o++] = 0; data[o++] = 0; data[o++] = 0;
    data[o++] = 0; data[o++] = 0; data[o++] = 0; data[o++] = 0;
    data[o++] = Math.random(); data[o++] = 0; data[o++] = 0; data[o++] = Math.random();
    data[o++] = 0; data[o++] = 0; data[o++] = near ? 1 : 0; data[o++] = 2;
  }
  return { data, vertices: made + stars };
};

type GlProgram = {
  gl: WebGLRenderingContext;
  uniforms: Record<UniformName, WebGLUniformLocation | null>;
  maxPoint: number;
  dispose: () => void;
};

const createProgram = (canvas: HTMLCanvasElement, data: Float32Array): GlProgram | null => {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const context = gl;

  const compile = (type: number, source: string) => {
    const shader = context.createShader(type);
    if (!shader) return null;
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      context.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertex = compile(context.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(context.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = context.createProgram();
  if (!vertex || !fragment || !program) return null;
  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) return null;
  context.useProgram(program);

  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, data, context.STATIC_DRAW);
  const attributes: [string, number, number][] = [
    ['aRing', 3, 0],
    ['aNeb', 3, 12],
    ['aLogo', 4, 24],
    ['aP', 4, 40],
    ['aQ', 4, 56],
  ];
  for (const [name, size, offset] of attributes) {
    const location = context.getAttribLocation(program, name);
    if (location >= 0) {
      context.enableVertexAttribArray(location);
      context.vertexAttribPointer(location, size, context.FLOAT, false, STRIDE * 4, offset);
    }
  }

  const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
  for (const name of UNIFORM_NAMES) uniforms[name] = context.getUniformLocation(program, name);

  context.disable(context.DEPTH_TEST);
  context.enable(context.BLEND);
  context.blendFunc(context.ONE, context.ONE);
  context.clearColor(0, 0, 0, 0);
  const range = context.getParameter(context.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;

  return {
    gl: context,
    uniforms,
    maxPoint: range && range[1] ? range[1] : 64,
    dispose: () => {
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
      context.deleteShader(vertex);
      context.deleteShader(fragment);
    },
  };
};

type Tag = {
  index: number;
  bill: Bill;
  x: number;
  y: number;
  lift: number;
  visible: number;
  amountAlpha: number;
  fontSize: number;
  amountFontSize: number;
  icon: number;
  textWidth: number;
  chipWidth: number;
  chipHeight: number;
  chipTop: number;
  nameY: number;
};

/** Returns null when WebGL is not available. */
export const createHeroEngine = (options: HeroEngineOptions): HeroEngine | null => {
  const { glCanvas, labelCanvas, textEl, railEl, reduced } = options;
  const ctx = labelCanvas.getContext('2d');
  if (!ctx) return null;

  const small = (glCanvas.clientWidth || window.innerWidth || 1200) < 700;
  const { data, vertices } = buildParticles(small ? 26_000 : 64_000, small ? 1_400 : 3_000);
  const program = createProgram(glCanvas, data);
  if (!program) return null;
  const { gl, uniforms } = program;

  const style = getComputedStyle(glCanvas);
  const fontMono = style.getPropertyValue('--mc-mono').trim() || 'ui-monospace, monospace';
  const fontDisplay = style.getPropertyValue('--mc-display').trim() || 'system-ui, sans-serif';
  const fontSans = style.getPropertyValue('--mc-sans').trim() || 'system-ui, sans-serif';

  let dead = false;
  let raf = 0;
  let onScreen = true;
  /** Reduced motion draws a few frames after each change, then stops. */
  let settle = 40;

  let playing = !reduced;
  let target = reduced ? STILL_SCENE : 0;
  let progress = target;
  let wrap = false;
  let arrive = 0;
  let userHold = 0;
  let scroll: number | null = null;

  let pointerX = 0;
  let pointerY = 0;
  let pointerIn = false;
  let swayX = 0;
  let swayY = 0;
  let drift = 0;
  let flow = 0;
  let autoDistance = 4.2;

  /** Adaptive quality: the pixel ratio cap drops when frames run long. */
  let dprCap = 2;
  let frameMs = 16;
  let sampled = 0;

  let last = 0;
  let time = 0;
  let frameCount = 0;
  let zoneTop = 300;
  let zoneBottom = 800;
  const matrix = new Float32Array(16);

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const rect = glCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (!w || !h) {
      schedule();
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (glCanvas.width !== pw || glCanvas.height !== ph) {
      glCanvas.width = pw;
      glCanvas.height = ph;
    }
    if (labelCanvas.width !== pw || labelCanvas.height !== ph) {
      labelCanvas.width = pw;
      labelCanvas.height = ph;
    }
    if (!arrive) arrive = now;
    const elapsed = last ? now - last : 16;
    const dt = Math.min(0.05, elapsed / 1000);
    last = now;
    if (!reduced && playing) time += dt;

    // Frames running long: draw fewer pixels first; if even that is not
    // enough for about 15 frames a second, hand over to the still.
    if (!reduced) {
      frameMs += (elapsed - frameMs) * 0.05;
      sampled++;
      if (sampled > 90 && frameMs > 34 && dprCap > 1) {
        dprCap = Math.max(1, dprCap - 0.5);
        sampled = 0;
        frameMs = 16;
      } else if (sampled > 120 && frameMs > 66 && dprCap <= 1) {
        dead = true;
        options.onLost();
        return;
      }
    }
    const t = time;
    const sm = w < 700;

    if (frameCount++ % 20 === 0) {
      zoneTop = textEl.getBoundingClientRect().bottom - rect.top + 6;
      zoneBottom = railEl.getBoundingClientRect().top - rect.top - 10;
      if (zoneBottom - zoneTop < 120) {
        zoneTop = h * 0.36;
        zoneBottom = h * 0.86;
      }
    }

    /* ---- Scene progress: P in [0, 6). ---- */
    let P = progress;
    let moving = false;
    if (reduced) {
      P = scroll ?? target;
      wrap = false;
    } else if (scroll !== null) {
      // Follow the scroll, but never faster than four times the scene's own
      // pace, so the rain and the towers still play when scrubbed fast.
      const diff = scroll - P;
      const distance = Math.abs(diff);
      if (distance > 0.0004) {
        moving = true;
        const dir = diff > 0 ? 1 : -1;
        let segment = dir > 0 ? Math.floor(P) : Math.ceil(P) - 1;
        segment = Math.max(0, Math.min(SCENE_COUNT - 2, segment));
        const limit = (dt / SEG[segment]) * Math.max(1.5, Math.min(4, distance * 4));
        P += dir * Math.min(distance, Math.max(distance * Math.min(1, dt * 12), 0.0004), limit);
      } else {
        P = scroll;
      }
      wrap = false;
      target = Math.max(0, Math.min(SCENE_COUNT - 1, Math.round(P)));
      arrive = now;
    } else if (wrap || P !== target) {
      moving = true;
      const dir = wrap ? 1 : target > P ? 1 : -1;
      let segment = dir > 0 ? Math.floor(P) : Math.ceil(P) - 1;
      segment = ((segment % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT;
      const remain = wrap ? SCENE_COUNT - P : Math.abs(target - P);
      P += dir * (1 / SEG[segment]) * Math.max(1, Math.min(3.5, remain)) * dt;
      if (wrap) {
        if (P >= SCENE_COUNT) {
          P = 0;
          wrap = false;
          arrive = now;
        }
      } else if ((dir > 0 && P >= target) || (dir < 0 && P <= target)) {
        P = target;
        arrive = now;
      }
    } else if (playing && now - arrive > HOLD[target] * 1000 && now > userHold) {
      const next = (target + 1) % SCENE_COUNT;
      wrap = next === 0;
      target = next;
      options.onScene(next);
    }
    progress = P;
    // The slow push-in while a scene rests. It holds still while paused.
    if (playing || moving) drift += ((moving ? 0 : 1) - drift) * Math.min(1, dt * 0.35);

    const back = P >= 5 ? 1 - smooth((P - 5) / 0.2) : 1;
    const form = P < 1 ? P : back;
    const split = P < 1 ? 0 : P < 2 ? 1 - Math.pow(1 - clamp01((P - 1.18) / 0.82), 3) : back;
    const rain = P < 2 ? 0 : P < 3 ? P - 2 : back;
    const bills = P < 3 ? 0 : P < 4 ? P - 3 : back;
    const logo = P < 4 ? 0 : P < 5 ? P - 4 : 1 - smooth((P - 5.15) / 0.85);
    const shock = P > 1 && P < 2 ? Math.exp(-Math.pow((P - 1.2) / 0.13, 2)) : 0;

    /* ---- Camera. ---- */
    const i0 = Math.floor(P) % SCENE_COUNT;
    const i1 = (i0 + 1) % SCENE_COUNT;
    const e = smoother(P - Math.floor(P));
    const from = CAMERA[i0];
    const to = CAMERA[i1];
    swayX += ((pointerIn ? pointerX : 0) - swayX) * 0.05;
    swayY += ((pointerIn ? pointerY : 0) - swayY) * 0.05;
    const aspect = w / h;
    const az =
      from.az +
      (to.az - from.az) * e +
      Math.sin(t * 0.13) * 0.09 +
      swayX * 0.2 +
      shock * 0.03 * Math.sin(t * 40) +
      0.24 * Math.sin(t * 0.11) * (1 - smooth(form * 1.4));
    const el = from.el + (to.el - from.el) * e + Math.sin(t * 0.17) * 0.02 - swayY * 0.06;
    const aperture = from.ap + (to.ap - from.ap) * e;
    const projection = perspective(0.6283, aspect, 0.05, 80);
    const cameraAt = (distance: number) =>
      multiply(
        projection,
        lookAt(
          [
            distance * Math.sin(az) * Math.cos(el),
            distance * Math.sin(el),
            distance * Math.cos(az) * Math.cos(el),
          ],
          [0, 0, 0],
        ),
      );
    const dialPoint = (u: number, r: number, y: number) => {
      const a = dialAngle(u);
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      const sd = u < 15 ? -1 : 1;
      const g = sd * 0.16 * split;
      const cg = Math.cos(g);
      const sg = Math.sin(g);
      return [x * cg - z * sg + sd * 0.52 * split, y, x * sg + z * cg];
    };

    const mixF = smooth(form * 1.7 - 0.5);
    const rise: number[] = [];
    const spent = [0, 0];
    for (const bill of BILLS) {
      const value = smooth(bills * 1.5 - bill.delay * 0.5);
      rise.push(value);
      spent[bill.day < 15 ? 0 : 1] += bill.amount * value;
    }
    const landed = clamp01(rain * 1.7 - 0.7);
    const splitLabels = smooth(split * 1.6 - 0.4);

    /* ---- Auto-framing: fit the scene between the headline and the bar. ---- */
    const framing = cameraAt(autoDistance);
    const bounds = (points: number[][]) => {
      const box = { t: 1e9, b: -1e9, l: 1e9, r: -1e9 };
      for (const p of points) {
        const cw = framing[3] * p[0] + framing[7] * p[1] + framing[11] * p[2] + framing[15];
        if (cw < 0.08) continue;
        const px =
          (((framing[0] * p[0] + framing[4] * p[1] + framing[8] * p[2] + framing[12]) / cw) * 0.5 + 0.5) * w;
        const py =
          (1 - (((framing[1] * p[0] + framing[5] * p[1] + framing[9] * p[2] + framing[13]) / cw) * 0.5 + 0.5)) * h;
        if (py - p[3] < box.t) box.t = py - p[3];
        if (py + p[4] > box.b) box.b = py + p[4];
        if (px - p[5] < box.l) box.l = px - p[5];
        if (px + p[5] > box.r) box.r = px + p[5];
      }
      return box;
    };
    const offset = 0.52 * split;
    // Side room kept for labels, in px. Phones keep less: their tags stack
    // and are held inside the screen, so the dial can be drawn larger.
    const sideRoom = sm ? 10 : 16;
    const nameRoom = sm ? 46 : 70;
    const tagRoom = sm ? 38 : 62;
    const dialPoints = [
      [-(1.36 + offset), 0, 0, 0, 0, sideRoom],
      [1.36 + offset, 0, 0, 0, 0, sideRoom],
      [-offset, 0, -1.36, 18, 0, 0],
      [offset, 0, -1.36, 18, 0, 0],
      [-offset, 0, 1.36, 0, 14 * (1 - splitLabels), 0],
      [offset, 0, 1.36, 0, 14 * (1 - splitLabels), 0],
      [-(offset + 0.5), 0, 1.12, 0, splitLabels * (sm ? 34 : 60), nameRoom],
      [offset + 0.5, 0, 1.12, 0, splitLabels * (sm ? 34 : 60), nameRoom],
    ];
    BILLS.forEach((bill, index) => {
      const top = dialPoint(bill.day + 0.5, bill.labelRadius, 0.07 + bill.h * rise[index]);
      dialPoints.push([top[0], top[1], top[2], 30 + 20 * rise[index], 0, tagRoom]);
    });
    const markPoints = [
      [-1.15, 0.1, 0, 0, 0, 0],
      [1.15, 0.1, 0, 0, 0, 0],
      [0, 1.2, 0, 14, 0, 0],
      [0, -1.1, 1.88, 0, 12, 0],
      [-1.88, -1.1, 0, 0, 0, 8],
      [1.88, -1.1, 0, 0, 0, 8],
    ];
    const dialBox = bounds(dialPoints);
    const markBox = bounds(markPoints);
    const markWeight = smooth(logo * 1.6 - 0.2);
    const boxTop = dialBox.t + (markBox.t - dialBox.t) * markWeight;
    const boxBottom = dialBox.b + (markBox.b - dialBox.b) * markWeight;
    const boxWidth =
      dialBox.r - dialBox.l + (markBox.r - markBox.l - (dialBox.r - dialBox.l)) * markWeight;
    const zt = zoneTop + 4;
    const zb = zoneBottom - 4;
    const ratio = Math.max((boxBottom - boxTop) / (zb - zt), boxWidth / (w * 0.94));
    if (ratio > 0.2 && ratio < 5) {
      const want = Math.max(2.2, Math.min(40, autoDistance * ratio));
      autoDistance += (want - autoDistance) * Math.min(1, dt * (frameCount < 12 ? 30 : 4));
    }
    const shiftAuto = (2 * ((boxTop + boxBottom) / 2 - (zt + zb) / 2)) / h;
    const shiftStorm = (1 - (zt + zb) / h) * 0.8;
    const formed = smooth(form * 1.4);
    const stormDistance = CAMERA[0].d * Math.max(1, 1.45 / aspect);
    const distance = stormDistance + (autoDistance - stormDistance) * formed - 0.18 * shock - 0.1 * drift;
    const shift = shiftStorm + (shiftAuto - shiftStorm) * formed;
    const VP = cameraAt(distance);

    /* ---- Particles. ---- */
    gl.viewport(0, 0, pw, ph);
    gl.clear(gl.COLOR_BUFFER_BIT);
    matrix.set(VP);
    gl.uniformMatrix4fv(uniforms.uVP, false, matrix);
    if (!reduced && playing) flow += dt * (1 - form);
    gl.uniform1f(uniforms.uFlow, flow);
    gl.uniform1f(uniforms.uTime, t);
    gl.uniform1f(uniforms.uForm, form);
    gl.uniform1f(uniforms.uSplit, split);
    gl.uniform1f(uniforms.uRain, rain);
    gl.uniform1f(uniforms.uBills, bills);
    gl.uniform1f(uniforms.uLogo, logo);
    gl.uniform1f(uniforms.uShock, shock);
    gl.uniform1f(uniforms.uPx, 10.5 * dpr * (h / 900) * Math.pow(Math.max(1, distance / 4.2), 0.6));
    gl.uniform1f(uniforms.uShift, shift);
    gl.uniform1f(uniforms.uFocus, distance);
    gl.uniform1f(uniforms.uAper, aperture);
    gl.uniform1f(uniforms.uAspect, aspect);
    gl.uniform1f(uniforms.uGain, 0.5);
    gl.uniform1f(uniforms.uMaxPt, Math.min(program.maxPoint, 80 * dpr));
    if (pointerIn) gl.uniform2f(uniforms.uMouse, pointerX, pointerY - shift);
    else gl.uniform2f(uniforms.uMouse, 9, 9);
    gl.drawArrays(gl.POINTS, 0, vertices);

    /* ---- Labels, projected with the same matrix. ---- */
    const project = (x: number, y: number, z: number) => {
      const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12];
      const cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13];
      const cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (cw < 0.08) return null;
      return [((cx / cw) * 0.5 + 0.5) * w, (1 - ((cy / cw + shift) * 0.5 + 0.5)) * h, cw];
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    const fs = sm ? 10 : 12;
    const mono = `500 ${fs}px ${fontMono}`;
    const big = `800 ${sm ? 20 : 28}px ${fontDisplay}`;
    const gone = 1 - smooth(logo * 2.4);
    const dialAlpha = smooth((form - 0.55) / 0.45) * gone;

    // The blade at the cut.
    if (shock > 0.01) {
      const b1 = project(0, 0.02, -1.22);
      const b2 = project(0, 0.02, 1.22);
      if (b1 && b2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, shock * 1.2);
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#b9a6ff';
        ctx.shadowBlur = 40;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b1[0], b1[1]);
        ctx.lineTo(b2[0], b2[1]);
        ctx.stroke();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.shadowColor = 'rgba(6,9,20,0.95)';
    ctx.shadowBlur = 8;

    // Day ticks and numbers: ÚLT, 1 to 29.
    if (dialAlpha > 0.01) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = dialAlpha * 0.85;
      ctx.beginPath();
      for (let day = 0; day < 30; day++) {
        const inner = dialPoint(day + 0.0001, 0.99, 0);
        const outer = dialPoint(day + 0.0001, 1.085, 0);
        const e1 = project(inner[0], inner[1], inner[2]);
        const e2 = project(outer[0], outer[1], outer[2]);
        if (e1 && e2) {
          ctx.moveTo(e1[0], e1[1]);
          ctx.lineTo(e2[0], e2[1]);
        }
      }
      ctx.stroke();
      ctx.restore();
      for (let day = 0; day < 30; day++) {
        if (sm && day % 5 !== 0 && day !== 14 && day !== 29) continue;
        const entry = BILL_AT.get(day);
        const hot = entry ? rise[entry.index] : 0;
        const at = dialPoint(day + 0.5, 1.135, 0);
        const p = project(at[0], at[1], at[2]);
        if (!p) continue;
        ctx.globalAlpha = dialAlpha * (hot > 0.3 ? 1 : 0.88);
        ctx.font = `${hot > 0.3 ? 700 : 500} ${fs + (hot > 0.3 ? 1 : 0)}px ${fontMono}`;
        ctx.fillStyle = hot > 0.3 ? '#ffc45c' : day < 15 ? '#c3caff' : '#efc6ff';
        ctx.fillText(day === 0 ? 'ÚLT' : String(day), p[0], p[1] + 4);
      }
    }
    const wholeAlpha = dialAlpha * (1 - smooth(split * 3));
    if (wholeAlpha > 0.01) {
      const p = project(0, 0, 1.36);
      if (p) {
        ctx.globalAlpha = wholeAlpha;
        ctx.font = mono;
        ctx.fillStyle = '#c9cee0';
        ctx.fillText('UN MES · 30 DÍAS', p[0], p[1]);
      }
    }

    // Quincena names and the "Libre" counters.
    const halvesAlpha = splitLabels * gone;
    if (halvesAlpha > 0.01) {
      for (let n = 0; n < 2; n++) {
        const sd = n === 0 ? -1 : 1;
        const p = project(sd * (0.52 * split + 0.5), 0, 1.12);
        if (!p) continue;
        ctx.globalAlpha = halvesAlpha;
        ctx.font = mono;
        ctx.fillStyle = HALF_NAMES[n][2];
        ctx.fillText(HALF_NAMES[n][0], p[0], p[1]);
        let y = p[1];
        if (!sm) {
          ctx.fillStyle = '#aab1c9';
          y += fs + 5;
          ctx.fillText(HALF_NAMES[n][1], p[0], y);
        }
        const freeAlpha = halvesAlpha * smooth(landed * 5);
        if (freeAlpha > 0.01) {
          ctx.globalAlpha = freeAlpha;
          ctx.font = big;
          ctx.fillStyle = '#34d399';
          const free = Math.round(PAYCHECK * landed - spent[n]);
          ctx.fillText(`Libre $${free.toLocaleString('es-MX')}`, p[0], y + (sm ? 24 : 34));
        }
      }
    }

    // Expense tags: loose in the storm, then on their day, then on their tower.
    const tags: Tag[] = [];
    BILLS.forEach((bill, index) => {
      const up = rise[index];
      if (sm && mixF > 0.5 && bill.amount < 2400) return;
      const rot = bill.th + t * 0.14 + 0.35 * Math.sin(t * 0.23 + bill.rho * 1.6);
      const sx = bill.rho * Math.cos(rot);
      const sy = bill.y0 + 0.09 * Math.sin(t * 0.9 + index);
      const sz = bill.rho * Math.sin(rot);
      const rp = dialPoint(bill.day + 0.5, bill.labelRadius, 0.07 + bill.h * up);
      const p = project(sx + (rp[0] - sx) * mixF, sy + (rp[1] - sy) * mixF, sz + (rp[2] - sz) * mixF);
      if (!p) return;
      let zone =
        smooth((p[1] - zoneTop - 24) / 36) *
        smooth((zoneBottom - p[1] - 10) / 36) *
        smooth((p[0] - 70) / 70) *
        smooth((w - 70 - p[0]) / 70);
      zone += (1 - zone) * mixF;
      let scale = Math.max(1, Math.min(1.9, 3.6 / p[2]));
      scale += (1 - scale) * mixF;
      const visible = gone * zone * (0.9 + 0.1 * Math.max(1 - mixF, up));
      if (visible < 0.01) return;
      const amountAlpha = Math.max(1 - mixF, up);
      const fontSize = Math.round((fs + 2) * scale);
      ctx.font = `600 ${fontSize}px ${fontSans}`;
      const icon = Math.round(fontSize * 1.7);
      const textWidth = ctx.measureText(bill.name).width;
      const chipWidth = textWidth + icon + 7 + 18;
      const chipHeight = Math.max(
        icon + 10,
        fontSize + 12 + (amountAlpha > LABEL_FADE_MIN ? (fontSize + 3) * amountAlpha : 0),
      );
      // Phones: a tag on its day never leaves the screen.
      const half = chipWidth / 2 + 6;
      const x = sm && w > half * 2 ? p[0] + (Math.max(half, Math.min(w - half, p[0])) - p[0]) * mixF : p[0];
      tags.push({
        index,
        bill,
        x,
        y: p[1],
        lift: 0,
        visible,
        amountAlpha,
        fontSize,
        amountFontSize: Math.round(fs * scale),
        icon,
        textWidth,
        chipWidth,
        chipHeight,
        chipTop: p[1] + 6 - chipHeight,
        nameY: p[1] - (amountAlpha > LABEL_FADE_MIN ? (fontSize + 3) * (mixF > LABEL_MIX_MIN ? amountAlpha : 1) : 0),
      });
    });

    // Phones: stack tags that would overlap, lowest first, each pushed up.
    if (sm && mixF > 0.5) {
      const placed: Tag[] = [];
      for (const tag of [...tags].sort((a, b) => b.y - a.y)) {
        for (let pass = 0; pass < 6; pass++) {
          const hit = placed.find(
            (other) =>
              Math.abs(other.x - tag.x) < (other.chipWidth + tag.chipWidth) / 2 + 4 &&
              tag.chipTop - tag.lift < other.chipTop - other.lift + other.chipHeight + 4 &&
              tag.chipTop - tag.lift + tag.chipHeight + 4 > other.chipTop - other.lift,
          );
          if (!hit) break;
          tag.lift = tag.chipTop + tag.chipHeight + 4 - (hit.chipTop - hit.lift);
        }
        placed.push(tag);
      }
    }

    for (const tag of tags) {
      const { bill } = tag;
      const up = rise[tag.index];
      const lift = tag.lift * mixF;
      const y = tag.y - lift;
      const left = tag.x - (tag.textWidth + tag.icon + 7) / 2;
      if (lift > 6) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = tag.visible * 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tag.x, tag.y);
        ctx.lineTo(tag.x, y + 6);
        ctx.stroke();
        ctx.restore();
      }
      if (mixF > 0.02) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = tag.visible * mixF * 0.78;
        ctx.fillStyle = '#060914';
        ctx.strokeStyle = up > 0.4 ? 'rgba(255,196,92,0.7)' : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        roundRect(ctx, tag.x - tag.chipWidth / 2, tag.chipTop - lift, tag.chipWidth, tag.chipHeight, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      const nameY = tag.nameY - lift;
      drawIcon(
        ctx,
        bill.icon,
        bill.iconColor,
        left,
        (nameY + y) / 2 - tag.fontSize * 0.34 - tag.icon / 2,
        tag.icon,
        tag.visible,
      );
      ctx.globalAlpha = tag.visible;
      ctx.font = `600 ${tag.fontSize}px ${fontSans}`;
      ctx.fillStyle = up > 0.4 ? '#ffc45c' : '#eef0fb';
      ctx.textAlign = 'left';
      ctx.fillText(bill.name, left + tag.icon + 7, nameY);
      if (tag.amountAlpha > LABEL_FADE_MIN) {
        ctx.globalAlpha = tag.visible * tag.amountAlpha;
        ctx.font = `500 ${tag.amountFontSize}px ${fontMono}`;
        ctx.fillStyle = mixF < 0.5 ? '#ff8fb0' : '#f7f8ff';
        ctx.fillText((mixF < 0.5 ? '−' : '') + bill.text, left + tag.icon + 7, y);
      }
      ctx.textAlign = 'center';
    }

    // Storm only: the question and the loose charges.
    if (mixF < 0.98) {
      for (const ask of ASK) {
        const rot = ask.th + t * 0.14 + 0.35 * Math.sin(t * 0.23 + ask.rho * 1.6);
        const p = project(ask.rho * Math.cos(rot), ask.y0, ask.rho * Math.sin(rot));
        if (!p) continue;
        const zone =
          smooth((p[1] - zoneTop - 24) / 36) *
          smooth((zoneBottom - p[1] - 10) / 36) *
          smooth((p[0] - 110) / 70) *
          smooth((w - 110 - p[0]) / 70);
        ctx.globalAlpha = (1 - mixF) * zone * 0.95;
        ctx.font = `700 ${Math.round((fs + 6) * Math.max(1, Math.min(1.8, 3.4 / p[2])))}px ${fontDisplay}`;
        ctx.fillStyle = '#f7f8ff';
        ctx.fillText('¿Cuánto queda?', p[0], p[1]);
      }
      NOISE.forEach((noise, index) => {
        const rot = noise.th + t * 0.14 + 0.35 * Math.sin(t * 0.23 + noise.rho * 1.6);
        const p = project(
          noise.rho * Math.cos(rot),
          noise.y0 + 0.08 * Math.sin(t * 1.1 + index * 2),
          noise.rho * Math.sin(rot),
        );
        if (!p) return;
        const zone =
          smooth((p[1] - zoneTop - 24) / 36) *
          smooth((zoneBottom - p[1] - 10) / 36) *
          smooth((p[0] - 50) / 70) *
          smooth((w - 50 - p[0]) / 70);
        ctx.globalAlpha = (1 - mixF) * zone * 0.7;
        ctx.font = `500 ${Math.round(fs * Math.max(0.9, Math.min(1.6, 3.2 / p[2])))}px ${fontMono}`;
        ctx.fillStyle = '#ff8fb0';
        ctx.fillText(noise.txt, p[0], p[1]);
      });
    }
    ctx.globalAlpha = 1;

    if (reduced) settle--;
    schedule();
  };

  /** One frame is queued only while the hero is on screen and the tab is visible. */
  function schedule() {
    if (raf || dead || !onScreen || document.hidden) return;
    if (reduced && settle <= 0) return;
    raf = requestAnimationFrame(frame);
  }

  const pause = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  /** Reduced motion: redraw after a change. */
  const kick = () => {
    settle = 40;
    frameCount = 0;
    schedule();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
      if (onScreen) kick();
      else pause();
    },
    { rootMargin: '40px' },
  );
  observer.observe(glCanvas);

  const handleVisibility = () => {
    if (document.hidden) pause();
    else kick();
  };
  document.addEventListener('visibilitychange', handleVisibility);

  const resizeObserver = new ResizeObserver(kick);
  resizeObserver.observe(glCanvas);

  const handleLost = (event: Event) => {
    event.preventDefault();
    if (dead) return;
    pause();
    dead = true;
    options.onLost();
  };
  glCanvas.addEventListener('webglcontextlost', handleLost);

  schedule();

  return {
    goTo: (scene) => {
      const now = performance.now();
      wrap = scene === 0 && progress > 5;
      target = scene;
      arrive = now;
      userHold = now + USER_HOLD_MS;
      kick();
    },
    setPlaying: (value) => {
      playing = value && !reduced;
      userHold = 0;
    },
    setScroll: (value) => {
      if (value === null && scroll !== null) {
        target = Math.max(0, Math.min(SCENE_COUNT - 1, Math.round(progress)));
        wrap = false;
        arrive = performance.now();
      }
      scroll = value === null ? null : Math.max(0, Math.min(SCENE_COUNT - 1, value));
      if (reduced) kick();
    },
    setPointer: (x, y, inside) => {
      pointerX = x;
      pointerY = y;
      pointerIn = inside;
    },
    destroy: () => {
      pause();
      dead = true;
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      glCanvas.removeEventListener('webglcontextlost', handleLost);
      program.dispose();
    },
  };
};
