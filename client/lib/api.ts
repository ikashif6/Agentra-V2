import axios, { AxiosError } from "axios";
import Cookies from "js-cookie";
import type { StoreOrderAddress, StoreProvider, StoreSyncSettings } from "./types";
import { API_BASE, FACEBOOK_API_BASE } from "./constants";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = Cookies.get("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Attach subdomain tenant header if stored
  const subdomain = Cookies.get("subdomain");
  if (subdomain) config.headers["x-tenant"] = subdomain;

  return config;
});

// Auth routes that return 401 for invalid credentials — never trigger token refresh.
const AUTH_NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/magic-link/verify",
  "/auth/otp/verify",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/accept-invite",
];

function shouldSkipTokenRefresh(url?: string) {
  if (!url) return false;
  return AUTH_NO_REFRESH_PATHS.some((path) => url.includes(path));
}

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let refreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (shouldSkipTokenRefresh(original.url)) {
        return Promise.reject(error);
      }

      original._retry = true;

      const refreshToken = Cookies.get("refreshToken");
      if (!refreshToken) {
        return Promise.reject(error);
      }

      if (refreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers!.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      refreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
        const newAccess = data.data.accessToken;
        const newRefresh = data.data.refreshToken;

        Cookies.set("accessToken", newAccess, { expires: 7, sameSite: "lax" });
        Cookies.set("refreshToken", newRefresh, { expires: 30, sameSite: "lax" });

        refreshQueue.forEach((cb) => cb(newAccess));
        refreshQueue = [];

        original.headers!.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        Cookies.remove("accessToken");
        Cookies.remove("refreshToken");
        Cookies.remove("subdomain");
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/auth/")
        ) {
          window.location.href = "/auth/login";
        }
        return Promise.reject(error);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ─────────────────────────────────────────────────────────

