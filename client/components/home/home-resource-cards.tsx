"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { APP_CARD } from "@/lib/app-surfaces";
import { SITE_LEGAL } from "@/lib/site";

type ResourceCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  image: string;
  imageAlt: string;
  external?: boolean;
  adminOnly?: boolean;
  agentOnly?: boolean;
};

const RESOURCES: ResourceCard[] = [
  {
    title: "Open your inbox",
    description: "Review new conversations, assign tickets, and reply to customers.",
    href: "/inbox",
    cta: "Go to inbox",
    image: "/home/grow-inbox.png",
    imageAlt: "Inbox conversation bubbles",
  },
  {
    title: "Agentra Help Center",
    description: "Guides for channels, automations, and workspace configuration.",
    href: SITE_LEGAL.helpCenter,
    cta: "Browse guides",
    image: "/home/grow-help.png",
    imageAlt: "Help center guidebook and life ring",
    external: true,
  },
  {
    title: "Best practices library",
    description: "Templates and playbooks for scaling support without adding headcount.",
    href: "/analytics",
    cta: "View insights",
    image: "/home/grow-insights.png",
    imageAlt: "Support playbook and insights",
    adminOnly: true,
  },
  {
    title: "Your notifications",
    description: "Tune sounds and alerts so you never miss a conversation assigned to you.",
    href: "/settings?item=notifications",
    cta: "Open settings",
    image: "/home/grow-assigned.png",
    imageAlt: "Notification preferences",
    agentOnly: true,
  },
];

function CardBody({ item }: { item: ResourceCard }) {
  return (
    <>
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted/20">
        <Image
          src={item.image}
          alt={item.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{item.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </div>
        <span
          className={cn(
            "mt-auto inline-flex h-9 w-fit items-center rounded-[10px] border border-border/80 bg-card px-3.5 text-sm font-medium text-foreground",
            "transition-colors group-hover:border-foreground/20 group-hover:bg-muted/40",
          )}
        >
          {item.cta}
        </span>
      </div>
    </>
  );
}

export function HomeResourceCards({ monochrome = false }: { monochrome?: boolean }) {
  const { user } = useAuth();
  const role = user?.role ?? "customer";
  const isAdmin = ["owner", "admin", "manager"].includes(role);
  const isAgent = role === "agent";

  const resources = RESOURCES.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.agentOnly) return isAgent;
    return true;
  });

  return (
    <section className="w-full space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Grow with Agentra</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shortcuts and resources to help your team move faster.
        </p>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-3">
        {resources.map((item) => {
          const className = cn(
            APP_CARD,
            "group flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-foreground/20",
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
                <CardBody item={item} />
              </a>
            );
          }

          return (
            <Link key={item.title} href={item.href} className={className}>
              <CardBody item={item} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
