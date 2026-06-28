import type { NextConfig } from "next";

const APP_BASE_DOMAIN = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? "agentraa.com";

const nextConfig: NextConfig = {
  /**
   * Hostname-based rewrites for custom help center domains.
   *
   * When a request arrives at help.acme.com (a custom domain verified in the
   * HelpCenter collection), Next.js rewrites it to /helpcenter so our portal
   * page renders while the address bar still shows the custom domain.
   *
   * The API calls from that page use the x-helpcenter-subdomain header (set
   * client-side from window.location.hostname) so the backend can resolve the
   * correct tenant.
   *
   * For *.agentraa.com subdomains the pattern is:
   *   help.lyca.agentraa.com  →  rewrite to /helpcenter?workspace=lyca
   */
  async rewrites() {
    return {
      beforeFiles: [
        // help.<subdomain>.agentraa.com → /helpcenter?workspace=<subdomain>
        {
          source: "/",
          has: [
            {
              type: "host",
              value: `help\\.(?<subdomain>[a-z0-9-]+)\\.${APP_BASE_DOMAIN.replace(".", "\\.")}`,
            },
          ],
          destination: "/helpcenter?workspace=:subdomain",
        },
        // Any path on help.<subdomain>.agentraa.com → also rewrite
        {
          source: "/:path*",
          has: [
            {
              type: "host",
              value: `help\\.(?<subdomain>[a-z0-9-]+)\\.${APP_BASE_DOMAIN.replace(".", "\\.")}`,
            },
          ],
          destination: "/helpcenter?workspace=:subdomain",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
