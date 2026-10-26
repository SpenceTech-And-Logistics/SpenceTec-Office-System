import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Empty, PageHead } from "../ui.jsx";

const FIELDS = [
  ["company", "Company name", "SpenceTec and Logistics Limited"],
  ["address", "Address", "Nairobi, Kenya"],
  ["phone", "Phone", "+254…"],
  ["email", "Email", "accounts@spencetec.com"],
  ["kraPin", "KRA PIN", "P05…"],
  ["invoicePrefix", "Invoice number prefix", "SPT-"],
  ["vatRate", "Default VAT rate (%)", "16"],
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
          <div className="ch"><h2>On the invoice</h2></div>
          <label>How to pay<textarea rows="6" value={f.payInstructions || ""} onChange={set("payInstructions")}
            placeholder={"M-Pesa Paybill: 000000\nAccount: invoice number\n\nBank: …\nAccount name: SpenceTec and Logistics Limited\nAccount number: …"} /></label>
          <label>Footer line<input value={f.footer || ""} onChange={set("footer")} placeholder="Thank you for your business." /></label>
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
