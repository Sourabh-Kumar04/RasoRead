import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";
import { MobileNav } from "@/components/ui/MobileNav";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import { PWAInstallPrompt } from "@/components/ui/PWAInstallPrompt";

export const metadata: Metadata = {
  title: "RasoRead — Your Books, Now in Motion",
  description: "AI-powered audio reading with real-time text highlighting, smart zoom, and voice commands.",
  keywords: ["audiobook", "TTS", "reading", "AI", "PDF reader", "EPUB"],
  manifest: "/manifest.json",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
};

import { PageTransition } from "@/components/ui/PageTransition";
import { CustomCursor } from "@/components/ui/CustomCursor";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />
      </head>
      <body className="">
        <ServiceWorkerRegistrar />
        <CustomCursor />
        <PageTransition>
          {children}
        </PageTransition>
        <MobileNav />
        <PWAInstallPrompt />
        <ToastContainer />
      </body>
    </html>
  );
}
