import axios, { AxiosError } from "axios";
import Cookies from "js-cookie";
import { API_BASE } from "./constants";

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

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let refreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

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
        const refreshToken = Cookies.get("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

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
        if (typeof window !== "undefined") window.location.href = "/auth/login";
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
    api.post("/auth/login", data),
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
  logout: (refreshToken: string) => api.post("/auth/logout", { refreshToken }),
};

export const onboardingApi = {
  getPlans: () => api.get("/onboarding/plans"),
  onboard: (data: Record<string, unknown>) => api.post("/onboarding", data),
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
  searchStaff: (search = "", page = 1, limit = 20) =>
    api.get("/users/staff", { params: { search, page, limit } }),
  searchMembers: (search = "", role?: string, page = 1, limit = 30) =>
    api.get("/users/members", { params: { search, role, page, limit } }),
  invite: (data: { email: string; role: string; firstName: string; lastName: string }) =>
    api.post("/users/invite", data),
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
