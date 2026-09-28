import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'MiCasa — Planifica tu dinero por quincenas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CANVAS = '#060914';

export default async function OpenGraphImage() {
  const [mark, shot, manrope, geist] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/brand/mark-160.png')),
    readFile(path.join(process.cwd(), 'public/landing/og-panel.png')),
    readFile(path.join(process.cwd(), 'src/app/fonts/Manrope-Bold.ttf')),
    readFile(path.join(process.cwd(), 'src/app/fonts/Geist-Regular.ttf')),
  ]);

  const markSrc = `data:image/png;base64,${mark.toString('base64')}`;
  const shotSrc = `data:image/png;base64,${shot.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: CANVAS,
          color: '#f7f8ff',
          fontFamily: 'Geist',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 560,
            padding: '56px 48px 48px 56px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: 'Manrope',
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            <img src={markSrc} width={52} height={52} alt="" />
            MiCasa
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                fontFamily: 'Manrope',
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.12,
              }}
            >
              Tu quincena, clara de punta a punta.
            </div>
            <div style={{ fontSize: 22, color: '#9ca3af', lineHeight: 1.4 }}>
              Ingresos, gastos y operaciones por quincenas.
            </div>
          </div>
          <div style={{ fontSize: 18, color: '#9ca3af' }}>Gratis para usar</div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flex: 1,
            padding: '40px 40px 40px 0',
          }}
        >
          <img
            src={shotSrc}
            width={560}
            height={350}
            alt=""
            style={{
              borderRadius: 16,
              objectFit: 'cover',
              objectPosition: 'left top',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Manrope', data: manrope, weight: 700, style: 'normal' },
        { name: 'Geist', data: geist, weight: 400, style: 'normal' },
      ],
    },
  );
};
