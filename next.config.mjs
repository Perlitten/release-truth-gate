import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;

initOpenNextCloudflareForDev();
