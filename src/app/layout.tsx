import type { Metadata, Viewport } from "next";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifePilot",
  description: "Jouw persoonlijke life management app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LifePilot",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
