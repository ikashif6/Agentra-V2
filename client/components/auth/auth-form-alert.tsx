import { cn } from "@/lib/utils";
import { authRadiusClass } from "@/components/auth/auth-panel-background";

type AuthFormAlertProps = {
  message: string;
  variant?: "error" | "success" | "info";
  className?: string;
};

export function AuthFormAlert({
  message,
  variant = "error",
  className,
}: AuthFormAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border px-3 py-2.5 text-sm leading-relaxed",
        authRadiusClass,
        variant === "error" &&
          "border-destructive/25 bg-destructive/5 text-destructive",
        variant === "success" &&
          "border-brand/25 bg-brand-muted text-brand-muted-foreground",
        variant === "info" &&
          "border-primary/25 bg-primary/5 text-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}
