"use client";

import Link from "next/link";
import { buildMainLoginUrl } from "@/lib/workspace-host";

export function ForgotPasswordWorkspaceRequired() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-500">
          Open your workspace URL first, then use forgot password from the sign-in page.
        </p>
      </div>
      <Link href={buildMainLoginUrl()} className="block">
        <span className="font-medium text-[#D85A30] hover:underline">Find your workspace →</span>
      </Link>
    </div>
  );
}
