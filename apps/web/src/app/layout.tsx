import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from './providers';
import { AnalyticsProvider } from '@/components/features/analytics';
import { CookieConsent } from '@/components/features/privacy/CookieConsent';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ADAShield - Accessibility Testing',
  description: 'Free WCAG accessibility testing for your website',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders>
          <AnalyticsProvider>
            {children}
            <CookieConsent />
          </AnalyticsProvider>
        </AppProviders>
      </body>
    </html>
  );
}
