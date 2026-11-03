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
// How often a line is charged. Monthly and yearly lines are shown on the invoice but billed separately.
export const FREQS = [["once", "One-off"], ["monthly", "Monthly"], ["yearly", "Yearly"]];
export const freqOf = (i) => (i.freq === "monthly" || i.freq === "yearly" ? i.freq : i.monthly ? "monthly" : "once");
export const FREQ_SUFFIX = { once: "", monthly: "/mo", yearly: "/yr" };
// payMode: "deposit" (deposit now, balance on completion), "full" (whole amount), "either" (client chooses)
export const PAY_MODES = [["deposit", "Deposit + balance"], ["full", "Full payment"], ["either", "Client chooses"]];
export const payModeOf = (inv) => (["deposit", "full", "either"].includes(inv.payMode) ? inv.payMode : +inv.depositPct > 0 ? "deposit" : "full");

export function invTotals(inv) {
  const lineAmt = (i) => (+i.qty || 0) * (+i.price || 0);
  const items = inv.items || [];
  const sub = items.filter((i) => freqOf(i) === "once").reduce((a, i) => a + lineAmt(i), 0);
  const monthly = items.filter((i) => freqOf(i) === "monthly").reduce((a, i) => a + lineAmt(i), 0);
  const yearly = items.filter((i) => freqOf(i) === "yearly").reduce((a, i) => a + lineAmt(i), 0);
  const disc = Math.min(+inv.discount || 0, sub);
  const net = sub - disc;
  const vat = inv.vat ? Math.round(net * (+inv.vatRate || 0)) / 100 : 0;
  const total = net + vat;
  const paidAmt = (inv.receipts || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const mode = payModeOf(inv);
  const pct = mode === "full" ? 0 : Math.min(100, Math.max(0, +inv.depositPct || 0));
  const deposit = pct ? Math.round((total * pct) / 100) : 0;
  return { sub, disc, net, vat, total, monthly, yearly, mode, pct, deposit, onCompletion: total - deposit, paid: paidAmt, balance: Math.max(total - paidAmt, 0) };
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
export const invNo = (inv, settings) => (settings?.invoicePrefix ?? "INV-") + String(inv.number || 0).padStart(+(settings?.invoicePad || 3), "0");
// "{deposit}" and "{balance}" in payment terms become the percentages.
export const NO_DEPOSIT_TERMS = "Payment is due in full by the due date shown above.";
export const EITHER_TERMS = "You may pay the full amount by the due date, or pay a {deposit}% deposit before work begins and the remaining {balance}% on completion.";
export const RECURRING_TERMS = "Monthly updates and yearly maintenance are billed separately at the agreed rates.";
// Default terms for each payment option (the deposit wording can be changed in Settings).
export const termsFor = (mode, settings) =>
  mode === "full" ? NO_DEPOSIT_TERMS : mode === "either" ? EITHER_TERMS : settings?.terms || DEFAULT_TERMS;
export const fillTerms = (text, pct, hasDueDate = true) => {
  let t = String(text || "");
  // Deposit wording makes no sense without a deposit, so fall back to plain terms.
  if (!pct && t.includes("{deposit}")) t = NO_DEPOSIT_TERMS;
  t = t.replaceAll("{deposit}", pct).replaceAll("{balance}", 100 - pct);
  // Without a due date, "by the due date" becomes "on receipt of this invoice".
  if (!hasDueDate) t = t.replace(/by the due date shown above/g, "on receipt of this invoice").replace(/by the due date/g, "on receipt of this invoice");
  return t;
};
// Days until due on new invoices; blank in Settings means no due date.
export const defaultDueDate = (settings) => {
  const v = settings?.dueDays;
  if (v === undefined || v === null) return daysFromNow(14);
  if (String(v).trim() === "") return "";
  return daysFromNow(Math.max(0, parseInt(v, 10) || 0));
};
export const DEFAULT_TERMS = "A {deposit}% deposit of the agreed fee is payable before work begins. The remaining {balance}% is due on completion. Monthly website updates are optional and billed separately at the agreed monthly rate.";

/* Starting points for new invoices, based on SpenceTec's own invoices. Prices are left for you to fill in. */
export const INVOICE_TEMPLATES = [
  { key: "portfolio", name: "Web portfolio page", payMode: "deposit", depositPct: 75,
    items: [{ desc: "Preparation of a web portfolio page, as agreed", qty: 1, price: "", freq: "once" },
            { desc: "Monthly website updates (additional recurring charge)", qty: 1, price: 10000, freq: "monthly" }],
    notes: "Monthly updates are charged separately from the web portfolio preparation fee." },
  { key: "multipage", name: "Multi-page website", payMode: "deposit", depositPct: 75,
    items: [{ desc: "Design and build of a multi-page website, as agreed", qty: 1, price: "", freq: "once" },
            { desc: "Domain and hosting, first year", qty: 1, price: "", freq: "once" },
            { desc: "Yearly maintenance: hosting, domain renewal and support", qty: 1, price: "", freq: "yearly" },
            { desc: "Monthly website updates (additional recurring charge)", qty: 1, price: 10000, freq: "monthly" }],
    notes: "Yearly maintenance and monthly updates are charged separately from the website fee." },
  { key: "yearly", name: "Yearly maintenance", payMode: "full", depositPct: 0,
    items: [{ desc: "Yearly website maintenance: hosting, domain renewal and support", qty: 1, price: "", freq: "once" }], notes: "" },
  { key: "updates", name: "Monthly updates", payMode: "full", depositPct: 0,
    items: [{ desc: "Monthly website updates", qty: 1, price: 10000, freq: "once" }], notes: "" },
  { key: "blank", name: "Blank invoice", payMode: "full", depositPct: 0, items: [{ desc: "", qty: 1, price: "", freq: "once" }], notes: "" },
];
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

/* ---------- receipts ---------- */
// One receipt per payment received: RCT-006-1, RCT-006-2… (invoice number + payment number).
export const receiptNo = (inv, settings, index) =>
  "RCT-" + String(inv.number || 0).padStart(+(settings?.invoicePad || 3), "0") + "-" + (index + 1);
export const STATUS_LABEL = { draft: "Draft", sent: "Unpaid", partial: "Partly paid", overdue: "Overdue", paid: "Paid", void: "Void" };

// 22500 -> "Twenty-Two Thousand Five Hundred"
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function under1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
  return [h ? ONES[h] + " Hundred" : "", rest].filter(Boolean).join(h && rest ? " and " : "");
}
export function amountInWords(amount) {
  let n = Math.round(+amount || 0);
  if (!n) return "Kenya Shillings Zero Only";
  const parts = [];
  for (const [size, name] of [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"], [1, ""]]) {
    const chunk = Math.floor(n / size);
    if (chunk) { parts.push(under1000(chunk) + (name ? " " + name : "")); n -= chunk * size; }
  }
  return "Kenya Shillings " + parts.join(" ") + " Only";
}
