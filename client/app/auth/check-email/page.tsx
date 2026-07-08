import Link from "next/link";
import { AuthLogo } from "@/components/auth/auth-logo";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { cn } from "@/lib/utils";

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string; workspace?: string }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const params = await searchParams;
  const email = params.email;
  const workspace = params.workspace;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <AuthLogo />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Check your email</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a verification link{email ? ` to ${email}` : ""}. Click the link to activate
            your workspace
            {workspace ? ` at ${workspace}` : ""} and continue setup.
          </p>
        </div>

        <div
          className={cn(
            "border border-border/70 bg-muted/20 px-4 py-4 text-left text-sm text-muted-foreground",
            authRadiusClass,
          )}
        >
          After verifying, you&apos;ll see a short workspace setup flow, then you&apos;re in.
        </div>

        <p className="text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
