import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
// Amplify is configured within client components via getDataClient()

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Healthcare Translation - Real-time Medical AI Translation",
  description: "HIPAA-compliant real-time translation for healthcare providers and patients using AWS AI services",
  keywords: "healthcare, medical translation, real-time translation, HIPAA compliant, AWS AI",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ErrorBoundary>
          {/* App-wide providers */}
          {/* eslint-disable-next-line react/no-children-prop */}
          <AppProviders children={children} />
        </ErrorBoundary>
      </body>
    </html>
  );
}

// Client wrapper for providers
function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* AppContext is a client component provider */}
      <ClientProvidersWrapper>{children}</ClientProvidersWrapper>
    </>
  );
}

// Isolate client providers to a client boundary
// eslint-disable-next-line @next/next/no-typos
function ClientProvidersWrapper({ children }: { children: React.ReactNode }) {
  // This file is a server component; we dynamically import the client provider to avoid RSC issues
  // The dynamic import is handled inline to keep the file minimal
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppProvider } = require('@/context/AppContext');
  return <AppProvider>{children}</AppProvider>;
}
