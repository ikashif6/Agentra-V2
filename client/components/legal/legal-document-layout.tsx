import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

type LegalDocumentLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  alternateHref: string;
  alternateLabel: string;
};

export function LegalDocumentLayout({
  title,
  description,
  children,
  alternateHref,
  alternateLabel,
}: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <header className="border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <Link href={LEGAL.portal} className="flex items-center gap-2.5">
            <Image
              src="/agentraa-logo.svg"
              alt={LEGAL.companyName}
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-lg font-semibold tracking-tight">{LEGAL.companyName}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href={alternateHref} className="hover:text-white">
              {alternateLabel}
            </Link>
            <a
              href={`mailto:${LEGAL.supportEmail}`}
              className="hidden hover:text-white sm:inline"
            >
              Contact
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <div className="mb-10 border-b border-white/10 pb-8">
          <p className="text-sm font-medium text-[#D85A30]">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">{description}</p>
          <p className="mt-4 text-xs text-zinc-500">
            Effective date: {LEGAL.effectiveDate} · Last updated: {LEGAL.lastUpdated}
          </p>
        </div>

        <article className="legal-prose space-y-8 text-[15px] leading-7 text-zinc-300">
          {children}
        </article>

        <footer className="mt-16 border-t border-white/10 pt-8 text-center text-xs text-zinc-500">
          <p>
            © {new Date().getFullYear()} {LEGAL.companyName}. All rights reserved.
          </p>
          <p className="mt-2">
            Questions?{" "}
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-[#D85A30] hover:underline">
              {LEGAL.supportEmail}
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function LegalSubsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-base font-medium text-zinc-100">{title}</h3>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-[#D85A30]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
