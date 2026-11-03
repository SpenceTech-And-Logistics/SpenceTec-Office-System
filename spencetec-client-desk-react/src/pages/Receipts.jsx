import React, { useMemo, useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link, navigate, setQuery, useLocation } from "../router.jsx";
import { Empty, Icon, PageHead, Seg } from "../ui.jsx";
import { invNo, invTotals, receiptNo, fmtDate, kes, today } from "../util.js";
import { BillingTabs } from "./Invoices.jsx";

/* Every receipt issued, newest first. Receipts come from payments recorded on invoices. */
export default function Receipts() {
  const { invoices, clients, settings, loaded } = useDesk();
  const { query } = useLocation();
  const when = query.get("when") || "all";
  const [q, setQ] = useState("");

  const all = useMemo(() => {
    const rows = [];
    for (const inv of invoices) {
      if (inv.status === "void") continue;
      const t = invTotals(inv);
      let paidSoFar = 0;
      (inv.receipts || []).forEach((p, i) => {
        paidSoFar += +p.amount || 0;
        rows.push({
          inv, p, no: receiptNo(inv, settings, i),
          client: inv.billTo?.name || clients.find((c) => c.id === inv.clientId)?.name || "—",
          full: t.total > 0 && paidSoFar >= t.total,
        });
      });
    }
    return rows.sort((a, b) => (b.p.date || "").localeCompare(a.p.date || "") || b.no.localeCompare(a.no));
  }, [invoices, clients, settings]);

  const month = today().slice(0, 7);
  const lastMonth = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const year = today().slice(0, 4);
  const sum = (rows) => rows.reduce((a, r) => a + (+r.p.amount || 0), 0);
  const inMonth = all.filter((r) => (r.p.date || "").startsWith(month));
  const inYear = all.filter((r) => (r.p.date || "").startsWith(year));

  const list = all.filter((r) => {
    const d = r.p.date || "";
    if (when === "month" && !d.startsWith(month)) return false;
    if (when === "last" && !d.startsWith(lastMonth)) return false;
    if (when === "year" && !d.startsWith(year)) return false;
    const s = q.trim().toLowerCase();
    return !s || [r.no, r.client, r.p.ref, r.p.method, invNo(r.inv, settings)].join(" ").toLowerCase().includes(s);
  });

  return (
    <>
      <PageHead title="Billing" sub="Every receipt issued for money received">
        <Link className="btn" to="/invoices"><Icon name="invoice" size={16} />Invoices</Link>
      </PageHead>
      <BillingTabs on="receipts" />

      <section className="tiles three">
        <div className="tile static ok"><span className="tl">Received this month</span><b>{kes(sum(inMonth))}</b><small>{inMonth.length} receipt{inMonth.length === 1 ? "" : "s"}</small></div>
        <div className="tile static"><span className="tl">Received in {year}</span><b>{kes(sum(inYear))}</b><small>{inYear.length} receipt{inYear.length === 1 ? "" : "s"}</small></div>
        <div className="tile static"><span className="tl">All receipts</span><b>{all.length}</b><small>{kes(sum(all))} in total</small></div>
      </section>

      <div className="filters">
        <Seg label="When" value={when} onChange={(v) => setQuery("when", v === "all" ? "" : v)} options={[["all", "All"], ["month", "This month"], ["last", "Last month"], ["year", "This year"]]} />
        <input className="filter-q" type="search" placeholder="Find receipt, client or M-Pesa code" aria-label="Find receipt" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!loaded ? <Empty title="Loading…" />
      : !all.length ? <Empty title="No receipts yet">Open an invoice and record a payment under <b>Payments received</b>. Each payment gets a receipt that is kept here.</Empty>
      : !list.length ? <Empty title="Nothing here">No receipts match.</Empty>
      : (
        <div className="tablewrap"><table className="rcpt-table">
          <thead><tr><th>Receipt</th><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th className="r">Amount</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.inv.id + r.p.id} onClick={() => navigate(`/invoices/${r.inv.id}/receipt/${r.p.id}`)}>
              <td><Link to={`/invoices/${r.inv.id}/receipt/${r.p.id}`} className="tname">{r.no}</Link>{r.full && <span className="pill ok">Paid in full</span>}</td>
              <td className="muted">{r.p.date ? fmtDate(r.p.date) : "—"}</td>
              <td>{r.client}</td>
              <td><Link to={`/invoices/${r.inv.id}`} className="clink" onClick={(e) => e.stopPropagation()}>{invNo(r.inv, settings)}</Link></td>
              <td className="muted">{r.p.method}{r.p.ref ? ` · ${r.p.ref}` : ""}</td>
              <td className="r amt"><b>{kes(r.p.amount)}</b></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
