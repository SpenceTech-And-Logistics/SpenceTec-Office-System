async function req(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j?.error || "Request failed"); e.status = r.status; throw e; }
  return j;
}
export const api = {
  me: () => req("GET", "/api/me"),
  requestCode: (email) => req("POST", "/api/auth/request", { email }),
  verify: (email, code) => req("POST", "/api/auth/verify", { email, code }),
  logout: () => req("POST", "/api/auth/logout"),
  clients: () => req("GET", "/api/clients"),
  saveClient: (id, data) => req("PUT", `/api/clients/${encodeURIComponent(id)}`, data),
  patchClient: (id, data) => req("PATCH", `/api/clients/${encodeURIComponent(id)}`, data),
  deleteClient: (id) => req("DELETE", `/api/clients/${encodeURIComponent(id)}`),
  users: () => req("GET", "/api/users"),
  addUser: (email, name) => req("POST", "/api/users", { email, name }),
  removeUser: (email) => req("DELETE", `/api/users/${encodeURIComponent(email)}`),
};
