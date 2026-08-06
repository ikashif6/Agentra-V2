import { MessageCircle, TrendingUp, type LucideIcon } from "lucide-react";

export type OnboardingSetupPayload = {
  teamGoal?: string;
  channels?: string[];
  ticketVolume?: string;
  ecommercePlatform?: string;
  aiInterest?: string;
};

export const ONBOARDING_STEPS = [
  "goal",
  "channels",
  "volume",
  "platform",
  "ai",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const GOAL_OPTIONS = [
  {
    id: "support",
    label: "Improve customer support",
    description: "Resolve tickets faster and keep customers happy",
    icon: MessageCircle,
  },
  {
    id: "sales",
    label: "Increase sales and conversion",
    description: "Turn support conversations into revenue opportunities",
    icon: TrendingUp,
  },
] as const;

export const CHANNEL_OPTIONS: { id: string; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "chat", label: "Chat" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: "WhatsApp" },
];

export const VOLUME_OPTIONS = [
  { id: "under-50", label: "< 50" },
  { id: "51-300", label: "51-300" },
  { id: "301-2000", label: "301-2,000" },
  { id: "2001-5000", label: "2,001-5,000" },
  { id: "over-5000", label: "> 5,000" },
  { id: "unknown", label: "I don't know yet" },
] as const;

export const PLATFORM_OPTIONS = [
  { id: "shopify", label: "Shopify" },
  { id: "woocommerce", label: "WooCommerce" },
  { id: "custom", label: "Custom developed" },
] as const;

export const AI_OPTIONS = [
  {
    id: "very",
    label: "Turn it on",
    description: "I'd like AI to assist my team from day one",
  },
  {
    id: "somewhat",
    label: "Explore first",
    description: "I'm curious and would like to try it gradually",
  },
  {
    id: "not",
    label: "Skip for now",
    description: "We'll handle replies ourselves for now",
  },
] as const;

export const STEP_COPY: Record<
  OnboardingStepId,
  { heroTitle: string; heroSubtitle: string; prompt: string }
> = {
  goal: {
    heroTitle: "Let's get started",
    heroSubtitle: "A few details help us set up your workspace.",
    prompt: "What's your top priority with Agentra?",
  },
  channels: {
    heroTitle: "Almost there",
    heroSubtitle: "Tell us how customers usually reach your team.",
    prompt: "Which channels do customers use to get in touch?",
  },
  volume: {
    heroTitle: "Your ticket volume",
    heroSubtitle: "We'll use this to suggest sensible defaults.",
    prompt: "Roughly how many tickets does your team handle each month?",
  },
  platform: {
    heroTitle: "Your commerce stack",
    heroSubtitle: "We'll tailor setup to match how you sell.",
    prompt: "Which platform powers your online store?",
  },
  ai: {
    heroTitle: "AI in your inbox",
    heroSubtitle: "Agentra can draft replies, route tickets, and surface key details from long threads.",
    prompt: "Would you like AI assistance in your workspace?",
  },
};
