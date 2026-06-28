export type Role = "owner" | "admin" | "agent" | "customer";
export type TicketStatus = "open" | "in_progress" | "on_hold" | "resolved" | "closed" | "self_closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

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
  jobTitle?: string;
  lastLoginAt?: string;
}

export interface Company {
  _id: string;
  name: string;
  subdomain: string;
  logo?: string;
  plan: { name: string; status: string; trialEndsAt?: string };
  settings?: {
    ticketPrefix?: string;
    defaultTicketPriority?: TicketPriority;
  };
  helpCenterDomain?: string;
  helpCenterDomainVerified?: boolean;
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

export interface Ticket {
  _id: string;
  ticket_code: string;
  company_subdomain: string;
  ticket_title: string;
  ticket_description: string;
  priority: TicketPriority;
  status: TicketStatus;
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
