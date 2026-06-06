import type { Metadata } from 'next';
import '@/lib/polyfills';
import { Geist, Geist_Mono } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'MiCasa',
  description:
    'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
  icons: {
    icon: [
      { url: '/icon.ico', sizes: 'any' },
      { url: '/icon.ico' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
    shortcut: ['/icon.ico'],
  },
  openGraph: {
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
    <html lang="en" suppressHydrationWarning>
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
                  color="#10b981"
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
