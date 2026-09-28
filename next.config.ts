import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spec 014 folded the standalone fleet screens into /fleet-owners. Old bookmarks and
  // links keep working: /fleets/:fleetId lands on the owner screen with `?fleet=`, which
  // expands that company inline (the fleet-owner detail page reads the param).
  async redirects() {
    return [
      { source: "/fleets", destination: "/fleet-owners", permanent: true },
      { source: "/fleets/:fleetId", destination: "/fleet-owners?fleet=:fleetId", permanent: true },
    ];
  },
};

export default nextConfig;
