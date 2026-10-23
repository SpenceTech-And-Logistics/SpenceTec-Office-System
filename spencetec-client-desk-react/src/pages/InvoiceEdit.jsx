import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Link, navigate, useLocation } from "../router.jsx";
import { ClientSelect, Empty, Icon, InvPill, PageHead } from "../ui.jsx";
import { kes, uid, today, daysFromNow, invTotals, invStatus, invNo, fmtDate, PAY_METHODS } from "../util.js";

const billToOf = (c) => c ? { name: c.name || "", email: c.email || "", phone: c.phone || "", address: [c.title, c.org, c.location].filter(Boolean).join(", ") } : { name: "", email: "", phone: "", address: "" };
const blankItem = () => ({ id: uid(), desc: "", qty: 1, price: "" });
const strip = (inv) => { const { id, number, status, created, createdBy, updated, updatedBy, ...rest } = inv; return rest; };
// Compare what matters, ignoring key order and number-vs-text differences from the form.
const norm = (x) => JSON.stringify([x.clientId, x.issueDate, x.dueDate, x.billTo?.name, x.billTo?.email, x.billTo?.phone, x.billTo?.address,
  (x.items || []).map((i) => [i.desc, +i.qty || 0, +i.price || 0]), !!x.vat, +x.vatRate || 0, +x.discount || 0, x.notes || ""]);

