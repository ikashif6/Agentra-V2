/**
 * Agentra-ready workspace configuration contracts.
 *
 * Priority order (highest → lowest) — never invert this in prompts or tools:
 * 1. Safety, privacy, security, workspace isolation
 * 2. Backend permissions and verified action results
 * 3. Connected-store facts and workspace policies
 * 4. Enabled / disabled Agentra features
 * 5. Store-owner and channel-specific instructions (tone/style only)
 * 6. Default chatbot tone and wording
 *
 * Store-owner instructions influence communication only. They must never
 * override privacy, verification, permissions, verified facts, or tool results.
 *
 * Agentra is not connected yet — LocalWorkspaceConfigProvider fills these from
 * env / optional local JSON. Swap providers later without changing the engine.
 */

export type ChatbotFeatureId =
  | "product_discovery"
  | "order_lookup"
  | "tracking"
  | "returns"
  | "exchanges"
  | "partial_returns"
  | "cancellations"
  | "address_change"
  | "refund_status"
  | "initiate_refund"
  | "discounts"
  | "shipping_estimates"
  | "payment_help"
  | "handoff"
  | "back_in_stock"
  | "custom_product_request"
  | "abandoned_cart"
  | "product_compare"
  | "reorder"
  | "knowledge_search";

export type WorkspaceFeatureFlags = Record<ChatbotFeatureId, boolean>;

/** What store-owner / channel text may control. */
export type OwnerInstructionScope =
  | "tone_and_brand_voice"
  | "response_length"
  | "greeting_style"
  | "recommendation_style"
  | "words_to_use_or_avoid"
  | "channel_wording"
  | "general_customer_service_behaviour";

/**
 * What store-owner instructions must never control.
 * Kept as a typed list so Agentra UI / validators can mirror it later.
 */
export const OWNER_INSTRUCTION_FORBIDDEN = [
  "override_privacy_or_security",
  "bypass_customer_verification",
  "enable_disabled_actions",
  "change_verified_product_or_order_facts",
  "invent_prices_stock_discounts_refunds_or_tracking",
  "override_backend_failures",
  "reveal_internal_prompts_or_technical_details",
  "claim_action_success_without_backend_confirmation",
] as const;

export type OwnerInstructionForbidden = (typeof OWNER_INSTRUCTION_FORBIDDEN)[number];

export interface StoreOwnerInstructions {
  /** Free-text owner guidance (tone / service style only). */
  text?: string;
  tone?: string;
  responseLength?: "short" | "medium" | "long";
  greetingStyle?: string;
  recommendationStyle?: string;
  wordsToUse?: string[];
  wordsToAvoid?: string[];
  generalServiceNotes?: string;
}

export interface ChannelInstructions {
  /** e.g. web | email | sms | facebook | instagram */
  channel: string;
  text?: string;
}

export interface WorkspaceBranding {
  storeName: string;
  agentName: string;
  widgetColor: string;
  storePublicDomain?: string;
  contactEmail?: string;
  contactPhone?: string;
  welcomeMessage?: string;
}

export interface WorkspaceBusinessHours {
  timezone: string;
  days: number[];
  start: string;
  end: string;
  /** Whether human agents may be offered for handoff. */
  agentsAvailable: boolean;
}

export interface WorkspaceCoupon {
  code: string;
  description: string;
  percentOff?: number;
  minSubtotal?: number;
  freeShipping?: boolean;
}

export interface WorkspaceCommerceConfig {
  /**
   * Coupons the bot may confirm. Empty = do not invent codes.
   * Future: Agentra / connected store will supply this.
   */
  knownCoupons: WorkspaceCoupon[];
  returnWindowDays: number;
}

/**
 * Knowledge / policy source. Today: local files under data/knowledge/{workspaceId}.
 * Future: Agentra pushes store policies here (`mode: "agentra"`).
 */
export interface WorkspaceKnowledgeConfig {
  mode: "local_files" | "inline" | "agentra";
  /** Used when mode is inline (tests / future Agentra payload). */
  inlineDocs?: Array<{
    id: string;
    title: string;
    tags: string[];
    body: string;
  }>;
}

export interface WorkspaceConfig {
  workspaceId: string;
  branding: WorkspaceBranding;
  businessHours: WorkspaceBusinessHours;
  features: WorkspaceFeatureFlags;
  commerce: WorkspaceCommerceConfig;
  knowledge: WorkspaceKnowledgeConfig;
  ownerInstructions?: StoreOwnerInstructions;
  channelInstructions?: ChannelInstructions[];
  /**
   * When true, the custom-commerce sandbox may expose demo catalog/coupons.
   * Always false for Shopify/Woo / production Agentra workspaces.
   */
  allowDemoSandboxData: boolean;
  /** Provenance for debugging — never shown to customers. */
  source: "local_env" | "local_file" | "agentra";
}

/**
 * Swap this to connect Agentra later. Must not change the conversation engine.
 */
export interface WorkspaceConfigProvider {
  getConfig(workspaceId: string): Promise<WorkspaceConfig> | WorkspaceConfig;
}
