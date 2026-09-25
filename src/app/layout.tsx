import type { Metadata } from 'next';
import '@/lib/polyfills';
import { Geist, Geist_Mono, Manrope } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider } from '@/components/session-provider';
import { FinanceProvider } from '@/context/finance-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const display = Manrope({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  title: {
    default: 'MiCasa',
    template: '%s',
  },
  description:
    'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
  icons: {
    icon: [
      { url: '/icons/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
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
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}
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
                  color="#3a37fc"
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
