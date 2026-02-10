import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

import InstallPrompt from "@/components/InstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amali City Buildings Dashboard",
  description: "Manage and view city buildings in Amali project",
  manifest: "/manifest.json",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Amali Buildings",
  },

  themeColor: "#0ea5e9",

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Icons */}
        <link rel="apple-touch-icon" href="/icon-192x192.png" />

        {/* PWA Meta Tags */}
        <meta name="application-name" content="Amali Buildings" />
        <meta name="apple-mobile-web-app-title" content="Amali Buildings" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Mobile Web App */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Theme Color */}
        <meta name="theme-color" content="#0ea5e9" />

        {/* Android Icons */}
        <link rel="icon" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" sizes="512x512" href="/icon-512x512.png" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}

        {/* Install Prompt Component */}
        <InstallPrompt />
      </body>
    </html>
  );
}
