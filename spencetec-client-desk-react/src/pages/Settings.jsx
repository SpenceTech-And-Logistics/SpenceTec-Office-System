import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Empty, PageHead } from "../ui.jsx";
import { DEFAULT_TERMS, fillTerms, invNo } from "../util.js";

const FIELDS = [
  ["company", "Company name", "SpenceTec and Logistics Limited"],
  ["address", "Address", "P.O. Box 7183-00200, Nairobi"],
  ["phone", "Phone", "+254…"],
  ["email", "Email", "info@spencetec.com"],
  ["kraPin", "KRA PIN (optional)", "P05…"],
];
const NUMBERING = [
  ["invoicePrefix", "Prefix", "INV-"],
  ["invoicePad", "Digits", "3"],
  ["invoiceStart", "Next number at least", "6"],
];

export default function Settings() {
  const { isOwner, settings, setSettings, toast } = useDesk();
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(settings), [settings]);
  if (!isOwner) return <Empty title="Owner only" />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault(); setBusy(true);
    try { await api.saveSettings(f); setSettings(f); toast("Settings saved", "ok"); }
    catch (x) { toast(x.message, "bad"); }
    setBusy(false);
  }
  return (
    <>
      <PageHead title="Company settings" sub="These details appear on every invoice" />
      <form className="cols" onSubmit={save}>
        <section className="card-p">
          <div className="ch"><h2>Company</h2></div>
          <div className="fields">
            {FIELDS.map(([k, l, ph]) => <label key={k} className={k === "company" ? "full" : ""}>{l}<input value={f[k] || ""} placeholder={ph} onChange={set(k)} /></label>)}
          </div>
        </section>
        <section className="card-p">
          <div className="ch"><h2>Invoice template</h2></div>
          <div className="fields three">
            {NUMBERING.map(([k, l, ph]) => <label key={k}>{l}<input value={f[k] ?? ""} placeholder={ph} onChange={set(k)} /></label>)}
          </div>
          <p className="small">Next invoice looks like <b>{invNo({ number: Math.max(+f.invoiceStart || 1, 1) }, f)}</b> (or the number after your latest invoice, whichever is higher).</p>
          <div className="fields">
            <label>Default deposit (%)<input type="number" min="0" max="100" value={f.depositPct ?? 75} onChange={set("depositPct")} /></label>
            <label>Default VAT rate (%)<input type="number" min="0" max="100" value={f.vatRate ?? 16} onChange={set("vatRate")} /></label>
          </div>
          <label>Payment details<textarea rows="5" value={f.payInstructions || ""} onChange={set("payInstructions")}
            placeholder={"M-Pesa: 07…\nBank: …\nAccount name: …\nAccount / reference number: …"} /></label>
          <label>Default payment terms<textarea rows="4" value={f.terms ?? ""} placeholder={DEFAULT_TERMS} onChange={set("terms")} /></label>
          <p className="small">Preview: {fillTerms(f.terms || DEFAULT_TERMS, +f.depositPct || 75)}</p>
          <label>Closing line<input value={f.footer || ""} onChange={set("footer")} placeholder="Thank you for your business." /></label>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </section>
        <section className="card-p">
          <div className="ch"><h2>Sign-in security</h2></div>
          <p className="small">For secretaries and sales reps. Your own owner sign-in isn't affected.</p>
          <div className="fields">
            <label>Sign out after inactivity (minutes)<input type="number" min="5" max="480" value={f.idleMinutes ?? 30} onChange={set("idleMinutes")} /></label>
            <label>Longest sign-in (hours)<input type="number" min="1" max="72" value={f.maxHours ?? 8} onChange={set("maxHours")} /></label>
          </div>
          <p className="small">People get a two-minute warning before an inactivity sign-out. Changes apply on their next click.</p>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </section>
      </form>
    </>
  );
}
