"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  AlertCircle,
  Check,
  Info,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

function useDocumentTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const sync = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return theme
}

/** Shared by every toast type — success, error, warning, info, loading, default. */
const toastShell = cn(
  "group toast-shell pointer-events-auto flex w-[min(100vw-2rem,22rem)] items-center gap-3",
  "rounded-[10px] border border-border/80 bg-card px-3.5 py-3",
  "text-card-foreground shadow-[0_1px_2px_rgba(15,15,15,0.04),0_14px_36px_rgba(15,15,15,0.10)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_14px_36px_rgba(0,0,0,0.45)]",
  "ring-1 ring-black/[0.03] dark:ring-white/[0.06]",
)

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster"
      richColors={false}
      closeButton
      visibleToasts={4}
      gap={10}
      offset={16}
      icons={{
        success: <Check className="size-4 stroke-[2.25] text-foreground" />,
        info: <Info className="size-4 stroke-[2.25] text-muted-foreground" />,
        warning: <AlertCircle className="size-4 stroke-[2.25] text-amber-700 dark:text-amber-400" />,
        error: <X className="size-4 stroke-[2.25] text-destructive" />,
        loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
        close: <X className="size-3.5 stroke-[2.25]" />,
      }}
      toastOptions={{
        unstyled: true,
        duration: 3800,
        classNames: {
          toast: toastShell,
          success: toastShell,
          error: toastShell,
          warning: toastShell,
          info: toastShell,
          loading: toastShell,
          default: toastShell,
          title: "text-sm font-semibold tracking-tight text-foreground",
          description: "mt-0.5 text-xs leading-relaxed text-muted-foreground",
          content: "order-2 min-w-0 flex-1 pr-0.5",
          icon: cn(
            "toast-icon order-1 flex size-5 shrink-0 items-center justify-center",
            "!bg-transparent !bg-none bg-transparent shadow-none ring-0",
            "rounded-none !rounded-none",
          ),
          closeButton: cn(
            "toast-close order-3 !static ml-auto inline-flex size-7 shrink-0 items-center justify-center",
            "!rounded-lg rounded-lg border border-transparent !bg-transparent text-muted-foreground/80",
            "!transform-none !left-auto !right-auto !top-auto",
            "transition-colors hover:border-border/70 hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          ),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
