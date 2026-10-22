import React, { useState } from "react";
import { STAGES, CONTENT, today, kes, uid, tasksOf, paysOf, owed, paid } from "./util.js";

const TEXT = [
  ["name","Client name","e.g. Lilian Wanjiku Manegene"],["type","Project type","e.g. Portfolio SPA"],
];
const TEXT2 = [
  ["domain","Domain","name.com"],["hosting","Hosting","Cloudflare, Firebase…"],
];
const TEXT3 = [["firebase","Firebase project",""],["email","Client email",""],["phone","Client phone",""]];

export default function Drawer({ client, isNew, isOwner, onSave, onPatch, onDelete, onClose }) {
  const [f, setF] = useState(() => ({ ...client }));
  const [msg, setMsg] = useState("");
  const [armed, setArmed] = useState(false);
  const [tText, setTText] = useState(""); const [tDue, setTDue] = useState("");
  const [pLabel, setPLabel] = useState(""); const [pAmt, setPAmt] = useState(""); const [pDate, setPDate] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const input = ([k, l, ph], full) => (
    <label key={k} className={full ? "full" : ""}>{l}<input value={f[k] || ""} placeholder={ph} onChange={set(k)} /></label>
  );
  const tasks = tasksOf(client).slice().sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
  const pays = paysOf(client);

  async function save() {
    if (!f.name?.trim()) { setMsg("Give the client a name first."); return; }
    const data = {};
    ["name","type","stage","content","domain","hosting","repo","firebase","email","phone","notes"].forEach((k) => (data[k] = (f[k] || "").trim()));
    try { await onSave(data); setMsg("Saved."); } catch (e) { setMsg(e.message || "Couldn't save."); }
  }
  const act = (fn) => fn().catch((e) => setMsg(e.message));

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-label="Client record">
        <div className="dh"><h2>{client.name || "New client"}</h2><button className="btn sm" onClick={onClose}>Close</button></div>
        <div className="panel"><h2>Details</h2>
          <div className="fields">
            {TEXT.map((x) => input(x))}
            <label>Stage<select value={f.stage || "enquiry"} onChange={set("stage")}>{STAGES.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></label>
            <label>Content from client<select value={f.content || "none"} onChange={set("content")}>{CONTENT.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></label>
            {TEXT2.map((x) => input(x))}
            {input(["repo","Repository","github.com/…"], true)}
            {TEXT3.map((x) => input(x))}
            <label className="full">Notes<textarea value={f.notes || ""} onChange={set("notes")} /></label>
          </div>
          <div className="row">
            <button className="btn primary" onClick={save}>{isNew ? "Create client" : "Save details"}</button>
            {!isNew && isOwner && (
              <button className="btn danger" onClick={() => (armed ? act(onDelete) : setArmed(true))}>{armed ? "Tap again to delete" : "Delete client"}</button>
            )}
            <span className="note">{msg}</span>
          </div>
          {client.updatedBy && <span className="note">Last changed by {client.updatedBy}</span>}
        </div>
        {!isNew && (<>
          <div className="panel"><h2>Tasks and deadlines</h2>
            <div>{tasks.length ? tasks.map((t) => (
              <div className="item" key={t.id}>
                <input type="checkbox" checked={!!t.done} aria-label="Done" onChange={(e) => act(() => onPatch({ tasks: tasksOf(client).map((x) => x.id === t.id ? { ...x, done: e.target.checked } : x) }))} />
                <span className={"t" + (t.done ? " done" : "")}>{t.text}</span>
                {t.due && <span className={"pill" + (!t.done && t.due < today() ? " bad" : "")}>{t.due}</span>}
                <button className="btn sm" aria-label="Remove task" onClick={() => act(() => onPatch({ tasks: tasksOf(client).filter((x) => x.id !== t.id) }))}>✕</button>
              </div>)) : <span className="note">No tasks yet.</span>}</div>
            <form className="add" onSubmit={(e) => { e.preventDefault(); if (!tText.trim()) return; act(() => onPatch({ tasks: [...tasksOf(client), { id: uid(), text: tText.trim(), due: tDue, done: false }] })).then(() => { setTText(""); setTDue(""); }); }}>
              <input placeholder="New task" aria-label="Task" value={tText} onChange={(e) => setTText(e.target.value)} />
              <input type="date" aria-label="Due date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
              <button className="btn">Add</button>
            </form>
          </div>
          <div className="panel"><h2>Payments</h2>
            <div className="sum"><span>Invoiced <b>{kes(paid(client) + owed(client))}</b></span><span>Paid <b>{kes(paid(client))}</b></span><span>Outstanding <b>{kes(owed(client))}</b></span></div>
            <div>{pays.length ? pays.map((p) => (
              <div className="item" key={p.id}>
                <input type="checkbox" checked={p.status === "paid"} aria-label="Paid" onChange={(e) => act(() => onPatch({ payments: paysOf(client).map((x) => x.id === p.id ? { ...x, status: e.target.checked ? "paid" : "pending" } : x) }))} />
                <span className="t">{p.label}{p.date && <span className="note"> · {p.date}</span>}</span>
                <b>{kes(p.amount)}</b>
                <span className={"pill " + (p.status === "paid" ? "ok" : "warn")}>{p.status === "paid" ? "Paid" : "Pending"}</span>
                <button className="btn sm" aria-label="Remove payment" onClick={() => act(() => onPatch({ payments: paysOf(client).filter((x) => x.id !== p.id) }))}>✕</button>
              </div>)) : <span className="note">No payments recorded.</span>}</div>
            <form className="add pay" onSubmit={(e) => { e.preventDefault(); const a = +pAmt; if (!pLabel.trim() || !a) return; act(() => onPatch({ payments: [...paysOf(client), { id: uid(), label: pLabel.trim(), amount: a, date: pDate, status: "pending" }] })).then(() => { setPLabel(""); setPAmt(""); setPDate(""); }); }}>
              <input placeholder="Deposit, balance…" aria-label="Payment label" value={pLabel} onChange={(e) => setPLabel(e.target.value)} />
              <input type="number" min="0" placeholder="Amount" aria-label="Amount" value={pAmt} onChange={(e) => setPAmt(e.target.value)} />
              <input type="date" aria-label="Due or paid date" value={pDate} onChange={(e) => setPDate(e.target.value)} />
              <button className="btn">Add</button>
            </form>
            <span className="note">Tick a payment when the money has arrived.</span>
          </div>
        </>)}
      </div>
    </div>
  );
}
