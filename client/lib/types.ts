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
  };
  syncSettings: StoreSyncSettings;
}

export interface StoreOrderLineItem {
  title?: string;
  variantTitle?: string;
  sku?: string;
  quantity?: number;
  price?: number;
  imageUrl?: string;
}

export interface StoreOrderFulfillment {
  status?: string;
  trackingCompany?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
}

export interface StoreOrder {
  _id: string;
  provider: StoreProvider;
  externalId: string;
  orderNumber?: string;
  name?: string;
  currency?: string;
  totalPrice?: number;
  financialStatus?: string;
  fulfillmentStatus?: string;
  customer?: {
    externalId?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  lineItems?: StoreOrderLineItem[];
  fulfillments?: StoreOrderFulfillment[];
  statusUrl?: string;
  adminUrl?: string;
  placedAt?: string;
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
