import type { Metadata } from "next";
import { AuthLayoutShell } from "@/components/auth/auth-layout-shell";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your customer support workspace",
  icons: {
    icon: "/icon.svg",
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
