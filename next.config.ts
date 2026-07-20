import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://sdk.scdn.co`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.scdn.co https://*.spotifycdn.com",
  "font-src 'self' data:",
  "media-src 'self' blob: https://*.scdn.co",
  `connect-src 'self'${isDevelopment ? " ws: http:" : ""} https://*.supabase.co wss://*.supabase.co https://api.spotify.com https://accounts.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co`,
  "frame-src 'self' https://sdk.scdn.co https://open.spotify.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "image-cdn-ak.spotifycdn.com" },
      { protocol: "https", hostname: "image-cdn-fa.spotifycdn.com" },
      { protocol: "https", hostname: "seeded-session-images.scdn.co" },
    ],
  },
};

export default nextConfig;
