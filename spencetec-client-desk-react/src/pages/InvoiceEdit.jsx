import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Link, navigate, useLocation } from "../router.jsx";
import { ClientSelect, Empty, Icon, InvPill, PageHead, Seg } from "../ui.jsx";
import { kes, uid, today, daysFromNow, invTotals, invStatus, invNo, fmtDate, PAY_METHODS, fillTerms, INVOICE_TEMPLATES, FREQS, FREQ_SUFFIX, freqOf, PAY_MODES, termsFor } from "../util.js";
import { downloadInvoicePdf, invoiceFileName } from "../pdf.js";

const billToOf = (c) => c ? { name: c.name || "", email: c.email || "", phone: c.phone || "", address: [c.title, c.org, c.location].filter(Boolean).join(", ") } : { name: "", email: "", phone: "", address: "" };
const blankItem = () => ({ id: uid(), desc: "", qty: 1, price: "", freq: "once" });
const strip = (inv) => { const { id, number, status, created, createdBy, updated, updatedBy, ...rest } = inv; return rest; };
// Compare what matters, ignoring key order and number-vs-text differences from the form.
const norm = (x) => JSON.stringify([x.clientId, x.issueDate, x.dueDate, x.billTo?.name, x.billTo?.email, x.billTo?.phone, x.billTo?.address,
  (x.items || []).map((i) => [i.desc, +i.qty || 0, +i.price || 0, freqOf(i)]), !!x.vat, +x.vatRate || 0, +x.discount || 0, x.notes || "", +x.depositPct || 0, x.terms || "",
  x.payMode || "", x.payDetails || ""]);

