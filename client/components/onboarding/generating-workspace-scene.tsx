"use client";

/** Gorgias-style generating workspace preview — chat mockup */
export function GeneratingWorkspaceScene() {
  return (
    <div className="mx-auto mt-10 w-full max-w-[520px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)]">
      <div className="space-y-4 p-5">
        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-[#f3f4f6] px-4 py-3 text-[13px] leading-relaxed text-[#374151]">
          Hi! I&apos;m looking for a foundation that matches my skin tone. Can you help me find
          the right shade?
        </div>

        <div className="flex items-end justify-end gap-2">
          <div className="max-w-[72%] rounded-2xl rounded-tr-md bg-black px-4 py-3 text-[13px] leading-relaxed text-white">
            Medium with warm undertones
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#d4a574] text-[11px] font-semibold text-white">
            EY
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7c3aed]">
            <SparkleIcon />
            AI Agent
          </div>
          <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#f3f4f6] px-4 py-3 text-[13px] leading-relaxed text-[#374151]">
            Based on your undertone, I&apos;d recommend our Warm Medium shade. It has great
            coverage and works well for everyday wear. Want me to add it to your cart?
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-black/[0.04] bg-[#fafafa] p-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex aspect-[4/3] items-center justify-center rounded-xl border border-black/[0.06] bg-white"
          >
            <div className="size-10 rounded-lg bg-gradient-to-br from-[#93c5fd] to-[#3b82f6]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L13.09 8.26L19 7L14.74 12L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12L5 7L10.91 8.26L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
