/**
 * Liverpool PDF statements use Type3 fonts with obfuscated /Encoding Differences maps.
 * Text extraction via unpdf extractText fails; we decode originalCharCode bytes instead.
 *
 * Encoding map from Liverpool statement PDF Type3 font /Encoding Differences.
 */
export const LIVERPOOL_FONT_ENCODING_MAP: Readonly<Record<number, number>> = {
  11: 133, 31: 30, 32: 31, 33: 128, 34: 129, 35: 127, 36: 131, 37: 132, 39: 134,
  40: 135, 41: 136, 42: 137, 43: 138, 44: 139, 45: 140, 46: 184, 47: 142, 48: 143,
  49: 144, 50: 145, 51: 146, 52: 147, 53: 148, 54: 183, 55: 150, 56: 151, 57: 152,
  58: 153, 59: 154, 60: 155, 61: 156, 62: 157, 63: 158, 64: 159, 65: 32, 66: 141,
  67: 226, 68: 228, 69: 224, 70: 225, 71: 227, 72: 229, 73: 231, 74: 241, 75: 162,
  76: 46, 77: 60, 78: 40, 79: 43, 80: 124, 81: 38, 82: 233, 83: 234, 84: 235, 85: 232,
  86: 237, 87: 238, 88: 239, 89: 236, 90: 223, 91: 33, 92: 36, 93: 42, 94: 41, 95: 59,
  96: 172, 97: 45, 98: 47, 99: 194, 100: 196, 101: 192, 102: 193, 103: 195, 104: 197,
  105: 199, 106: 209, 107: 166, 108: 44, 109: 37, 110: 95, 111: 62, 112: 63, 113: 160,
  114: 201, 115: 202, 116: 203, 117: 200, 118: 205, 119: 206, 120: 207, 121: 204,
  122: 96, 123: 58, 124: 35, 125: 64, 126: 39, 127: 61, 128: 34, 129: 216, 130: 97,
  131: 98, 132: 99, 133: 100, 134: 101, 135: 102, 136: 103, 137: 104, 138: 105, 139: 171,
  140: 187, 141: 240, 142: 253, 143: 222, 144: 177, 145: 176, 146: 106, 147: 107,
  148: 108, 149: 109, 150: 110, 151: 111, 152: 112, 153: 113, 154: 114, 155: 170,
  156: 186, 157: 230, 158: 130, 159: 198, 160: 164, 161: 181, 162: 126, 163: 115,
  164: 116, 165: 117, 166: 118, 167: 119, 168: 120, 169: 121, 170: 122, 171: 161,
  172: 191, 173: 208, 174: 221, 175: 254, 176: 174, 177: 94, 178: 163, 179: 165,
  180: 149, 181: 169, 182: 167, 183: 182, 184: 188, 185: 189, 186: 190, 187: 91,
  188: 93, 189: 173, 190: 168, 191: 180, 192: 215, 193: 123, 194: 65, 195: 66,
  196: 67, 197: 68, 198: 69, 199: 70, 200: 71, 201: 72, 202: 73, 203: 175, 204: 244,
  205: 246, 206: 242, 207: 243, 208: 245, 209: 125, 210: 74, 211: 75, 212: 76,
  213: 77, 214: 78, 215: 79, 216: 80, 217: 81, 218: 82, 219: 185, 220: 251, 221: 252,
  222: 249, 223: 250, 224: 255, 225: 92, 226: 247, 227: 83, 228: 84, 229: 85, 230: 86,
  231: 87, 232: 88, 233: 89, 234: 90, 235: 178, 236: 212, 237: 214, 238: 210, 239: 211,
  240: 213, 241: 48, 242: 49, 243: 50, 244: 51, 245: 52, 246: 53, 247: 54, 248: 55,
  249: 56, 250: 57, 251: 179, 252: 219, 253: 220, 254: 217, 255: 218, 256: 248,
};

export const decodeLiverpoolPdfChar = (
  code: number,
  emap: Readonly<Record<number, number>> = LIVERPOOL_FONT_ENCODING_MAP,
): string => {
  if (code === 64) return ' ';
  const glyph = emap[code];
  if (glyph !== undefined) {
    if (glyph >= 48 && glyph <= 57) return String.fromCharCode(glyph);
    if (glyph === 45) return '-';
    if (glyph >= 65 && glyph <= 90) return String.fromCharCode(glyph + 1);
  }
  if (code >= 128) {
    const c = String.fromCharCode(code - 128);
    if (c.trim() || c === ' ') return c;
  }
  if (code >= 32 && code <= 126) return String.fromCharCode(code);
  return '';
};

/** Decode obfuscated numeric tokens (dates, account digits, amounts). */
export const decodeLiverpoolNumericToken = (raw: string): string => {
  let out = '';
  for (const ch of raw) {
    if (ch === 'p') out += '0';
    else if (ch === 'k') continue;
    else if (/\d/.test(ch)) out += String(Number(ch) + 1);
  }
  return out;
};

/** Decode obfuscated MXN amount tokens (e.g. `701K4p` → 812.50). */
export const decodeLiverpoolAmountToken = (raw: string): number | null => {
  let token = raw.replace(/\\/g, '').replace(/k/g, '');
  let negative = false;
  if (token.startsWith('`') || token.startsWith('-')) {
    negative = true;
    token = token.slice(1);
  }

  let out = '';
  for (const ch of token) {
    if (ch === 'K') out += '.';
    else if (ch === 'p') out += '0';
    else if (/\d/.test(ch)) out += String(Number(ch) + 1);
  }

  const value = Number.parseFloat(out);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
};
