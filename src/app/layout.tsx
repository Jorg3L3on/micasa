import type { Metadata, Viewport } from 'next';
import '@/lib/polyfills';
import { Geist, Geist_Mono, Manrope } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider } from '@/components/session-provider';
import { FinanceProvider } from '@/context/finance-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import { DOCUMENT_TITLE_TEMPLATE, SITE_NAME } from '@/lib/document-title';
import { IOS_SPLASH_IMAGES } from '@/lib/pwa/ios-splash';
import { buildLaunchRedirectScript } from '@/lib/pwa/pwa-launch';
import { VIEW_TRANSITION_GUARD_SCRIPT } from '@/lib/ui/view-transition-guard';
import { getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';

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
    default: SITE_NAME,
    template: DOCUMENT_TITLE_TEMPLATE,
  },
  description:
    'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y operaciones.',
  icons: {
    icon: [
      { url: '/icons/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title: 'MiCasa',
    description:
      'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y operaciones.',
    locale: 'es_MX',
    type: 'website',
    siteName: 'MiCasa',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MiCasa',
    description:
      'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y operaciones.',
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
    startupImage: IOS_SPLASH_IMAGES,
  },
  // Next emits only `mobile-web-app-capable`; older iOS needs the Apple name
  // to use the startup images and status bar style.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#060914',
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
        <script
          dangerouslySetInnerHTML={{
            __html: VIEW_TRANSITION_GUARD_SCRIPT,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: buildLaunchRedirectScript(getCurrentMonthlyPanelHref()),
          }}
        />
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
                <Toaster
                  richColors
                  position="top-center"
                  offset={{ top: 'calc(env(safe-area-inset-top) + 24px)' }}
                  mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
                />
                <ServiceWorkerRegistrar />
              </ThemeProvider>
            </TooltipProvider>
          </FinanceProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