export const authApi = {
  login: (data: { email: string; password: string; workspace?: string }) =>
    api.post("/auth/login", data, {
      headers: data.workspace ? { "x-tenant": data.workspace } : undefined,
    }),
  requestMagicLink: (data: { email: string }) =>
    api.post("/auth/magic-link/request", data),
  verifyMagicLink: (data: { token: string }) =>
    api.post("/auth/magic-link/verify", data),
  acceptInvite: (data: { token: string; password?: string }) =>
    api.post("/auth/accept-invite", data),
  requestOtp: (data: { email: string }) =>
    api.post("/auth/otp/request", data),
  verifyOtp: (data: { email: string; otp: string }) =>
    api.post("/auth/otp/verify", data),
  forgotPassword: (data: { email: string }) =>
    api.post("/auth/forgot-password", data),
  resetPassword: (data: { token: string; password: string }) =>
    api.post("/auth/reset-password", data),
  me: () => api.get("/auth/me"),
  verifyEmail: (data: { token: string }) => api.post("/auth/verify-email", data),
  logout: (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
};

export const onboardingApi = {
  getPlans: () => api.get("/onboarding/plans"),
  onboard: (data: Record<string, unknown>) => api.post("/onboarding", data),
  completeSetup: (data: Record<string, unknown>) => api.post("/onboarding/setup", data),
  checkSubdomain: (subdomain: string) =>
    api.get(`/auth/check-subdomain/${subdomain}`),
};

export const ticketApi = {
  list: (params?: Record<string, unknown>) => api.get("/tickets", { params }),
  get: (code: string) => api.get(`/tickets/${code}`),
  create: (data: Record<string, unknown>) => api.post("/tickets", data),
  update: (code: string, data: Record<string, unknown>) =>
    api.patch(`/tickets/${code}`, data),
  close: (code: string) => api.post(`/tickets/${code}/close`),
  reopen: (code: string) => api.post(`/tickets/${code}/reopen`),
  addMessage: (code: string, data: Record<string, unknown>) =>
    api.post(`/tickets/${code}/messages`, data),
  addPerson: (code: string, data: Record<string, unknown>) =>
    api.post(`/tickets/${code}/peoples`, data),
  removePerson: (code: string, userId: string) =>
    api.delete(`/tickets/${code}/peoples/${userId}`),
  trackRequest: (data: Record<string, unknown>) =>
    api.post("/tickets/track/request", data),
  trackVerify: (data: Record<string, unknown>) =>
    api.post("/tickets/track/verify", data),
  dashboardStats: () => api.get("/tickets/stats/dashboard"),
  inboxCounts: (scope?: "inbox" | "live_chat" | "ai_agents") =>
    api.get("/tickets/inbox/counts", { params: scope ? { scope } : {} }),
  createDemo: () => api.post("/tickets/demo"),
};

export const uploadApi = {
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return api.post("/uploads", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const departmentApi = {
  list: (params?: Record<string, unknown>) => api.get("/departments", { params }),
  get: (id: string) => api.get(`/departments/${id}`),
  create: (data: Record<string, unknown>) => api.post("/departments", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
  addHead: (id: string, userId: string) =>
    api.post(`/departments/${id}/heads`, { userId }),
  removeHead: (id: string, userId: string) =>
    api.delete(`/departments/${id}/heads/${userId}`),
  createTeam: (deptId: string, data: Record<string, unknown>) =>
    api.post(`/departments/${deptId}/teams`, data),
  listTeams: (deptId: string) => api.get(`/departments/${deptId}/teams`),
};

export const teamApi = {
  list: (params?: Record<string, unknown>) => api.get("/teams", { params }),
  get: (id: string) => api.get(`/teams/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  addMember: (id: string, userId: string) =>
    api.post(`/teams/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/teams/${id}/members/${userId}`),
};

export const usersApi = {
  listWorkspace: (search = "", page = 1, limit = 20) =>
    api.get("/users/workspace", { params: { search, page, limit } }),
  searchStaff: (search = "", page = 1, limit = 20) =>
    api.get("/users/staff", { params: { search, page, limit } }),
  searchMembers: (search = "", role?: string, page = 1, limit = 30) =>
    api.get("/users/members", { params: { search, role, page, limit } }),
  invite: (data: { email: string; role: string; firstName: string; lastName: string }) =>
    api.post("/users/invite", data),
  update: (
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: "agent" | "admin";
      jobTitle?: string;
    },
  ) => api.patch(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export const billingApi = {
  getOverview: () => api.get("/billing"),
  cancelPlan: () => api.post("/billing/cancel"),
  reactivatePlan: () => api.post("/billing/reactivate"),
};

export const activityLogApi = {
  list: (params: {
    actorId?: string;
    event?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => api.get("/activity-logs", { params }),
};

export const workspaceApi = {
  getBranding: () => api.get("/workspace/branding"),
  updateBranding: (data: {
    primaryColor?: string;
    theme?: "light" | "dark" | "system";
    logo?: string | null;
  }) => api.patch("/workspace/branding", data),
};

export const notificationsApi = {
  getSettings: () => api.get("/notifications"),
  updateSettings: (data: {
    volume?: number;
    rules?: Record<string, { sound?: string; browser?: boolean }>;
  }) => api.patch("/notifications", data),
};

export const businessHoursApi = {
  get: () => api.get("/business-hours"),
  updateDefault: (data: {
    enabled?: boolean;
    timezone?: string;
    schedule?: Record<string, unknown>;
  }) => api.put("/business-hours/default", data),
  createCustom: (data: {
    name: string;
    targets?: string[];
    timezone: string;
    schedule: Record<string, unknown>;
  }) => api.post("/business-hours/custom", data),
  updateCustom: (
    id: string,
    data: {
      name?: string;
      targets?: string[];
      timezone?: string;
      schedule?: Record<string, unknown>;
    },
  ) => api.patch(`/business-hours/custom/${id}`, data),
  deleteCustom: (id: string) => api.delete(`/business-hours/custom/${id}`),
};

export const facebookChannelApi = {
  getStatus: () => api.get("/channels/facebook", { baseURL: FACEBOOK_API_BASE }),
  getOAuthUrl: (returnOrigin?: string) =>
    api.get("/channels/facebook/oauth/url", {
      baseURL: FACEBOOK_API_BASE,
      params: returnOrigin ? { returnOrigin } : undefined,
    }),
  connectPage: (pageId: string) =>
    api.post("/channels/facebook/connect", { pageId }, { baseURL: FACEBOOK_API_BASE }),
  disconnect: () => api.delete("/channels/facebook", { baseURL: FACEBOOK_API_BASE }),
};

export const instagramChannelApi = {
  getStatus: () => api.get("/channels/instagram", { baseURL: FACEBOOK_API_BASE }),
  getOAuthUrl: (returnOrigin?: string) =>
    api.get("/channels/instagram/oauth/url", {
      baseURL: FACEBOOK_API_BASE,
      params: returnOrigin ? { returnOrigin } : undefined,
    }),
  connectAccount: (igUserId: string) =>
    api.post("/channels/instagram/connect", { igUserId }, { baseURL: FACEBOOK_API_BASE }),
  disconnect: () => api.delete("/channels/instagram", { baseURL: FACEBOOK_API_BASE }),
};

export const whatsappChannelApi = {
  getStatus: () => api.get("/channels/whatsapp", { baseURL: FACEBOOK_API_BASE }),
  getConfig: () => api.get("/channels/whatsapp/config", { baseURL: FACEBOOK_API_BASE }),
  connect: (payload: { code: string; wabaId: string; phoneNumberId: string }) =>
    api.post("/channels/whatsapp/connect", payload, { baseURL: FACEBOOK_API_BASE }),
  disconnect: () => api.delete("/channels/whatsapp", { baseURL: FACEBOOK_API_BASE }),
};

export const emailChannelApi = {
  getStatus: () => api.get("/channels/email"),
  guess: (email: string) => api.get("/channels/email/guess", { params: { email } }),
  connect: (payload: {
    email: string;
    password: string;
    displayName?: string;
    preset?: string;
    imapHost?: string;
    imapPort?: number;
    imapSecure?: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
  }) => api.post("/channels/email/connect", payload, { timeout: 90000 }),
  disconnect: () => api.delete("/channels/email"),
};

export const storeApi = {
  getStatus: () => api.get("/store"),
  connect: (data: {
    provider: StoreProvider;
    credentials: Record<string, string | undefined>;
    syncSettings?: Partial<StoreSyncSettings>;
  }) => api.post("/store/connect", data),
  shopifyOAuthUrl: (shopDomain: string) =>
    api.get("/store/shopify/oauth/url", {
      params: {
        shopDomain,
        returnOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    }),
  wooOAuthUrl: (storeUrl: string) =>
    api.get("/store/woocommerce/oauth/url", {
      params: {
        storeUrl,
        returnOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    }),
  updateSettings: (data: { syncSettings: StoreSyncSettings }) =>
    api.patch("/store/settings", data),
  testConnection: () => api.post("/store/test"),
  syncNow: () => api.post("/store/sync"),
  listOrders: (params: { email?: string; phone?: string; limit?: number }) =>
    api.get("/store/orders", { params }),
  getOrder: (orderId: string) => api.get(`/store/orders/${orderId}`),
  updateOrder: (
    orderId: string,
    payload: {
      note?: string;
      tags?: string[];
      email?: string;
      updateCustomerProfile?: boolean;
      shippingAddress?: StoreOrderAddress;
      billingAddress?: StoreOrderAddress;
    },
  ) => api.patch(`/store/orders/${orderId}`, payload),
  runOrderAction: (
    orderId: string,
    payload: {
      action: string;
      message?: string;
      email?: string;
      reason?: string;
      restock?: boolean;
      notifyCustomer?: boolean;
      trackingNumber?: string;
      trackingCompany?: string;
      trackingUrl?: string;
    },
  ) => api.post(`/store/orders/${orderId}/actions`, payload),
  cancelOrder: (
    orderId: string,
    payload?: { reason?: string; restock?: boolean; notifyCustomer?: boolean },
  ) => api.post(`/store/orders/${orderId}/cancel`, payload ?? {}),
  fulfillOrder: (
    orderId: string,
    payload?: {
      trackingNumber?: string;
      trackingCompany?: string;
      trackingUrl?: string;
      notifyCustomer?: boolean;
    },
  ) => api.post(`/store/orders/${orderId}/fulfill`, payload ?? {}),
  disconnect: () => api.delete("/store"),
};

export const helpCenterApi = {
  getSettings: () => api.get("/helpcenter/settings"),
  saveSettings: (data: Record<string, unknown>) => api.post("/helpcenter/settings", data),
  connectDomain: (domain: string) => api.post("/helpcenter/domain", { domain }),
  verifyDomain: () => api.post("/helpcenter/domain/verify"),
  disconnectDomain: () => api.delete("/helpcenter/domain"),
  // Public (no auth needed — pass subdomain via header for dev)
  getPublic: (subdomain: string) =>
    api.get("/helpcenter/public", { headers: { "x-helpcenter-subdomain": subdomain } }),
  submitContact: (subdomain: string, data: Record<string, unknown>) =>
    api.post("/helpcenter/public/contact", data, {
      headers: { "x-helpcenter-subdomain": subdomain },
    }),
};