export default function InvoiceEdit({ id }) {
  const { invoices, clients, settings, loaded, refresh, patchInvoice, toast, isOwner } = useDesk();
  const { query } = useLocation();
  const isNew = id === "new";
  const saved = isNew ? null : invoices.find((i) => i.id === id);

  const fresh = () => {
    const c = clients.find((x) => x.id === query.get("client"));
    return { clientId: c?.id || "", issueDate: today(), dueDate: daysFromNow(14), billTo: billToOf(c), items: [blankItem()], vat: false, vatRate: +(settings.vatRate || 16), discount: 0, notes: "", receipts: [] };
  };
  const [f, setF] = useState(() => (saved ? strip(saved) : fresh()));
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState("");
  useEffect(() => { if (saved) setF(strip(saved)); }, [saved?.id]); // eslint-disable-line
  useEffect(() => { if (isNew && !f.clientId && query.get("client") && clients.length) setF(fresh()); }, [clients.length]); // eslint-disable-line

  const dirty = isNew || (saved && norm(saved) !== norm(f));
  const t = invTotals(f);
  const doc = { ...(saved || { number: 0, status: "draft" }), ...f };
  const st = invStatus(doc);

  if (!loaded) return <Empty title="Loading…" />;
  if (!isNew && !saved) return <Empty title="Invoice not found" action={<Link className="btn" to="/invoices">Back to invoices</Link>} />;

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (iid, k, v) => setF((x) => ({ ...x, items: x.items.map((i) => (i.id === iid ? { ...i, [k]: v } : i)) }));
  const pickClient = (cid) => setF((x) => ({ ...x, clientId: cid, billTo: billToOf(clients.find((c) => c.id === cid)) }));

  function clean() {
    return { ...f, items: f.items.filter((i) => i.desc.trim() || +i.price).map((i) => ({ ...i, qty: +i.qty || 0, price: +i.price || 0 })) };
  }
  async function save(extra = {}, msg = "Invoice saved") {
    if (!f.clientId) { toast("Choose a client first", "bad"); return false; }
    const data = { ...clean(), ...extra };
    if (!data.items.length) { toast("Add at least one line", "bad"); return false; }
    setBusy(true);
    try {
      if (isNew) {
        const r = await api.createInvoice(data);
        if (extra.status) await api.patchInvoice(r.id, { status: extra.status, sentAt: extra.sentAt });
        await refresh();
        toast(`Invoice ${invNo(r, settings)} created`, "ok");
        navigate(`/invoices/${r.id}`, { replace: true });
      } else {
        await patchInvoice(id, data, msg);
        setF((x) => ({ ...x, items: data.items.length ? data.items : x.items }));
      }
      return true;
    } catch (e) { toast(e.message, "bad"); return false; }
    finally { setBusy(false); }
  }

  async function addReceipt(p) {
    const receipts = [...(f.receipts || []), { id: uid(), ...p }];
    setF((x) => ({ ...x, receipts }));
    const paidNow = invTotals({ ...f, receipts }).balance <= 0;
    await patchInvoice(id, { receipts }, paidNow ? "Paid in full" : "Payment recorded").catch(() => {});
  }
  async function removeReceipt(rid) {
    const receipts = f.receipts.filter((p) => p.id !== rid);
    setF((x) => ({ ...x, receipts }));
    await patchInvoice(id, { receipts }, "Payment removed").catch(() => {});
  }
  async function del() {
    if (armed !== "del") return setArmed("del");
    try { await api.deleteInvoice(id); await refresh(); toast("Invoice deleted"); navigate("/invoices"); } catch (e) { toast(e.message, "bad"); }
  }

  const number = isNew ? "New invoice" : invNo(saved, settings);
  const mail = (() => {
    const to = f.billTo?.email;
    if (!to || isNew) return "";
    const body = `Dear ${f.billTo.name},\n\nPlease find invoice ${number} for ${kes(t.total)}${f.dueDate ? `, due on ${fmtDate(f.dueDate)}` : ""}.\n${t.paid ? `Amount paid so far: ${kes(t.paid)}. Balance: ${kes(t.balance)}.\n` : ""}${settings.payInstructions ? `\nHow to pay:\n${settings.payInstructions}\n` : ""}\nThank you,\n${settings.company || "SpenceTec and Logistics Limited"}`;
    return `mailto:${to}?subject=${encodeURIComponent(`Invoice ${number} from ${settings.company || "SpenceTec and Logistics Limited"}`)}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <>
      <div className="no-print">
        <PageHead back={["/invoices", "Billing"]} title={number} sub={isNew ? "Fill in the lines; the preview updates as you type." : <>{saved.billTo?.name} · <InvPill inv={saved} /></>}>
          {!isNew && <button className="btn" onClick={() => window.print()}><Icon name="print" size={16} />Print or save PDF</button>}
          {mail && <a className="btn" href={mail}><Icon name="mail" size={16} />Email</a>}
        </PageHead>
      </div>

      <div className="inv-layout">
        <div className="stack no-print">
          <section className="card-p">
            <div className="ch"><h2>Client</h2></div>
            <ClientSelect value={f.clientId} onChange={pickClient} clients={clients} />
            <div className="fields">
              <label>Bill to<input value={f.billTo.name} onChange={(e) => set("billTo", { ...f.billTo, name: e.target.value })} /></label>
              <label>Email<input type="email" value={f.billTo.email} onChange={(e) => set("billTo", { ...f.billTo, email: e.target.value })} /></label>
              <label>Phone<input value={f.billTo.phone} onChange={(e) => set("billTo", { ...f.billTo, phone: e.target.value })} /></label>
              <label>Address / office<input value={f.billTo.address} onChange={(e) => set("billTo", { ...f.billTo, address: e.target.value })} /></label>
              <label>Issue date<input type="date" value={f.issueDate} onChange={(e) => set("issueDate", e.target.value)} /></label>
              <label>Due date<input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></label>
            </div>
          </section>

          <section className="card-p">
            <div className="ch"><h2>Lines</h2></div>
            <div className="lines">
              <div className="line head"><span>Description</span><span>Qty</span><span>Unit price</span><span /></div>
              {f.items.map((i) => (
                <div className="line" key={i.id}>
                  <input value={i.desc} placeholder="e.g. Website design and build" aria-label="Description" onChange={(e) => setItem(i.id, "desc", e.target.value)} />
                  <input type="number" min="0" step="any" value={i.qty} aria-label="Quantity" onChange={(e) => setItem(i.id, "qty", e.target.value)} />
                  <input type="number" min="0" step="any" value={i.price} placeholder="KES" aria-label="Unit price" onChange={(e) => setItem(i.id, "price", e.target.value)} />
                  <button type="button" className="icon-btn" aria-label="Remove line" disabled={f.items.length === 1} onClick={() => set("items", f.items.filter((x) => x.id !== i.id))}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="linkbtn" onClick={() => set("items", [...f.items, blankItem()])}>+ Add line</button>
            <div className="fields">
              <label>Discount (KES)<input type="number" min="0" value={f.discount || ""} onChange={(e) => set("discount", +e.target.value || 0)} /></label>
              <label className="check"><input type="checkbox" checked={!!f.vat} onChange={(e) => set("vat", e.target.checked)} /> Add VAT at
                <input className="rate" type="number" min="0" max="100" value={f.vatRate} onChange={(e) => set("vatRate", +e.target.value || 0)} />%</label>
              <label className="full">Notes on the invoice<textarea value={f.notes} placeholder="e.g. 50% deposit before work starts, balance on launch." onChange={(e) => set("notes", e.target.value)} /></label>
            </div>
          </section>

          <section className="card-p actions">
            {isNew ? (
              <>
                <button className="btn" disabled={busy} onClick={() => save()}>Save as draft</button>
                <button className="btn primary" disabled={busy} onClick={() => save({ status: "sent", sentAt: today() })}>Create and mark as sent</button>
              </>
            ) : (
              <>
                {dirty && <button className="btn primary" disabled={busy} onClick={() => save()}>Save changes</button>}
                {saved.status === "draft" && <button className={"btn" + (dirty ? "" : " primary")} disabled={busy} onClick={() => save({ status: "sent", sentAt: today() }, "Marked as sent")}>Mark as sent</button>}
                {saved.status === "sent" && !t.paid && <button className="btn" onClick={() => patchInvoice(id, { status: "draft" }, "Back to draft")}>Back to draft</button>}
                {saved.status !== "void" && saved.status !== "draft" && (
                  <button className={"btn danger" + (armed === "void" ? " armed" : "")} onBlur={() => setArmed("")}
                    onClick={() => armed === "void" ? (setArmed(""), patchInvoice(id, { status: "void" }, "Invoice voided")) : setArmed("void")}>{armed === "void" ? "Click again to void" : "Void"}</button>
                )}
                {saved.status === "void" && <button className="btn" onClick={() => patchInvoice(id, { status: "sent" }, "Invoice restored")}>Restore</button>}
                {(saved.status === "draft" || isOwner) && (
                  <button className={"btn danger" + (armed === "del" ? " armed" : "")} onBlur={() => setArmed("")} onClick={del}>{armed === "del" ? "Click again to delete" : "Delete"}</button>
                )}
              </>
            )}
            {!isNew && dirty && <span className="small">You have unsaved changes.</span>}
          </section>

          {!isNew && saved.status !== "draft" && saved.status !== "void" && (
            <Receipts f={f} t={t} onAdd={addReceipt} onRemove={removeReceipt} />
          )}
        </div>

        <InvoiceDoc inv={doc} number={isNew ? "Draft" : number} t={t} st={st} settings={settings} />
      </div>
    </>
  );
}

function Receipts({ f, t, onAdd, onRemove }) {
  const [amt, setAmt] = useState("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("M-Pesa");
  const [ref, setRef] = useState("");
  useEffect(() => { setAmt(t.balance ? String(t.balance) : ""); }, [t.balance]);
  return (
    <section className="card-p">
      <div className="ch"><h2>Payments received</h2><span className="count">{kes(t.paid)} of {kes(t.total)}</span></div>
      <div className="items">
        {(f.receipts || []).map((p) => (
          <div className="item" key={p.id}>
            <span className="t"><span className="tt">{kes(p.amount)} · {p.method}</span><span className="meta"><span>{p.date ? fmtDate(p.date) : ""}</span>{p.ref && <span>Ref {p.ref}</span>}</span></span>
            <button className="icon-btn" aria-label="Remove payment" onClick={() => onRemove(p.id)}><Icon name="x" size={15} /></button>
          </div>
        ))}
        {!(f.receipts || []).length && <p className="quiet">Nothing received yet.</p>}
      </div>
      {t.balance > 0 && (
        <form className="receipt" onSubmit={(e) => { e.preventDefault(); if (!+amt) return; onAdd({ amount: +amt, date, method, ref: ref.trim() }); setRef(""); }}>
          <label>Amount<input type="number" min="0" step="any" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Method<select value={method} onChange={(e) => setMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>Reference<input value={ref} placeholder="M-Pesa code" onChange={(e) => setRef(e.target.value.toUpperCase())} /></label>
          <button className="btn primary">Record payment</button>
        </form>
      )}
    </section>
  );
}

export function InvoiceDoc({ inv, number, t, st, settings }) {
  const s = settings || {};
  const lines = (inv.items || []).filter((i) => (i.desc || "").trim() || +i.price);
  return (
    <article className="invoice-doc" aria-label="Invoice preview">
      {["paid", "void", "draft"].includes(st) && <span className={"stamp " + st}>{st}</span>}
      <header>
        <div>
          <div className="co"><span className="logo">S</span><b>{s.company || "SpenceTec and Logistics Limited"}</b></div>
          <p>{s.address}{s.phone ? <><br />{s.phone}</> : null}{s.email ? <><br />{s.email}</> : null}{s.kraPin ? <><br />KRA PIN {s.kraPin}</> : null}</p>
        </div>
        <div className="meta">
          <h2>Invoice</h2>
          <dl>
            <dt>Number</dt><dd>{number}</dd>
            <dt>Issued</dt><dd>{inv.issueDate ? fmtDate(inv.issueDate) : "—"}</dd>
            <dt>Due</dt><dd>{inv.dueDate ? fmtDate(inv.dueDate) : "On receipt"}</dd>
          </dl>
        </div>
      </header>
      <section className="billto">
        <small>Bill to</small>
        <b>{inv.billTo?.name || "—"}</b>
        <p>{[inv.billTo?.address, inv.billTo?.phone, inv.billTo?.email].filter(Boolean).map((x, i) => <React.Fragment key={i}>{x}<br /></React.Fragment>)}</p>
      </section>
      <table>
        <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {lines.length ? lines.map((i) => (
            <tr key={i.id}><td>{i.desc}</td><td className="r">{+i.qty || 0}</td><td className="r">{kes(+i.price || 0)}</td><td className="r">{kes((+i.qty || 0) * (+i.price || 0))}</td></tr>
          )) : <tr><td colSpan="4" className="muted">No lines yet</td></tr>}
        </tbody>
      </table>
      <dl className="totals">
        <dt>Subtotal</dt><dd>{kes(t.sub)}</dd>
        {t.disc > 0 && <><dt>Discount</dt><dd>−{kes(t.disc)}</dd></>}
        {inv.vat && <><dt>VAT {inv.vatRate}%</dt><dd>{kes(t.vat)}</dd></>}
        <dt className="grand">Total</dt><dd className="grand">{kes(t.total)}</dd>
        {t.paid > 0 && <><dt>Paid</dt><dd>−{kes(t.paid)}</dd><dt className="grand">Balance due</dt><dd className="grand">{kes(t.balance)}</dd></>}
      </dl>
      {s.payInstructions && <section className="howto"><small>How to pay</small><p>{s.payInstructions}</p></section>}
      {inv.notes && <section className="howto"><small>Notes</small><p>{inv.notes}</p></section>}
      <footer>{s.footer}<br />{s.company || "SpenceTec and Logistics Limited"}</footer>
    </article>
  );
}
