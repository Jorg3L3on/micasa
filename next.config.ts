import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    proxyClientMaxBodySize: "4mb",
    // Next 16.1+ defaults this to true; Turbopack FS cache can grow large and add background work in dev.
    // When using `npm run dev:turbo`, set back to true if cold starts are too slow.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
