import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Owner companies replaced fleets: the owner user IS the company, so the old
  // fleet screens are gone and every bookmark lands on the owner index.
  async redirects() {
    return [
      { source: "/fleets", destination: "/fleet-owners", permanent: true },
      { source: "/fleets/:fleetId", destination: "/fleet-owners", permanent: true },
    ];
  },
};

export default nextConfig;
