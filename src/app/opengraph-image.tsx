import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MiCasa — Planifica tu dinero por quincenas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#0a0b10',
          backgroundImage:
            'radial-gradient(ellipse at 20% 0%, rgba(46, 141, 245, 0.85) 0%, transparent 45%), radial-gradient(ellipse at 100% 80%, rgba(172, 61, 243, 0.7) 0%, transparent 40%)',
          color: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundImage: 'linear-gradient(135deg, #2E8DF5, #AC3DF3)',
            }}
          />
          MiCasa
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Tu quincena, clara de punta a punta.
          </div>
          <div
            style={{
              fontSize: 28,
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            Planifica ingresos, gastos y obligaciones por quincenas — el ritmo
            real de cobrar y pagar en México.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 22,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          micasa · planificación financiera
        </div>
      </div>
    ),
    { ...size }
  );
}
