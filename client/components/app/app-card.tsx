import { cn } from "@/lib/utils";
import { APP_CARD } from "@/lib/app-surfaces";

type AppCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppCard({ children, className }: AppCardProps) {
  return <div className={cn(APP_CARD, className)}>{children}</div>;
}

type AppCardHeaderProps = {
  title: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function AppCardHeader({ title, action, icon, className }: AppCardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
        <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function AppCardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-0", className)}>{children}</div>;
}
