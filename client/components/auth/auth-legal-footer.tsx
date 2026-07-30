import Link from "next/link";
import { SITE_LEGAL } from "@/lib/site";
import { cn } from "@/lib/utils";

export function AuthLegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-4 text-xs text-muted-foreground",
        className,
      )}
    >
      <Link
        href={SITE_LEGAL.helpCenter}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground hover:underline"
      >
        Help Center
      </Link>
      <Link
        href={SITE_LEGAL.privacyPolicy}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground hover:underline"
      >
        Privacy Policy
      </Link>
      <Link
        href={SITE_LEGAL.termsAndConditions}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground hover:underline"
      >
        Terms &amp; Conditions
      </Link>
    </footer>
  );
}
