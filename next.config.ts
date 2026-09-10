import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;

// Makes Cloudflare bindings available to `next dev` (no-op for this app's
// client-side realtime traffic, but keeps dev/prod parity with OpenNext).
initOpenNextCloudflareForDev();
