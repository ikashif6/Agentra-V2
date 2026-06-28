import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const AUTH_LOGO_CLASS = "h-8 w-auto";

type AuthLogoProps = {
  className?: string;
};

export function AuthLogo({ className }: AuthLogoProps) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)}>
      <Image
        src="/agentraa-logo.svg"
        alt="Agentraa"
        width={290}
        height={65}
        priority
        className={AUTH_LOGO_CLASS}
      />
    </Link>
  );
}
