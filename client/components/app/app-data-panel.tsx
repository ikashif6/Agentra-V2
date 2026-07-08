import { cn } from "@/lib/utils";
import { APP_PANEL } from "@/lib/app-surfaces";

type AppDataPanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppDataPanel({ children, className }: AppDataPanelProps) {
  return <div className={cn(APP_PANEL, className)}>{children}</div>;
}

export function AppPageIntro({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function AppTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border/60 bg-muted/30">{children}</tr>
    </thead>
  );
}

export function AppTableHeadCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function AppTableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("border-b border-border/40 transition-colors last:border-0 hover:bg-accent/30", className)}>
      {children}
    </tr>
  );
}

export function AppTableCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-5 py-3.5 text-sm", className)}>{children}</td>;
}
