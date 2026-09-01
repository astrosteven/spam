import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/spam",
  images: { unoptimized: true },
};

export default nextConfig;
