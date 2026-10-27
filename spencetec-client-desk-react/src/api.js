async function req(method, path, body, raw, poll) {
  const headers = raw ? { "content-type": raw.type || "application/octet-stream" } : body ? { "content-type": "application/json" } : {};
  if (poll) headers["x-poll"] = "1"; // background refresh: doesn't keep a sign-in alive
  const r = await fetch(path, {
    method,
    headers,
    body: raw ? raw : body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j?.error || "Request failed"); e.status = r.status; e.expired = !!j?.expired; throw e; }
  return j;
}
const e = encodeURIComponent;
export const api = {
  me: () => req("GET", "/api/me"),
  ping: () => req("POST", "/api/ping"),
  requestCode: (email) => req("POST", "/api/auth/request", { email }),
  verify: (email, code) => req("POST", "/api/auth/verify", { email, code }),
  logout: () => req("POST", "/api/auth/logout"),
  passwordLogin: (username, password) => req("POST", "/api/auth/password", { username, password }),
  changePassword: (current, password) => req("POST", "/api/auth/change-password", { current, password }),

  clients: (poll) => req("GET", "/api/clients", null, null, poll),
  saveClient: (id, data) => req("PUT", `/api/clients/${e(id)}`, data),
  patchClient: (id, data) => req("PATCH", `/api/clients/${e(id)}`, data),
  deleteClient: (id) => req("DELETE", `/api/clients/${e(id)}`),

  files: (id) => req("GET", `/api/clients/${e(id)}/files`),
  upload: (id, kind, file) => req("POST", `/api/clients/${e(id)}/files?kind=${kind}&name=${e(file.name)}`, null, file),
  deleteFile: (fid) => req("DELETE", `/api/files/${e(fid)}`),

  invoices: (poll) => req("GET", "/api/invoices", null, null, poll),
  createInvoice: (data) => req("POST", "/api/invoices", data),
  patchInvoice: (id, data) => req("PATCH", `/api/invoices/${e(id)}`, data),
  deleteInvoice: (id) => req("DELETE", `/api/invoices/${e(id)}`),

  settings: () => req("GET", "/api/settings"),
  saveSettings: (data) => req("PUT", "/api/settings", data),

  users: () => req("GET", "/api/users"),
  addUser: (email, name, role) => req("POST", "/api/users", { email, name, role }),
  addUsername: (username, name) => req("POST", "/api/users", { username, name }),
  resetPassword: (id) => req("PATCH", `/api/users/${e(id)}`, { resetPassword: true }),
  patchUser: (email, data) => req("PATCH", `/api/users/${e(email)}`, data),
  removeUser: (email) => req("DELETE", `/api/users/${e(email)}`),
};
export const fileUrl = (fid, download) => `/api/files/${e(fid)}${download ? "?download=1" : ""}`;
