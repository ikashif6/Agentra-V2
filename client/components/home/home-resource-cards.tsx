"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, Inbox, LifeBuoy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { APP_CARD } from "@/lib/app-surfaces";
import { SITE_LEGAL } from "@/lib/site";

const RESOURCES = [
  {
    title: "Open your inbox",
    description: "Review new conversations, assign tickets, and reply to customers.",
    href: "/inbox",
    cta: "Go to inbox",
    icon: Inbox,
  },
  {
    title: "Agentra Help Center",
    description: "Guides for channels, automations, and workspace configuration.",
    href: SITE_LEGAL.helpCenter,
    cta: "Browse guides",
    icon: LifeBuoy,
    external: true,
  },
  {
    title: "Best practices library",
    description: "Templates and playbooks for scaling support without adding headcount.",
    href: "/analytics",
    cta: "View insights",
    icon: BookOpen,
    adminOnly: true,
  },
];

export function HomeResourceCards({ monochrome = false }: { monochrome?: boolean }) {
  const { user } = useAuth();
  const isAdmin = ["owner", "admin"].includes(user?.role ?? "");
  const resources = RESOURCES.filter((item) => !item.adminOnly || isAdmin);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Grow with Agentra</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shortcuts and resources to help your team move faster.
        </p>
      </div>

      <div className={cn("grid gap-4", resources.length > 1 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {resources.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border/70 text-foreground">
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline">
                {item.cta}
                <ArrowUpRight className="size-3.5" />
              </span>
            </>
          );

          const className = cn(
            APP_CARD,
            "flex h-full flex-col p-5 transition-colors hover:border-foreground/20",
            monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-neutral-400",
          );

          if (item.external) {
            return (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            );
          }

          return (
            <Link key={item.title} href={item.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
