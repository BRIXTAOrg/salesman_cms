import type { Metadata } from "next";
//import Head from 'next/head';
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
// BRIXTA_UI_V2: loaded last so the current look always wins.
import "./brixta-ui.css";
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// BRIXTA_CLEAN_UI_V1: titles use the same face as the field app.
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BRIXTA",
  description: "Run your field team: people, lists, visits and the field app.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">

      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}
      >
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
