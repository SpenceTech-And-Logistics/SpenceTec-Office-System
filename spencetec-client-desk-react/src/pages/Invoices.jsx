import React, { useMemo, useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link, navigate, setQuery, useLocation } from "../router.jsx";
import { Empty, Icon, InvPill, PageHead, Seg } from "../ui.jsx";
import { kes, invTotals, invStatus, invNo, fmtDate, today } from "../util.js";

export function BillingTabs({ on }) {
  return (
    <div className="tabs" role="tablist">
      <Link to="/invoices" role="tab" aria-selected={on === "invoices"}><Icon name="invoice" size={16} />Invoices</Link>
      <Link to="/payments" role="tab" aria-selected={on === "payments"}><Icon name="money" size={16} />Other payments</Link>
    </div>
  );
}

export default function Invoices() {
  const { invoices, clients, settings, loaded } = useDesk();
  const { query } = useLocation();
  const show = query.get("show") || "all";
  const [q, setQ] = useState("");

  const rows = useMemo(() => invoices.map((inv) => ({ inv, t: invTotals(inv), st: invStatus(inv), c: clients.find((c) => c.id === inv.clientId) })), [invoices, clients]);
  const unpaid = rows.filter((r) => ["sent", "partial", "overdue"].includes(r.st));
  const overdue = rows.filter((r) => r.st === "overdue");
  const month = today().slice(0, 7);
  const thisMonth = rows.reduce((a, r) => a + (r.inv.receipts || []).filter((p) => (p.date || "").startsWith(month)).reduce((x, p) => x + (+p.amount || 0), 0), 0);

  const list = rows.filter((r) => {
    if (show === "unpaid" && !["sent", "partial", "overdue"].includes(r.st)) return false;
    if (show === "draft" && r.st !== "draft") return false;
    if (show === "paid" && r.st !== "paid") return false;
    const s = q.trim().toLowerCase();
    return !s || [invNo(r.inv, settings), r.inv.billTo?.name, r.c?.name].join(" ").toLowerCase().includes(s);
  });

  return (
    <>
      <PageHead title="Billing" sub="Invoices you send to clients, and money received">
        <Link className="btn primary" to="/invoices/new"><Icon name="plus" size={16} />New invoice</Link>
      </PageHead>
      <BillingTabs on="invoices" />

      <section className="tiles three">
        <div className={"tile static" + (unpaid.length ? " warn" : "")}><span className="tl">Waiting to be paid</span><b>{kes(unpaid.reduce((a, r) => a + r.t.balance, 0))}</b><small>{unpaid.length} invoice{unpaid.length === 1 ? "" : "s"}</small></div>
        <div className={"tile static" + (overdue.length ? " alert" : "")}><span className="tl">Overdue</span><b>{kes(overdue.reduce((a, r) => a + r.t.balance, 0))}</b><small>{overdue.length ? `${overdue.length} past due date` : "None overdue"}</small></div>
        <div className="tile static ok"><span className="tl">Received this month</span><b>{kes(thisMonth)}</b><small>from invoices</small></div>
      </section>

      <div className="filters">
        <Seg label="Show" value={show} onChange={(v) => setQuery("show", v === "all" ? "" : v)} options={[["all", "All"], ["unpaid", "Unpaid"], ["draft", "Drafts"], ["paid", "Paid"]]} />
        <input className="filter-q" type="search" placeholder="Find invoice or client" aria-label="Find invoice" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!loaded ? <Empty title="Loading…" />
      : !invoices.length ? <Empty title="No invoices yet" action={<Link className="btn primary" to="/invoices/new"><Icon name="plus" size={16} />Create your first invoice</Link>}>Invoices get a number automatically and can be printed or saved as PDF.</Empty>
      : !list.length ? <Empty title="Nothing here">No invoices match.</Empty>
      : (
        <div className="tablewrap"><table className="inv-table">
          <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th className="r">Total</th><th className="r">Balance</th><th>Status</th></tr></thead>
          <tbody>{list.map(({ inv, t, c }) => (
            <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
              <td><Link to={`/invoices/${inv.id}`} className="tname">{invNo(inv, settings)}</Link></td>
              <td>{c ? c.name : inv.billTo?.name || "—"}</td>
              <td className="muted">{inv.issueDate ? fmtDate(inv.issueDate) : "—"}</td>
              <td className="muted">{inv.dueDate ? fmtDate(inv.dueDate) : "—"}</td>
              <td className="r amt">{kes(t.total)}</td>
              <td className="r amt">{inv.status === "void" || inv.status === "draft" ? <span className="muted">—</span> : t.balance ? <b>{kes(t.balance)}</b> : <span className="muted">0</span>}</td>
              <td><InvPill inv={inv} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
