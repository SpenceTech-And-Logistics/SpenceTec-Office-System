import React, { useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link } from "../router.jsx";
import { Empty, Icon, PageHead } from "../ui.jsx";
import { invNo, invTotals, receiptNo, amountInWords, fmtDate, kes } from "../util.js";
import { downloadInvoicePdf } from "../pdf.js";

/* A receipt for one payment recorded on an invoice. */
export default function Receipt({ invoiceId, receiptId }) {
  const { invoices, settings, loaded, toast } = useDesk();
  const [busy, setBusy] = useState(false);
  if (!loaded) return <Empty title="Loading…" />;
  const inv = invoices.find((i) => i.id === invoiceId);
  const list = inv?.receipts || [];
  const index = list.findIndex((p) => p.id === receiptId);
  if (!inv || index < 0) return <Empty title="Receipt not found" action={<Link className="btn" to={inv ? `/invoices/${inv.id}` : "/invoices"}>Back</Link>}>The payment may have been removed.</Empty>;

  const p = list[index];
  const no = receiptNo(inv, settings, index);
  const t = invTotals(inv);
  const paidToDate = list.slice(0, index + 1).reduce((a, x) => a + (+x.amount || 0), 0);
  const balanceAfter = Math.max(t.total - paidToDate, 0);
  const client = inv.billTo?.name || "Client";
  const fileName = `${no}_SpenceTec_Receipt_${client.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_")}.pdf`;

  async function download() {
    setBusy(true);
    try { await downloadInvoicePdf(document.querySelector(".invoice-doc"), fileName); }
    catch (e) { toast("Couldn't make the PDF. Use Print instead.", "bad"); }
    setBusy(false);
  }
  const mail = inv.billTo?.email
    ? `mailto:${inv.billTo.email}?subject=${encodeURIComponent(`Receipt ${no} from ${settings.company || "SpenceTec and Logistics Limited"}`)}&body=${encodeURIComponent(
        `Dear ${client},\n\nThank you for your payment of ${kes(p.amount)}${p.method ? ` by ${p.method}` : ""}${p.ref ? ` (ref. ${p.ref})` : ""} towards invoice ${invNo(inv, settings)}.\n${balanceAfter ? `Balance remaining: ${kes(balanceAfter)}.` : "The invoice is now paid in full."}\n\nPlease find the receipt attached.\n\nThank you for your business,\n${settings.company || "SpenceTec and Logistics Limited"}`)}`
    : "";

  return (
    <>
      <div className="no-print">
        <PageHead back={[`/invoices/${inv.id}`, invNo(inv, settings)]} title={`Receipt ${no}`} sub={`${kes(p.amount)} from ${client}`}>
          <button className="btn primary" disabled={busy} onClick={download}><Icon name="upload" size={16} />{busy ? "Preparing…" : "Download PDF"}</button>
          <button className="btn" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
          {mail && <a className="btn" href={mail}><Icon name="mail" size={16} />Email</a>}
        </PageHead>
        {list.length > 1 && (
          <div className="chips">
            {list.map((x, i) => (
              <Link key={x.id} className="chip" aria-pressed={i === index} to={`/invoices/${inv.id}/receipt/${x.id}`}>{receiptNo(inv, settings, i)} · {kes(x.amount)}</Link>
            ))}
          </div>
        )}
      </div>
      <div className="receipt-wrap">
        <ReceiptDoc inv={inv} p={p} no={no} t={t} paidToDate={paidToDate} balanceAfter={balanceAfter} settings={settings} />
      </div>
    </>
  );
}

export function ReceiptDoc({ inv, p, no, t, paidToDate, balanceAfter, settings }) {
  const s = settings || {};
  const company = s.company || "SpenceTec and Logistics Limited";
  const longDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
  const money = (n) => Math.round(+n || 0).toLocaleString("en-KE");
  const full = balanceAfter <= 0;
  return (
    <article className="invoice-doc receipt-doc" aria-label="Receipt">
      <div className="inv-logo"><img src="/invoice-logo.png" alt={company} /></div>
      <header className="inv-head">
        <h2>RECEIPT</h2>
        <dl>
          <dt>Receipt No:</dt><dd>{no}</dd>
          <dt>Date:</dt><dd>{longDate(p.date) || "—"}</dd>
          <dt>For invoice:</dt><dd>{invNo(inv, s)}</dd>
        </dl>
      </header>

      <section className="inv-parties">
        <div>
          <h3>Received from</h3>
          <p>{inv.billTo?.name || "—"}{inv.billTo?.address && <><br />{inv.billTo.address}</>}
            {(inv.billTo?.phone || inv.billTo?.email) && <><br />{[inv.billTo.phone, inv.billTo.email].filter(Boolean).join(" · ")}</>}</p>
        </div>
        <div>
          <h3>Received by</h3>
          <p>{company}{s.address && <><br />{s.address}</>}{s.phone && <><br />Phone: {s.phone}</>}{s.email && <><br />Email: {s.email}</>}</p>
        </div>
      </section>

      <div className="rcpt-amount">
        <span>Amount received</span>
        <b>KES {money(p.amount)}</b>
        <em>{amountInWords(p.amount)}</em>
      </div>

      <dl className="rcpt-detail">
        <dt>Payment method</dt><dd>{p.method || "—"}</dd>
        {p.ref && <><dt>Reference</dt><dd>{p.ref}</dd></>}
        <dt>Payment for</dt><dd>Invoice {invNo(inv, s)}{inv.items?.[0]?.desc ? ` (${inv.items[0].desc}${inv.items.length > 1 ? " and other items" : ""})` : ""}</dd>
      </dl>

      <dl className="inv-sum">
        <dt>Invoice total</dt><dd>KES {money(t.total)}</dd>
        <dt>Total paid to date</dt><dd>KES {money(paidToDate)}</dd>
        <dt className={full ? "due paid" : "due"}>{full ? "Paid in full" : "Balance remaining"}</dt>
        <dd className={full ? "due paid" : "due"}>KES {money(balanceAfter)}</dd>
      </dl>

      <div className="rcpt-sign">
        <span className={"rcpt-stamp" + (full ? " full" : "")}>{full ? "PAID IN FULL" : "PAYMENT RECEIVED"}</span>
        <span className="rcpt-by">Received by: ______________________<br /><small>for {company}</small></span>
      </div>
      <p className="inv-thanks">{s.footer || "Thank you for your business."}</p>
    </article>
  );
}
