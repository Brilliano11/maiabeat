import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SpotifyPlayerProvider } from "@/components/music/SpotifyPlayerProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maiabeat",
  description: "Play loud. Look louder.",
  applicationName: "Maiabeat",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Maiabeat",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF4D00",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#111]">
        <SpotifyPlayerProvider>{children}</SpotifyPlayerProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
