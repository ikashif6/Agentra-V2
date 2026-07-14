export type Role = "owner" | "admin" | "agent" | "customer";
export type TicketStatus = "open" | "in_progress" | "on_hold" | "resolved" | "closed" | "self_closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketSource =
  | "portal"
  | "email"
  | "chat"
  | "chatbot"
  | "instagram"
  | "facebook"
  | "whatsapp";
export type InboxFolder = "inbox" | "snoozed" | "trash" | "spam";
export type InboxView = "assigned" | "all" | "snoozed" | "closed" | "trash" | "spam";
export type LiveChatView = "queue" | "assigned" | "closed" | "trash";
/** @deprecated Use LiveChatView */
export type AiAgentView = LiveChatView;
export type ConversationScope = "inbox" | "live_chat" | "ai_agents";
export type ConversationView = InboxView | LiveChatView;

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: Role;
  avatar?: string;
  company: string | Company;
  isEmailVerified: boolean;
  isActive: boolean;
  isOnline?: boolean;
  onboardingCompleted?: boolean;
  jobTitle?: string;
  bio?: string;
  lastLoginAt?: string;
  preferences?: {
    timezone?: string;
    dateFormat?: "DMY" | "MDY";
    timeFormat?: "12h" | "24h";
    locale?: string;
    theme?: "light" | "dark" | "system";
    notifications?: {
      email?: boolean;
      browser?: boolean;
      volume?: number;
      rules?: Record<string, { sound?: string; browser?: boolean }>;
    };
  };
}

export type StoreProvider = "shopify" | "woocommerce" | "custom";

export type StoreIntegrationStatus = "disconnected" | "pending" | "connected" | "error";

export interface StoreSyncSettings {
  syncOrders: boolean;
  syncCustomers: boolean;
  syncProducts: boolean;
}

export interface FacebookPendingPage {
  id: string;
  name: string;
  category?: string;
  pictureUrl?: string;
}

export type ChannelIntegrationStatus = "disconnected" | "pending" | "connected" | "error";

export interface FacebookChannelIntegration {
  status: ChannelIntegrationStatus;
  connectedAt?: string | null;
  lastError?: string | null;
  pageId?: string | null;
  pageName?: string | null;
  pagePictureUrl?: string | null;
  hasPageAccessToken?: boolean;
  pendingPages?: FacebookPendingPage[];
}

export interface InstagramPendingAccount {
  igUserId: string;
  igUsername?: string;
  igPictureUrl?: string;
  pageId?: string;
  pageName?: string;
}

export interface InstagramChannelIntegration {
  status: ChannelIntegrationStatus;
  connectedAt?: string | null;
  lastError?: string | null;
  igUserId?: string | null;
  igUsername?: string | null;
  igPictureUrl?: string | null;
  pageId?: string | null;
  pageName?: string | null;
  hasPageAccessToken?: boolean;
  pendingAccounts?: InstagramPendingAccount[];
}

export interface WhatsAppChannelIntegration {
  status: ChannelIntegrationStatus;
  connectedAt?: string | null;
  lastError?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  hasAccessToken?: boolean;
}

export interface WhatsAppEmbeddedSignupConfig {
  appId: string;
  configId: string;
  graphVersion: string;
  configured: boolean;
}

export interface EmailChannelIntegration {
  status: ChannelIntegrationStatus;
  provider?: "imap" | "google" | "microsoft" | null;
  address?: string | null;
  displayName?: string | null;
  outboundVia?: "smtp" | "resend" | null;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  imap?: {
    host?: string | null;
    port?: number | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
  } | null;
}

export interface EmailProviderSupport {
  imap: boolean;
  google: boolean;
  microsoft: boolean;
}

export interface StoreIntegration {
  provider: StoreProvider | null;
  status: StoreIntegrationStatus;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  webhooksRegistered?: boolean;
  shopify?: {
    shopDomain?: string;
    shopName?: string;
    scope?: string;
    hasAccessToken?: boolean;
  };
  woocommerce?: {
    storeUrl?: string;
    storeName?: string;
    hasCredentials?: boolean;
  };
  custom?: {
    storeUrl?: string;
    storeName?: string;
    hasApiKey?: boolean;
    webhookSecret?: string;
    supportedActions?: string[];
    features?: {
      conversion?: boolean;
      edit?: boolean;
    };
  };
  syncSettings: StoreSyncSettings;
}

