import { cn } from "@/lib/utils";
import { APP_TOOLBAR_INPUT } from "@/lib/app-surfaces";

export function AppSearchInput({
  className,
  ...props
}: React.ComponentProps<"input"> & { className?: string }) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-[10px] border border-border/80 bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/20",
        APP_TOOLBAR_INPUT,
        className,
      )}
      {...props}
    />
  );
}

export function AppListHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 border-b border-border/60 bg-muted/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AppPaginationBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
