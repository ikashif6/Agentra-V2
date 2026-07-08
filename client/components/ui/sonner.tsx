"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { AlertCircle, Check, Info, Loader2, X } from "lucide-react"

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

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      richColors={false}
      closeButton
      icons={{
        success: <Check className="size-3.5 stroke-[2.5]" />,
        info: <Info className="size-3.5 stroke-[2.5]" />,
        warning: <AlertCircle className="size-3.5 stroke-[2.5]" />,
        error: <X className="size-3.5 stroke-[2.5]" />,
        loading: <Loader2 className="size-3.5 animate-spin stroke-[2.5]" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast flex w-full items-center gap-3 rounded-[10px] border border-border/70 " +
            "px-3.5 py-2.5 shadow-sm ring-1 ring-border/40 " +
            "group-[.toaster]:bg-card group-[.toaster]:text-card-foreground",
          title: "text-sm font-medium leading-snug text-foreground",
          description: "text-xs leading-relaxed text-muted-foreground",
          closeButton:
            "absolute right-2 top-2 rounded-md border border-transparent bg-transparent p-1 " +
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          icon:
            "flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground [&_svg]:block [&_svg]:size-3.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
