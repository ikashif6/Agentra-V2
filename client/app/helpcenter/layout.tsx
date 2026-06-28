import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Get support and track your tickets",
};

/**
 * Help Center Portal Layout
 *
 * Fully public layout — no auth shell, no sidebar, no header.
 * Served at /helpcenter and also via custom domains (help.yourdomain.com).
 */
export default function HelpCenterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
