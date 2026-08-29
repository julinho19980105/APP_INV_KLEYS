import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/layout/app-shell";
import { FirebaseClientProvider } from "@/firebase";
import { PasswordGuard } from "@/components/PasswordGuard";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'KLEYS KIDS',
  description: 'Sistema de Gestión Industrial KLEYS KIDS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KLEYS KIDS',
  },
  icons: {
    apple: 'https://drive.google.com/thumbnail?id=15o8oqYnmbOjXUIBgPFzl-SDi78SdTo2O&sz=w180',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable} dark`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <FirebaseClientProvider>
          <PasswordGuard>
            <AppShell>
              {children}
            </AppShell>
          </PasswordGuard>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
