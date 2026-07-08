"use client";

import type { OnboardingStepId } from "./onboarding-config";

type OnboardingStepVisualProps = {
  step: OnboardingStepId;
};

export function OnboardingStepVisual({ step }: OnboardingStepVisualProps) {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl bg-[#f3f4f6] p-8 lg:min-h-0">
      {step === "goal" && <GoalVisual />}
      {step === "channels" && <ChannelsVisual />}
      {step === "volume" && <VolumeVisual />}
      {step === "platform" && <PlatformVisual />}
      {step === "ai" && <AiVisual />}
    </div>
  );
}

function GoalVisual() {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute left-4 top-8 w-[88%] rotate-[-2deg] rounded-2xl border border-black/[0.06] bg-white p-4 shadow-lg">
        <div className="mb-3 flex gap-2">
          <div className="size-8 rounded-full bg-[#fde8df]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-2 w-3/4 rounded bg-gray-200" />
            <div className="h-2 w-1/2 rounded bg-gray-100" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-gray-100" />
          <div className="h-2 w-5/6 rounded bg-gray-100" />
        </div>
      </div>
      <div className="relative ml-auto mt-16 w-[78%] rotate-[1deg] rounded-2xl border border-black/[0.06] bg-white p-4 shadow-xl">
        <div className="mb-2 text-xs font-medium text-[#D85A30]">Auto-routed</div>
        <div className="h-2 w-full rounded bg-gray-100" />
        <div className="mt-2 h-2 w-2/3 rounded bg-gray-100" />
      </div>
    </div>
  );
}

function ChannelsVisual() {
  const icons = ["f", "💬", "✉", "📷", "🎵", "🛒", "✨"];
  return (
    <div className="flex flex-col items-center gap-3">
      {icons.map((icon, i) => (
        <div
          key={icon}
          className="flex size-14 items-center justify-center rounded-full border border-black/[0.06] bg-white text-lg shadow-sm"
          style={{ marginLeft: i % 2 === 0 ? "-24px" : "24px" }}
        >
          {icon}
        </div>
      ))}
    </div>
  );
}

function VolumeVisual() {
  return (
    <div className="w-full max-w-xs rounded-2xl border border-black/[0.06] bg-white p-5 shadow-lg">
      <div className="mb-4 text-sm font-semibold text-gray-900">My tickets</div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="mb-3 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
          <div className="size-4 rounded border border-gray-200 bg-white" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-full rounded bg-gray-200" />
            <div className="h-2 w-2/3 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PlatformVisual() {
  const labels = ["Shopify", "Woo", "Big", "Magento", "Presta"];
  return (
    <div className="grid max-w-sm grid-cols-3 gap-3">
      {labels.map((label) => (
        <div
          key={label}
          className="flex aspect-square items-center justify-center rounded-2xl border border-black/[0.06] bg-white p-3 text-center text-[11px] font-medium text-gray-600 shadow-sm"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function AiVisual() {
  return (
    <div className="relative w-full max-w-md">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-lg">
        <div className="mb-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className="text-amber-400">
              ★
            </span>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-gray-100" />
          <div className="h-2 w-4/5 rounded bg-gray-100" />
        </div>
      </div>
      <div className="absolute -bottom-6 -right-4 w-[70%] rounded-2xl border border-black/[0.06] bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#7c3aed]">
          ✨ AI suggestion
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
