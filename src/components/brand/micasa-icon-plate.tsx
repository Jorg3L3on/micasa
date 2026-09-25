import {
  MICASA_MARK_GRADIENT_FROM,
  MICASA_MARK_GRADIENT_TO,
  MICASA_MARK_PATH,
  MICASA_MARK_PLATE,
  MICASA_MARK_STROKE_WIDTH,
  MICASA_MARK_VIEWBOX,
} from '@/components/brand/micasa-mark-geometry';

type MicasaIconPlateProps = {
  /** Outer pixel size of the plate. */
  size: number;
  /** Extra inset so maskable icons stay inside the safe zone. */
  markInset?: number;
};

/** Navy rounded plate with the M. Used by favicon and Apple icon routes. */
export const MicasaIconPlate = ({ size, markInset = 0.16 }: MicasaIconPlateProps) => {
  const radius = Math.round(size * 0.22);
  const pad = Math.round(size * markInset);
  const mark = size - pad * 2;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        background: MICASA_MARK_PLATE,
      }}
    >
      <svg
        width={mark}
        height={mark}
        viewBox={MICASA_MARK_VIEWBOX}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="micasaFill" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor={MICASA_MARK_GRADIENT_FROM} />
            <stop offset="100%" stopColor={MICASA_MARK_GRADIENT_TO} />
          </linearGradient>
          <linearGradient id="micasaGloss" x1="78%" y1="0%" x2="100%" y2="28%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={MICASA_MARK_PATH}
          stroke="url(#micasaFill)"
          strokeWidth={MICASA_MARK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={MICASA_MARK_PATH}
          stroke="url(#micasaGloss)"
          strokeWidth={MICASA_MARK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
