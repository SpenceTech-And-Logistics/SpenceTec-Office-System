import React, { useMemo, useState } from "react";
import { useDesk } from "../desk.jsx";
import { setQuery, useLocation } from "../router.jsx";
import { ClientSelect, Empty, Icon, PageHead, PayRow, Seg } from "../ui.jsx";
import { allPays, kes, uid, paysOf } from "../util.js";

export default function Payments() {
  const { clients, loaded, patch } = useDesk();
  const { query } = useLocation();
  const show = query.get("show") || "pending";
  const [label, setLabel] = useState("");
  const [amt, setAmt] = useState("");
  const [cid, setCid] = useState("");
  const [date, setDate] = useState("");

  const all = useMemo(() => allPays(clients).sort((a, b) => (b.p.date || "").localeCompare(a.p.date || "")), [clients]);
  const sum = (xs) => xs.reduce((a, x) => a + (+x.p.amount || 0), 0);
  const pending = all.filter((x) => x.p.status !== "paid");
  const done = all.filter((x) => x.p.status === "paid");
  const list = show === "paid" ? done : show === "all" ? all : pending;

  const add = (e) => {
    e.preventDefault();
    const a = +amt;
    if (!label.trim() || !a || !cid) return;
    patch(cid, (cur) => ({ payments: [...paysOf(cur), { id: uid(), label: label.trim(), amount: a, date, status: "pending" }] }), "Payment added");
    setLabel(""); setAmt(""); setDate("");
  };

  return (
    <>
      <PageHead title="Payments" sub="Invoices and money received, in KES">
        <Seg label="Show" value={show} onChange={(v) => setQuery("show", v === "pending" ? "" : v)} options={[["pending", "Pending"], ["paid", "Paid"], ["all", "All"]]} />
      </PageHead>

      <section className="tiles three">
        <div className="tile static"><span className="tl">Invoiced</span><b>{kes(sum(all))}</b><small>{all.length} payment{all.length === 1 ? "" : "s"}</small></div>
        <div className="tile static ok"><span className="tl">Received</span><b>{kes(sum(done))}</b><small>{done.length} paid</small></div>
        <div className={"tile static" + (pending.length ? " warn" : "")}><span className="tl">Outstanding</span><b>{kes(sum(pending))}</b><small>{pending.length} pending</small></div>
      </section>

      <form className="card-p addbar pay" onSubmit={add}>
        <input placeholder="Deposit, balance…" aria-label="Payment label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <ClientSelect value={cid} onChange={setCid} clients={clients} />
        <input type="number" min="0" inputMode="numeric" placeholder="Amount (KES)" aria-label="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn primary"><Icon name="plus" size={16} />Add</button>
      </form>

      {!loaded ? <Empty title="Loading…" />
      : !list.length ? <Empty title={show === "paid" ? "Nothing received yet" : show === "all" ? "No payments yet" : "Nothing outstanding"}>Add an invoice above or on a client's page.</Empty>
      : (
        <section className="card-p">
          <div className="items">{list.map(({ c, p }) => <PayRow key={c.id + p.id} c={c} p={p} showClient />)}</div>
        </section>
      )}
    </>
  );
}