export default function InvoiceEdit({ id }) {
  const { invoices, clients, settings, loaded, refresh, patchInvoice, toast, isOwner } = useDesk();
  const { query } = useLocation();
  const isNew = id === "new";
  const saved = isNew ? null : invoices.find((i) => i.id === id);

  const fromTemplate = (key) => {
    const tpl = INVOICE_TEMPLATES.find((x) => x.key === key) || INVOICE_TEMPLATES[0];
    const pct = settings.depositPct !== undefined && settings.depositPct !== "" ? +settings.depositPct : 75;
    const mode = tpl.payMode === "deposit" ? (settings.payMode || "deposit") : tpl.payMode;
    return { items: tpl.items.map((i) => ({ ...i, id: uid() })), payMode: mode, depositPct: mode === "full" ? 0 : pct, notes: tpl.notes, terms: termsFor(mode, settings) };
  };
  const fresh = () => {
    const c = clients.find((x) => x.id === query.get("client"));
    return { clientId: c?.id || "", issueDate: today(), dueDate: daysFromNow(14), billTo: billToOf(c), vat: false, vatRate: +(settings.vatRate || 16), discount: 0,
      receipts: [], payDetails: settings.payInstructions || "", ...fromTemplate("portfolio") };
  };
  const [tpl, setTpl] = useState("portfolio");
  const [f, setF] = useState(() => (saved ? strip(saved) : fresh()));
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
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
    return { ...f, items: f.items.filter((i) => i.desc.trim() || +i.price).map((i) => ({ id: i.id, desc: i.desc, qty: +i.qty || 0, price: +i.price || 0, freq: freqOf(i) })) };
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
  async function download() {
    setPdfBusy(true);
    try { await downloadInvoicePdf(document.querySelector(".invoice-doc"), invoiceFileName(number, f.billTo?.name)); }
    catch (e) { toast("Couldn't make the PDF. Use Print instead.", "bad"); console.error(e); }
    setPdfBusy(false);
  }
  const changeMode = (mode) => setF((x) => {
    const keepTerms = x.terms && !["deposit", "full", "either"].some((m) => termsFor(m, settings) === x.terms);
    const pct = mode === "full" ? 0 : (+x.depositPct || +settings.depositPct || 75);
    return { ...x, payMode: mode, depositPct: pct, terms: keepTerms ? x.terms : termsFor(mode, settings) };
  });
  async function del() {
    if (armed !== "del") return setArmed("del");
    try { await api.deleteInvoice(id); await refresh(); toast("Invoice deleted"); navigate("/invoices"); } catch (e) { toast(e.message, "bad"); }
  }

  const number = isNew ? "New invoice" : invNo(saved, settings);
  const mail = (() => {
    const to = f.billTo?.email;
    if (!to || isNew) return "";
    const body = `Dear ${f.billTo.name},\n\nPlease find invoice ${number} for ${kes(t.total)}${f.dueDate ? `, due on ${fmtDate(f.dueDate)}` : ""}.\n${t.mode === "deposit" && t.pct && !t.paid ? `Deposit payable now (${t.pct}%): ${kes(t.deposit)}. Balance on completion: ${kes(t.onCompletion)}.\n` : ""}${t.mode === "either" && t.pct && !t.paid ? `You can pay the full ${kes(t.total)}, or a ${t.pct}% deposit of ${kes(t.deposit)} now and ${kes(t.onCompletion)} on completion.\n` : ""}${t.paid ? `Amount paid so far: ${kes(t.paid)}. Balance: ${kes(t.balance)}.\n` : ""}${(f.payDetails || settings.payInstructions) ? `\nPayment details:\n${f.payDetails || settings.payInstructions}\n` : ""}\nThank you for your business,\n${settings.company || "SpenceTec and Logistics Limited"}`;
    return `mailto:${to}?subject=${encodeURIComponent(`Invoice ${number} from ${settings.company || "SpenceTec and Logistics Limited"}`)}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <>
      <div className="no-print">
        <PageHead back={["/invoices", "Billing"]} title={number} sub={isNew ? "Fill in the lines; the preview updates as you type." : <>{saved.billTo?.name} · <InvPill inv={saved} /></>}>
          {!isNew && <button className="btn primary" disabled={pdfBusy} onClick={download}><Icon name="upload" size={16} />{pdfBusy ? "Preparing…" : "Download PDF"}</button>}
          {!isNew && <button className="btn" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>}
          {mail && <a className="btn" href={mail}><Icon name="mail" size={16} />Email</a>}
        </PageHead>
      </div>

      <div className="inv-layout">
        <div className="stack no-print">
          {isNew && (
            <section className="card-p">
              <div className="ch"><h2>Start from</h2></div>
              <div className="tpl-pick" role="group" aria-label="Invoice template">
                {INVOICE_TEMPLATES.map((x) => (
                  <button key={x.key} type="button" aria-pressed={tpl === x.key}
                    onClick={() => { setTpl(x.key); setF((cur) => ({ ...cur, ...fromTemplate(x.key) })); }}>
                    <b>{x.name}</b>
                    <small>{x.depositPct ? `${x.depositPct}% deposit · ` : ""}{x.items.length} line{x.items.length === 1 ? "" : "s"}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

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
              <div className="line head"><span>Description</span><span>Qty</span><span>Rate (KES)</span><span>Charged</span><span /></div>
              {f.items.map((i) => (
                <div className="line" key={i.id}>
                  <input value={i.desc} placeholder="e.g. Website design and build" aria-label="Description" onChange={(e) => setItem(i.id, "desc", e.target.value)} />
                  <input type="number" min="0" step="any" value={i.qty} aria-label="Quantity" onChange={(e) => setItem(i.id, "qty", e.target.value)} />
                  <input type="number" min="0" step="any" value={i.price} placeholder="KES" aria-label="Rate" onChange={(e) => setItem(i.id, "price", e.target.value)} />
                  <select value={freqOf(i)} aria-label="How often it's charged" onChange={(e) => setF((x) => ({ ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, freq: e.target.value, monthly: undefined } : y)) }))}>
                    {FREQS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                  <button type="button" className="icon-btn" aria-label="Remove line" disabled={f.items.length === 1} onClick={() => set("items", f.items.filter((x) => x.id !== i.id))}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </div>
            <div className="row">
              <button type="button" className="linkbtn" onClick={() => set("items", [...f.items, blankItem()])}>+ Add line</button>
              <button type="button" className="linkbtn" onClick={() => set("items", [...f.items, { ...blankItem(), desc: "Yearly maintenance: hosting, domain renewal and support", freq: "yearly" }])}>+ Yearly maintenance</button>
              <button type="button" className="linkbtn" onClick={() => set("items", [...f.items, { ...blankItem(), desc: "Monthly website updates", price: 10000, freq: "monthly" }])}>+ Monthly updates</button>
            </div>
            <p className="small"><b>Monthly</b> and <b>Yearly</b> lines show on the invoice as "/mo" or "/yr" and are billed separately, so they aren't added to this invoice's total. To charge a year's maintenance now, set it to <b>One-off</b>.</p>
            <div className="fields">
              <label>Discount (KES)<input type="number" min="0" value={f.discount || ""} onChange={(e) => set("discount", +e.target.value || 0)} /></label>
              <label className="check"><input type="checkbox" checked={!!f.vat} onChange={(e) => set("vat", e.target.checked)} /> Add VAT at
                <input className="rate" type="number" min="0" max="100" value={f.vatRate} onChange={(e) => set("vatRate", +e.target.value || 0)} />%</label>
              <label className="full">Note under the lines<textarea rows="2" value={f.notes} placeholder="e.g. Monthly updates are charged separately from the preparation fee." onChange={(e) => set("notes", e.target.value)} /></label>
            </div>
          </section>

          <section className="card-p">
            <div className="ch"><h2>Payment</h2></div>
            <Seg label="How the client pays" value={t.mode} onChange={changeMode} options={PAY_MODES} />
            <p className="small">
              {t.mode === "deposit" && <>A deposit before work starts, the rest on completion.</>}
              {t.mode === "full" && <>The whole amount ({kes(t.total)}) by the due date. No deposit.</>}
              {t.mode === "either" && <>The invoice shows both: pay in full, or deposit now and the balance on completion.</>}
            </p>
            {t.mode !== "full" && (
              <div className="fields">
                <label>Deposit (%)<input type="number" min="1" max="99" value={f.depositPct || ""} onChange={(e) => set("depositPct", Math.min(99, Math.max(0, +e.target.value || 0)))} /></label>
                <span className="small deposit-note">Deposit <b>{kes(t.deposit)}</b>, balance on completion <b>{kes(t.onCompletion)}</b>.</span>
              </div>
            )}
            <label>Payment details on this invoice
              <textarea rows="4" value={f.payDetails ?? ""} placeholder={settings.payInstructions || "M-Pesa / bank details"} onChange={(e) => set("payDetails", e.target.value)} />
            </label>
            <div className="row">
              <button type="button" className="linkbtn" onClick={() => set("payDetails", settings.payInstructions || "")}>Use the default details</button>
              {isOwner && <Link className="linkbtn" to="/settings">Change the default details</Link>}
            </div>
            <label>Payment terms<textarea rows="3" value={f.terms ?? ""} onChange={(e) => set("terms", e.target.value)} /></label>
            <span className="small">{"{deposit}"} and {"{balance}"} become the percentages.</span>
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
  const company = s.company || "SpenceTec and Logistics Limited";
  const terms = fillTerms(inv.terms ?? termsFor(t.mode, s), t.pct);
  const payDetails = inv.payDetails || s.payInstructions || "";
  const longDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
  const money = (n) => Math.round(+n || 0).toLocaleString("en-KE");
  return (
    <article className="invoice-doc" aria-label="Invoice preview">
      {["paid", "void", "draft"].includes(st) && <span className={"stamp " + st}>{st}</span>}
      <div className="inv-logo"><img src="/invoice-logo.png" alt={company} /></div>

      <header className="inv-head">
        <h2>INVOICE</h2>
        <dl>
          <dt>Invoice No:</dt><dd>{number}</dd>
          <dt>Date:</dt><dd>{longDate(inv.issueDate) || "—"}</dd>
          {inv.dueDate && <><dt>Due Date:</dt><dd>{longDate(inv.dueDate)}</dd></>}
        </dl>
      </header>

      <section className="inv-parties">
        <div>
          <h3>Bill from</h3>
          <p>{company}{s.address && <><br />Address: {s.address}</>}{s.phone && <><br />Phone: {s.phone}</>}{s.email && <><br />Email: {s.email}</>}{s.kraPin && <><br />KRA PIN: {s.kraPin}</>}</p>
        </div>
        <div>
          <h3>Bill to</h3>
          <p>Client: {inv.billTo?.name || "—"}
            {inv.billTo?.address && <><br />{inv.billTo.address}</>}
            {(inv.billTo?.phone || inv.billTo?.email) && <><br />Phone/Email: {[inv.billTo.phone, inv.billTo.email].filter(Boolean).join(" · ")}</>}
          </p>
        </div>
      </section>

      <table className="inv-lines">
        <thead><tr><th>Description</th><th className="c">Qty</th><th className="r">Rate (KES)</th><th className="r">Amount (KES)</th></tr></thead>
        <tbody>
          {lines.length ? lines.map((i) => (
            <tr key={i.id} className={freqOf(i) !== "once" ? "monthly" : ""}>
              <td>{i.desc}</td>
              <td className="c">{+i.qty || 0}{FREQ_SUFFIX[freqOf(i)]}</td>
              <td className="r">{money(i.price)}</td>
              <td className="r">{money((+i.qty || 0) * (+i.price || 0))}{FREQ_SUFFIX[freqOf(i)]}</td>
            </tr>
          )) : <tr><td colSpan="4" className="muted">No lines yet</td></tr>}
        </tbody>
      </table>
      {inv.notes && <p className="inv-note">{inv.notes}</p>}

      <dl className="inv-sum">
        {(t.disc > 0 || inv.vat) && <><dt>Subtotal</dt><dd>KES {money(t.sub)}</dd></>}
        {t.disc > 0 && <><dt>Discount</dt><dd>− KES {money(t.disc)}</dd></>}
        {inv.vat && <><dt>VAT ({inv.vatRate}%)</dt><dd>KES {money(t.vat)}</dd></>}
        <dt>{t.monthly || t.yearly ? "Total fee (excluding recurring charges)" : "Total fee"}</dt><dd>KES {money(t.total)}</dd>
        {t.paid > 0 ? <>
          <dt>Paid so far</dt><dd>− KES {money(t.paid)}</dd>
          <dt className="due">Amount due</dt><dd className="due">KES {money(t.balance)}</dd>
        </> : t.mode === "full" || !t.pct ? <>
          <dt className="due">Full payment due</dt><dd className="due">KES {money(t.total)}</dd>
        </> : t.mode === "either" ? <>
          <dt className="opt">Option 1: Full payment</dt><dd className="opt">KES {money(t.total)}</dd>
          <dt className="opt">Option 2: Deposit before work begins ({t.pct}%)</dt><dd className="opt">KES {money(t.deposit)}</dd>
          <dt className="opt sub">then balance on completion ({100 - t.pct}%)</dt><dd className="opt sub">KES {money(t.onCompletion)}</dd>
        </> : <>
          <dt className="strong">Deposit payable ({t.pct}%)</dt><dd className="strong">KES {money(t.deposit)}</dd>
          <dt className="strong">Balance on completion ({100 - t.pct}%)</dt><dd className="strong">KES {money(t.onCompletion)}</dd>
        </>}
        {t.monthly > 0 && <><dt className="rec">Monthly charges (billed separately)</dt><dd className="rec">KES {money(t.monthly)}/month</dd></>}
        {t.yearly > 0 && <><dt className="rec">Yearly maintenance (billed separately)</dt><dd className="rec">KES {money(t.yearly)}/year</dd></>}
      </dl>

      {payDetails && <section className="inv-block"><h3>Payment details</h3><p>{payDetails}</p></section>}
      {terms && <section className="inv-block"><h3>Payment terms</h3><p>{terms}</p></section>}
      <p className="inv-thanks">{s.footer || "Thank you for your business."}</p>
    </article>
  );
}
