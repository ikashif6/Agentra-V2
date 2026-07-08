import Link from "next/link";
import { cn } from "@/lib/utils";
import { APP_LIST_ROW } from "@/lib/app-surfaces";

type AppListRowLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function AppListRowLink({ href, children, className }: AppListRowLinkProps) {
  return (
    <Link href={href} className={cn(APP_LIST_ROW, "group", className)}>
      {children}
    </Link>
  );
}

export function AppListDivider() {
  return <div className="border-t border-border/50" />;
}

export function AppEmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function AppLinkAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {children}
    </Link>
  );
}