export interface ChatKnowledgeArticle {
  _id: string;
  title: string;
  content: string;
  category?: string;
  active?: boolean;
}

export interface LiveChatAgent {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  role?: Role;
  isOnline?: boolean;
  initials: string;
  color: string;
}

export interface LiveChatSettings {
  enabled: boolean;
  widgetKey?: string | null;
  widgetInstalled?: boolean;
  installMethod?: 'shopify_script' | 'manual' | null;
  canAutoInstall?: boolean;
  shopifyAutoInstallPending?: boolean;
  /** Actual scopes on the connected Shopify access token */
  shopifyGrantedScope?: string | null;
  storeProvider?: string | null;
  storeConnected?: boolean;
  allowedOrigins?: string[];
  appearance: {
    brandColor: string;
    backgroundColor?: string;
    fontFamily: string;
    logoUrl?: string;
    faviconUrl?: string;
    logoSize?: string;
    logoWidth?: number;
    logoHeight?: number;
    position?: string;
    launcherOffsetX?: number;
    launcherOffsetY?: number;
    showBranding?: boolean;
  };
  content: {
    storeDisplayName?: string;
    agentName?: string;
    welcomeTitle?: string;
    welcomeSubtitle?: string;
    welcomeMessage?: string;
    emailGateTitle?: string;
    emailGateSubtitle?: string;
    offlineMessage?: string;
    quickReplies?: string[];
  };
  behavior: {
    typingIndicator?: boolean;
    retrievalIndicator?: boolean;
    requireEmailBeforeChat?: boolean;
    requireOrderVerification?: boolean;
    handoffOnlyInBusinessHours?: boolean;
  };
  ai: {
    enabled?: boolean;
    instructions?: string;
    escalationKeywords?: string[];
    allowedActions: {
      lookupOrder?: boolean;
      cancelOrder?: boolean;
      refundOrder?: boolean;
      maxRefundAmount?: number;
      editOrder?: boolean;
      productRecommendations?: boolean;
      requestHuman?: boolean;
    };
  };
  /** Human agents for live chat (widget faces + portal assign) */
  agents?: LiveChatAgent[];
  connectedAt?: string | null;
  lastError?: string | null;
  embedSnippet?: string | null;
}

export interface StoreOrderLineItem {
  externalId?: string;
  title?: string;
  variantTitle?: string;
  sku?: string;
  quantity?: number;
  fulfillableQuantity?: number;
  price?: number;
  imageUrl?: string;
  grams?: number;
}

export interface StoreOrderFulfillment {
  status?: string;
  trackingCompany?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
}

