import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "640mb",
    },
    /** Default 10mb caps buffered bodies when the app proxy runs; raise for large CSV uploads. */
    proxyClientMaxBodySize: "640mb",
  },
};

export default nextConfig;
