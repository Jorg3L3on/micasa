import type { Metadata, Viewport } from 'next';
import '@/lib/polyfills';
import { Geist, Geist_Mono } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider } from '@/components/session-provider';
import { FinanceProvider } from '@/context/finance-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

/** Orion navy canvas — `DESIGN.md` / `.dark --background`. */
const ORION_NAVY = '#060914';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: ORION_NAVY,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  applicationName: 'MiCasa',
  title: {
    default: 'MiCasa',
    template: '%s',
  },
  description:
    'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
  appleWebApp: {
    capable: true,
    title: 'MiCasa',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
    shortcut: ['/icon.ico'],
  },
  openGraph: {
    title: 'MiCasa',
    description:
      'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
    locale: 'es_MX',
    type: 'website',
    siteName: 'MiCasa',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MiCasa',
    description:
      'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <FinanceProvider>
            <TooltipProvider delayDuration={0}>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem
                disableTransitionOnChange
              >
                <NextTopLoader
                  color="#FF5733"
                  height={3}
                  showSpinner={false}
                  zIndex={1600}
                />
                {children}
                <Toaster richColors position="top-center" />
              </ThemeProvider>
            </TooltipProvider>
          </FinanceProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
