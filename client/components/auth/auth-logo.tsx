import Link from "next/link";
import { cn } from "@/lib/utils";

/** Your brand logo asset — do not replace with generated artwork. */
export const BRAND_LOGO_SRC = "/agentraa-logo.svg";
export const BRAND_LOGO_WIDTH = 290;
export const BRAND_LOGO_HEIGHT = 65;
export const AUTH_LOGO_CLASS = "h-8 w-auto";

type AuthLogoProps = {
  className?: string;
  imgClassName?: string;
  href?: string;
};

export function AuthLogo({ className, imgClassName, href = "/" }: AuthLogoProps) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_SRC}
        alt="Agentra"
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        className={cn(AUTH_LOGO_CLASS, imgClassName)}
      />
    </Link>
  );
}
