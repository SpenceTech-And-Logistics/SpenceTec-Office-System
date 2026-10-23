async function req(method, path, body, raw) {
  const r = await fetch(path, {
    method,
    headers: raw ? { "content-type": raw.type || "application/octet-stream" } : body ? { "content-type": "application/json" } : {},
    body: raw ? raw : body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j?.error || "Request failed"); e.status = r.status; throw e; }
  return j;
}
const e = encodeURIComponent;
export const api = {
  me: () => req("GET", "/api/me"),
  requestCode: (email) => req("POST", "/api/auth/request", { email }),
  verify: (email, code) => req("POST", "/api/auth/verify", { email, code }),
  logout: () => req("POST", "/api/auth/logout"),

  clients: () => req("GET", "/api/clients"),
  saveClient: (id, data) => req("PUT", `/api/clients/${e(id)}`, data),
  patchClient: (id, data) => req("PATCH", `/api/clients/${e(id)}`, data),
  deleteClient: (id) => req("DELETE", `/api/clients/${e(id)}`),

  files: (id) => req("GET", `/api/clients/${e(id)}/files`),
  upload: (id, kind, file) => req("POST", `/api/clients/${e(id)}/files?kind=${kind}&name=${e(file.name)}`, null, file),
  deleteFile: (fid) => req("DELETE", `/api/files/${e(fid)}`),

  invoices: () => req("GET", "/api/invoices"),
  createInvoice: (data) => req("POST", "/api/invoices", data),
  patchInvoice: (id, data) => req("PATCH", `/api/invoices/${e(id)}`, data),
  deleteInvoice: (id) => req("DELETE", `/api/invoices/${e(id)}`),

  settings: () => req("GET", "/api/settings"),
  saveSettings: (data) => req("PUT", "/api/settings", data),

  users: () => req("GET", "/api/users"),
  addUser: (email, name, role) => req("POST", "/api/users", { email, name, role }),
  patchUser: (email, data) => req("PATCH", `/api/users/${e(email)}`, data),
  removeUser: (email) => req("DELETE", `/api/users/${e(email)}`),
};
export const fileUrl = (fid, download) => `/api/files/${e(fid)}${download ? "?download=1" : ""}`;
