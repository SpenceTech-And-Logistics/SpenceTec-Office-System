import React, { useEffect, useState } from "react";
import { api } from "./api.js";

export default function Team({ me, onClose }) {
  const [users, setUsers] = useState(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");
  const load = () => api.users().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setErr("");
    try { await api.addUser(email, name); setEmail(""); setName(""); await load(); }
    catch (x) { setErr(x.message); }
  }
  async function remove(u) {
    if (confirm !== u) { setConfirm(u); return; }
    try { await api.removeUser(u); setConfirm(""); await load(); } catch (x) { setErr(x.message); }
  }
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-label="Team">
        <div className="dh"><h2>Team access</h2><button className="btn sm" onClick={onClose}>Close</button></div>
        <div className="panel">
          <h2>Add a person</h2>
          <form className="team-add" onSubmit={add}>
            <input type="email" required placeholder="email@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Name (optional)" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary">Add</button>
          </form>
          <span className="small">They sign in with a one-time code sent to this email. Removing them signs them out straight away.</span>
          <div className="err" role="alert">{err}</div>
        </div>
        <div className="panel">
          <h2>Who can sign in</h2>
          {!users ? <span className="small">Loading…</span> : users.map((u) => (
            <div className="item" key={u.email}>
              <span className="t"><b>{u.name || u.email}</b>{u.name ? <><br /><span className="small">{u.email}</span></> : null}</span>
              <span className="pill">{u.role}</span>
              {u.role !== "owner" && (
                <button className={"btn sm" + (confirm === u.email ? " danger" : "")} onClick={() => remove(u.email)}>
                  {confirm === u.email ? "Tap to remove" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
