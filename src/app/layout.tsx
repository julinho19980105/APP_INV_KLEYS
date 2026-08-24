
import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'StiloStack | High-End Fashion & Logistics',
  description: 'Intelligent inventory and quoting system for high-end fashion brands.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable} dark`}>
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
