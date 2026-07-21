import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SpotifyPlayerProvider } from "@/components/music/SpotifyPlayerProvider";
import { ListeningTogetherProvider } from "@/components/listening/ListeningTogetherProvider";
import "./globals.css";

const themeBootstrapScript = `
  (function () {
    try {
      var theme = localStorage.getItem("maiabeat-theme");
      if (!theme) {
        var persisted = JSON.parse(localStorage.getItem("maiabeat-library") || "{}");
        theme = persisted && persisted.state && persisted.state.theme;
      }
      if (theme !== "sunny" && theme !== "night" && theme !== "maria") theme = "sunny";
      document.documentElement.dataset.theme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "sunny";
    }
  })();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const mariaDisplay = Playfair_Display({
  variable: "--font-maria-display",
  subsets: ["latin"],
  display: "swap",
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
      data-theme="sunny"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${mariaDisplay.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full bg-[#111]">
        <SpotifyPlayerProvider>
          <ListeningTogetherProvider>{children}</ListeningTogetherProvider>
        </SpotifyPlayerProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
