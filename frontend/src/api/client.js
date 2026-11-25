const API_BASE = import.meta.env.VITE_API_URL || "";

export function getStoredToken() {
  return localStorage.getItem("supportdesk_token");
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem("supportdesk_token", token);
  } else {
    localStorage.removeItem("supportdesk_token");
  }
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Unable to connect to the server. Please verify the backend is running.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Request failed with status ${response.status}`);
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/users/me"),

  // Orders
  listOrders: () => request("/api/orders"),
  getOrder: (id) => request(`/api/orders/${encodeURIComponent(id)}`),

  // Tickets & Chat
  listTickets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.priority) query.set("priority", params.priority);
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    return request(`/api/tickets${qs ? `?${qs}` : ""}`);
  },
  createTicket: (payload) => request("/api/tickets", { method: "POST", body: JSON.stringify(payload) }),
  getTicket: (id) => request(`/api/tickets/${id}`),
  updateTicketStaff: (id, payload) => request(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  sendMessage: (ticketId, content) =>
    request(`/api/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  // Refunds
  listRefunds: () => request("/api/refunds"),
  createRefund: (payload, idempotencyKey) =>
    request("/api/refunds", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify(payload),
    }),
  reviewRefund: (refundId, payload) =>
    request(`/api/refunds/${refundId}/review`, { method: "POST", body: JSON.stringify(payload) }),

  // Escalations & Audit
  listEscalations: (decision) =>
    request(`/api/escalations${decision ? `?decision=${encodeURIComponent(decision)}` : ""}`),
  reviewEscalation: (id, payload) =>
    request(`/api/escalations/${id}/review`, { method: "POST", body: JSON.stringify(payload) }),
  addEscalationNote: (id, internalNote) =>
    request(`/api/escalations/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ internal_note: internalNote }),
    }),
  listAuditLogs: () => request("/api/audit-logs"),
};
