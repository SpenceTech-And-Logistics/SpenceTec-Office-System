export const STAGES = [["enquiry","Enquiry"],["design","Design"],["build","Build"],["review","Review"],["live","Live"],["maintenance","Maintenance"]];
export const CONTENT = [["none","Not received"],["partial","Partial"],["full","Received"]];
export const ACTIVE = ["design", "build", "review"];

const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
export const today = () => iso(new Date());
export const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

export const kes = (n) => "KES " + Math.round(n || 0).toLocaleString("en-KE");
export const stageName = (k) => (STAGES.find((s) => s[0] === k) || [, k])[1];
export const contentName = (k) => (CONTENT.find((s) => s[0] === k) || [, "Not received"])[1];
export const uid = () => Math.random().toString(36).slice(2, 9);
export const slug = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";

export const tasksOf = (c) => c.tasks || [];
export const paysOf = (c) => c.payments || [];
export const openTasks = (c) => tasksOf(c).filter((t) => !t.done);
export const overdue = (c) => openTasks(c).filter((t) => t.due && t.due < today());
export const owed = (c) => paysOf(c).filter((p) => p.status !== "paid").reduce((a, p) => a + (+p.amount || 0), 0);
export const paid = (c) => paysOf(c).filter((p) => p.status === "paid").reduce((a, p) => a + (+p.amount || 0), 0);

export const allTasks = (clients) => clients.flatMap((c) => tasksOf(c).map((t) => ({ c, t })));
export const allPays = (clients) => clients.flatMap((c) => paysOf(c).map((p) => ({ c, p })));
export const byDue = (a, b) => (a.t.due || "9999").localeCompare(b.t.due || "9999");

export function fmtDate(d) {
  if (!d) return "";
  const x = new Date(d + "T00:00:00");
  if (isNaN(x)) return d;
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

// "Overdue 3 days", "Due today", "Due tomorrow", "Due 14 Nov"
export function dueLabel(d) {
  if (!d) return "No date";
  const t = today();
  if (d === t) return "Due today";
  if (d === daysFromNow(1)) return "Due tomorrow";
  if (d < t) {
    const n = Math.round((new Date(t) - new Date(d)) / 86400000);
    return `Overdue ${n} day${n === 1 ? "" : "s"}`;
  }
  return "Due " + fmtDate(d);
}

// SQLite "YYYY-MM-DD HH:MM:SS" (UTC) -> "5 min ago"
export function ago(s) {
  if (!s) return "";
  const t = new Date(s.replace(" ", "T") + "Z");
  if (isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return t.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const href = (v) => (!v ? "" : /^https?:\/\//.test(v) ? v : "https://" + v);

/* ---------- roles ---------- */
export const ROLES = [["owner", "Owner"], ["secretary", "Secretary"], ["sales", "Sales rep"]];
export const roleName = (k) => (ROLES.find((r) => r[0] === k) || [, k])[1];
export const ROLE_HELP = {
  owner: "Everything, plus team roles, company settings and deleting clients.",
  secretary: "All clients, project details, tasks, invoices and payments. Can add clients.",
  sales: "Registers their own clients with photos, CV and links. Sees only their clients and no money.",
};

/* ---------- project fields ---------- */
export const deadlineOf = (c) => c.deadline || "";
export const LINK_TYPES = ["Website", "Facebook", "X (Twitter)", "Instagram", "LinkedIn", "TikTok", "YouTube", "Wikipedia", "News article", "Other"];

/* ---------- invoices ---------- */
export function invTotals(inv) {
  const sub = (inv.items || []).reduce((a, i) => a + (+i.qty || 0) * (+i.price || 0), 0);
  const disc = Math.min(+inv.discount || 0, sub);
  const net = sub - disc;
  const vat = inv.vat ? Math.round(net * (+inv.vatRate || 0)) / 100 : 0;
  const total = net + vat;
  const paidAmt = (inv.receipts || []).reduce((a, p) => a + (+p.amount || 0), 0);
  return { sub, disc, net, vat, total, paid: paidAmt, balance: Math.max(total - paidAmt, 0) };
}
export function invStatus(inv) {
  if (inv.status === "void") return "void";
  if (inv.status === "draft") return "draft";
  const t = invTotals(inv);
  if (t.total > 0 && t.paid >= t.total) return "paid";
  if (inv.dueDate && inv.dueDate < today()) return "overdue";
  if (t.paid > 0) return "partial";
  return "sent";
}
export const INV_STATUS = {
  draft: ["Draft", ""], sent: ["Unpaid", "warn"], partial: ["Part paid", "warn"],
  overdue: ["Overdue", "bad"], paid: ["Paid", "ok"], void: ["Void", ""],
};
export const invNo = (inv, settings) => (settings?.invoicePrefix ?? "SPT-") + String(inv.number || 0).padStart(4, "0");
export const invOwed = (invoices) => invoices.filter((i) => ["sent", "partial", "overdue"].includes(invStatus(i))).reduce((a, i) => a + invTotals(i).balance, 0);
export const PAY_METHODS = ["M-Pesa", "Bank transfer", "Cash", "Cheque", "Card"];

/* ---------- images ---------- */
// Shrink photos in the browser so they fit the 1.9 MB limit and load fast.
export async function shrinkImage(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (s === 1 && file.size < 900000) return file;
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.82));
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}
export const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
export const waLink = (phone) => { const d = (phone || "").replace(/\D/g, "").replace(/^0/, "254"); return d ? "https://wa.me/" + d : ""; };

// "in 12 days", "tomorrow", "today", "3 days late"
export function untilLabel(d) {
  if (!d) return "";
  const n = Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1) return `in ${n} days`;
  return `${-n} day${n === -1 ? "" : "s"} late`;
}

/* ---------- online status ---------- */
// Unix seconds -> "just now", "5 min ago", "3 h ago", "yesterday", "12 Oct"
export function agoUnix(t) {
  if (!t) return "";
  const m = Math.round((Date.now() / 1000 - t) / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function statusText(u) {
  if (u.status === "online") return "Online now";
  if (u.status === "idle") return `Signed in, idle · active ${agoUnix(u.lastSeen)}`;
  return u.lastSeen ? `Offline · last active ${agoUnix(u.lastSeen)}` : "Never signed in";
}