export interface StoreOrderAddress {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface StoreOrder {
  _id: string;
  provider: StoreProvider;
  externalId: string;
  orderNumber?: string;
  name?: string;
  currency?: string;
  totalPrice?: number;
  subtotalPrice?: number;
  totalShipping?: number;
  totalTax?: number;
  shippingLines?: { title?: string; price?: number }[];
  taxLines?: { title?: string; rate?: number; price?: number }[];
  totalWeightGrams?: number;
  financialStatus?: string;
  fulfillmentStatus?: string;
  channel?: string;
  tags?: string[];
  note?: string;
  itemCount?: number;
  onHold?: boolean;
  shippingMethod?: string;
  fulfillmentService?: string;
  closedAt?: string;
  customer?: {
    externalId?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  shippingAddress?: StoreOrderAddress;
  billingAddress?: StoreOrderAddress;
  lineItems?: StoreOrderLineItem[];
  fulfillments?: StoreOrderFulfillment[];
  statusUrl?: string;
  adminUrl?: string;
  placedAt?: string;
}

export interface StoreOrderTimelineEvent {
  id: string;
  at: string;
  type: string;
  message: string;
}

export interface StoreOrderConversionHighlight {
  id: string;
  icon: "order" | "session" | "chart";
  text: string;
}

export interface StoreOrderConversionSession {
  id: string;
  occurredAt?: string;
  landingPage?: string | null;
  referrerUrl?: string | null;
  source?: string | null;
  sourceDescription?: string | null;
  sourceType?: string | null;
  utmParameters?: {
    campaign?: string | null;
    content?: string | null;
    medium?: string | null;
    source?: string | null;
    term?: string | null;
  } | null;
  visitLabel?: string;
  firstPageLabel?: string | null;
  rowLabel?: string;
}

export interface StoreOrderConversion {
  ready: boolean;
  customerOrderIndex?: number | null;
  daysToConversion?: number | null;
  totalSessions?: number | null;
  highlights: StoreOrderConversionHighlight[];
  sessions: StoreOrderConversionSession[];
  firstVisit?: StoreOrderConversionSession | null;
  lastVisit?: StoreOrderConversionSession | null;
  fallback?: boolean;
}

export interface Company {
  _id: string;
  name: string;
  subdomain: string;
  logo?: string;
  timezone?: string;
  branding?: {
    primaryColor?: string;
    theme?: "light" | "dark" | "system";
  };
  plan: { name: string; status: string; trialEndsAt?: string };
  settings?: {
    ticketPrefix?: string;
    defaultTicketPriority?: TicketPriority;
  };
  helpCenterDomain?: string;
  helpCenterDomainVerified?: boolean;
  storeIntegration?: StoreIntegration;
}

export interface HelpCenterFeatures {
  contactForm: boolean;
  raiseTicket: boolean;
  ticketTracking: boolean;
  search: boolean;
}

export type HelpCenterLayout = "classic" | "sidebar" | "cards";

export interface HelpCenter {
  _id: string;
  company: string;
  company_subdomain: string;
  layout: HelpCenterLayout;
  title: string;
  subtitle: string;
  primaryColor: string;
  logoUrl?: string;
  features: HelpCenterFeatures;
  customDomain?: string;
  customDomainVerified: boolean;
  domainVerificationToken?: string;
  isPublished: boolean;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  url: string;
  filename: string;
  mimetype?: string;
  size?: number;
}

export interface TicketMessage {
  _id: string;
  sender: User;
  senderEmail?: string;
  body: string;
  attachments: Attachment[];
  isInternal: boolean;
  sentAt: string;
}

export interface TicketPerson {
  user: User;
  role: "customer" | "agent" | "cc";
  addedAt: string;
}

export interface TicketDetails {
  contactReason?: string;
  product?: string;
  resolution?: string;
  customerType?: string;
  customerNote?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface Ticket {
  _id: string;
  ticket_code: string;
  company_subdomain: string;
  ticket_title: string;
  ticket_description: string;
  priority: TicketPriority;
  status: TicketStatus;
  inboxFolder?: InboxFolder;
  snoozedUntil?: string | null;
  source?: TicketSource;
  tags?: string[];
  isUnread?: boolean;
  details?: TicketDetails;
  department?: Department | string;
  teams?: Array<Team | string>;
  attachments: Attachment[];
  peoples: TicketPerson[];
  assigned_agent?: User;
  messages: TicketMessage[];
  createdBy: User;
  lastActivity: string;
  closedAt?: string;
  createdAt: string;
}

export interface Department {
  _id: string;
  name: string;
  description?: string;
  heads: User[];
  company: string;
  isActive: boolean;
  createdAt: string;
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
  department: Department | string;
  teamLead: User;
  members: Array<{ user: User; invitedBy?: User; joinedAt: string }>;
  company: string;
  isActive: boolean;
  createdAt: string;
}

export interface Plan {
  plan_id: string;
  name: string;
  maxUsers: number;
  maxAgents: number;
  maxTickets: number;
  maxDepartments: number;
  maxTeams: number;
  features: {
    customDomain: boolean;
    slaManagement: boolean;
    advancedReporting: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
