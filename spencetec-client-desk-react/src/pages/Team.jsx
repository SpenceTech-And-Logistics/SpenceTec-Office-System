import React, { useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Empty, Icon, PageHead } from "../ui.jsx";
import { ROLES, ROLE_HELP, roleName } from "../util.js";

export default function Team() {
  const { me, isOwner, users, loadMeta, toast, clients } = useDesk();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("sales");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");

  if (!isOwner) return <Empty title="Owner only">Ask the owner if you need someone added.</Empty>;

  async function add(e) {
    e.preventDefault(); setErr("");
    try { await api.addUser(email, name, role); toast(`${name || email} added as ${roleName(role)}`, "ok"); setEmail(""); setName(""); loadMeta(); }
    catch (x) { setErr(x.message); }
  }
  async function changeRole(u, r) {
    try { await api.patchUser(u.email, { role: r }); toast(`${u.name || u.email} is now ${roleName(r)}`, "ok"); loadMeta(); }
    catch (x) { toast(x.message, "bad"); }
  }
  async function remove(u) {
    if (confirm !== u) { setConfirm(u); return; }
    try { await api.removeUser(u); setConfirm(""); toast(`${u} removed and signed out`); loadMeta(); } catch (x) { setErr(x.message); }
  }
  const label = (u) => (u.name && u.name !== "Owner" ? u.name : u.email);
  const regs = (email) => clients.filter((c) => c.rep === email || c.createdBy === email).length;

  return (
    <>
      <PageHead title="Team and roles" sub="Who can sign in, and what each person can do" />
      <div className="cols">
        <section className="card-p">
          <div className="ch"><h2>People</h2><span className="count">{users.length}</span></div>
          <div className="items">
            {!users.length ? <p className="quiet">Loading…</p> : users.map((u) => (
              <div className="item team" key={u.email}>
                <span className="avatar sm">{label(u)[0].toUpperCase()}</span>
                <span className="t">
                  <span className="tt">{label(u)}{u.email === me.email ? " (you)" : ""}</span>
                  <span className="meta">{u.name && u.name !== "Owner" ? <span>{u.email}</span> : null}{u.role === "sales" && <span>{regs(u.email)} client{regs(u.email) === 1 ? "" : "s"}</span>}</span>
                </span>
                <select className={"role-sel r-" + u.role} value={u.role} aria-label={`Role for ${label(u)}`} disabled={u.email === me.email}
                  onChange={(e) => changeRole(u, e.target.value)}>
                  {ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                {u.email !== me.email && (
                  <button className={"btn sm" + (confirm === u.email ? " danger" : "")} onBlur={() => setConfirm("")} onClick={() => remove(u.email)}>
                    {confirm === u.email ? "Confirm" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="small">Role changes apply on the person's next click. Removing someone signs them out straight away.</p>
        </section>

        <div className="stack">
          <form className="card-p" onSubmit={add}>
            <div className="ch"><h2>Add a person</h2></div>
            <div className="fields one">
              <label>Email<input type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></label>
              <label>Role<select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            </div>
            <button className="btn primary"><Icon name="plus" size={16} />Give access</button>
            <p className="small">They sign in with a one-time code sent to this email.</p>
            <div className="err" role="alert">{err}</div>
          </form>
          <section className="card-p">
            <div className="ch"><h2>What each role can do</h2></div>
            <dl className="dl roles">
              {ROLES.map(([k, n]) => <React.Fragment key={k}><dt><span className={"role-tag r-" + k}>{n}</span></dt><dd>{ROLE_HELP[k]}</dd></React.Fragment>)}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
