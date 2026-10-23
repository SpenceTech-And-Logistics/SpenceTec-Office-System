import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Empty, Icon, PageHead } from "../ui.jsx";

export default function Team() {
  const { isOwner, toast } = useDesk();
  const [users, setUsers] = useState(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");
  const load = () => api.users().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { if (isOwner) load(); }, [isOwner]);

  if (!isOwner) return <Empty title="Owner only">Ask the owner if you need someone added.</Empty>;

  async function add(e) {
    e.preventDefault(); setErr("");
    try { await api.addUser(email, name); toast(`${name || email} can now sign in`, "ok"); setEmail(""); setName(""); await load(); }
    catch (x) { setErr(x.message); }
  }
  async function remove(u) {
    if (confirm !== u) { setConfirm(u); return; }
    try { await api.removeUser(u); setConfirm(""); toast(`${u} removed and signed out`); await load(); } catch (x) { setErr(x.message); }
  }

  return (
    <>
      <PageHead title="Team access" sub="People who can sign in to the desk" />
      <div className="cols">
        <section className="card-p">
          <div className="ch"><h2>Who can sign in</h2>{users && <span className="count">{users.length}</span>}</div>
          <div className="items">
            {!users ? <p className="quiet">Loading…</p> : users.map((u) => (
              <div className="item" key={u.email}>
                <span className="avatar sm">{(u.name && u.name !== "Owner" ? u.name : u.email)[0].toUpperCase()}</span>
                <span className="t"><span className="tt">{u.name && u.name !== "Owner" ? u.name : u.email}</span><span className="meta">{u.name && u.name !== "Owner" ? u.email : ""}</span></span>
                <span className="pill">{u.role === "owner" ? "Owner" : "Member"}</span>
                {u.role !== "owner" && (
                  <button className={"btn sm" + (confirm === u.email ? " danger" : "")} onBlur={() => setConfirm("")} onClick={() => remove(u.email)}>
                    {confirm === u.email ? "Click to confirm" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
        <form className="card-p" onSubmit={add}>
          <div className="ch"><h2>Add a person</h2></div>
          <div className="fields one">
            <label>Email<input type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Name (optional)<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          </div>
          <button className="btn primary"><Icon name="plus" size={16} />Give access</button>
          <p className="small">They sign in with a one-time code sent to this email. Members can view and edit clients, tasks and payments. Only you can delete clients and manage the team. Removing someone signs them out straight away.</p>
          <div className="err" role="alert">{err}</div>
        </form>
      </div>
    </>
  );
}
