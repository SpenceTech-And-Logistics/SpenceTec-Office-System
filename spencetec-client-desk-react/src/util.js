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
