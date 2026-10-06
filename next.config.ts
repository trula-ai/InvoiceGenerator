import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships Node-only code (fontkit, yoga). Keep it out of
  // the server bundle so it runs from node_modules as-is.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
