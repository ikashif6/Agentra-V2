"use client";

import Link from "next/link";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { Button } from "@/components/ui/button";
import { useMainLoginUrl } from "@/hooks/use-main-login-url";

export function ForgotPasswordWorkspaceRequired() {
  const mainLoginUrl = useMainLoginUrl();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Open your workspace URL first, then use forgot password from the sign-in page.
        </p>
      </div>

      <Link href={mainLoginUrl} className="block">
        <Button type="button" className={`h-10 w-full font-semibold ${authRadiusClass}`}>
          Find your workspace
        </Button>
      </Link>
    </div>
  );
}
