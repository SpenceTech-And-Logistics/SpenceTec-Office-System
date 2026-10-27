import React, { useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Empty, Icon, PageHead } from "../ui.jsx";
import { ROLES, ROLE_HELP, roleName, statusText } from "../util.js";
import { Link } from "../router.jsx";

export default function Team() {
  const { me, isOwner, users, loadMeta, toast, clients } = useDesk();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("sales");
  const [how, setHow] = useState("password"); // sales reps: "password" (username) or "email"
  const [username, setUsername] = useState("");
  const [creds, setCreds] = useState(null);   // { name, username, tempPassword, reset }
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");

  if (!isOwner) return <Empty title="Owner only">Ask the owner if you need someone added.</Empty>;

  const byUsername = role === "sales" && how === "password";
  const suggest = (n) => n.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 30);
  async function add(e) {
    e.preventDefault(); setErr("");
    try {
      if (byUsername) {
        const r = await api.addUsername(username.trim().toLowerCase(), name);
        setCreds({ name: name || r.username, username: r.username, tempPassword: r.tempPassword });
        setUsername("");
      } else {
        await api.addUser(email, name, role);
        toast(`${name || email} added as ${roleName(role)}`, "ok");
        setEmail("");
      }
      setName(""); loadMeta();
    } catch (x) { setErr(x.message); }
  }
  async function reset(u) {
    if (confirm !== "reset:" + u.email) { setConfirm("reset:" + u.email); return; }
    try { const r = await api.resetPassword(u.email); setConfirm(""); setCreds({ name: label(u), username: r.username, tempPassword: r.tempPassword, reset: true }); loadMeta(); }
    catch (x) { toast(x.message, "bad"); }
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
          <div className="ch"><h2>People</h2><span className="count">{users.filter((u) => u.status === "online").length} of {users.length} online</span></div>
          <div className="items">
            {!users.length ? <p className="quiet">Loading…</p> : users.map((u) => (
              <div className="item team" key={u.email}>
                <span className="avatar sm with-dot">{label(u)[0].toUpperCase()}<i className={"dot s-" + u.status} title={statusText(u)} /></span>
                <span className="t">
                  <span className="tt">{label(u)}{u.email === me.email ? " (you)" : ""}</span>
                  <span className="meta">
                    {u.name && u.name !== "Owner" ? <span>{u.login === "password" ? "Username: " : ""}{u.email}</span> : null}
                    {u.login === "password" && <span className="pill">{u.mustChange ? "Temporary password" : "Password login"}</span>}
                    {u.lockedUntil * 1000 > Date.now() && <span className="pill bad">Locked</span>}
                    {u.role === "sales" && <span>{regs(u.email)} client{regs(u.email) === 1 ? "" : "s"}</span>}
                  </span>
                  <span className="meta"><span className={"st s-" + u.status}>{statusText(u)}</span><Link className="clink" to={`/activity?person=${encodeURIComponent(u.email)}`}>Activity</Link></span>
                </span>
                {u.login === "password" ? (
                  <button className={"btn sm" + (confirm === "reset:" + u.email ? " primary" : "")} onBlur={() => setConfirm("")} onClick={() => reset(u)}
                    title="Give them a new temporary password">{confirm === "reset:" + u.email ? "Confirm reset" : "Reset password"}</button>
                ) : (
                  <select className={"role-sel r-" + u.role} value={u.role} aria-label={`Role for ${label(u)}`} disabled={u.email === me.email}
                    onChange={(e) => changeRole(u, e.target.value)}>
                    {ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                )}
                {u.email !== me.email && (
                  <button className={"btn sm" + (confirm === u.email ? " danger" : "")} onBlur={() => setConfirm("")} onClick={() => remove(u.email)}>
                    {confirm === u.email ? "Confirm" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="small">Role changes apply on the person's next click. Removing someone signs them out straight away. Username accounts are always sales reps; to give someone a bigger role, add them with an email.</p>
        </section>

        <div className="stack">
          <form className="card-p" onSubmit={add}>
            <div className="ch"><h2>Add a person</h2></div>
            <div className="fields one">
              <label>Role<select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              {role === "sales" && (
                <div className="seg full" role="group" aria-label="How they sign in">
                  <button type="button" aria-pressed={how === "password"} onClick={() => setHow("password")}>Username and password</button>
                  <button type="button" aria-pressed={how === "email"} onClick={() => setHow("email")}>Email code</button>
                </div>
              )}
              <label>Name<input value={name} onChange={(e) => { const v = e.target.value; if (byUsername && (!username || username === suggest(name))) setUsername(suggest(v)); setName(v); }} placeholder={byUsername ? "e.g. Brian Otieno" : "Optional"} required={byUsername} /></label>
              {byUsername
                ? <label>Username<input required value={username} autoCapitalize="none" spellCheck="false" placeholder="brian.otieno" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} /></label>
                : <label>Email<input type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
            </div>
            <button className="btn primary"><Icon name="plus" size={16} />{byUsername ? "Create login" : "Give access"}</button>
            <p className="small">{byUsername
              ? "No email needed. You'll get a temporary password to give them; they choose their own the first time they sign in."
              : "They sign in with a one-time code sent to this email."}</p>
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
      {creds && <Credentials creds={creds} onClose={() => setCreds(null)} />}
    </>
  );
}

function Credentials({ creds, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = location.origin;
  const text = `Hi ${creds.name.split(" ")[0]}, here is your SpenceTec Client Desk login.\n\nOpen: ${link}\nTap "Sales rep username"\nUsername: ${creds.username}\nTemporary password: ${creds.tempPassword}\n\nYou'll choose your own password when you first sign in. Please don't share it.`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch {} };
  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-label="Login details">
        <div className="mh"><h2>{creds.reset ? "New temporary password" : "Login created"}</h2></div>
        <p className="small">Give these to {creds.name} in person or by WhatsApp. <b>This password is shown only now.</b> If it's lost, use Reset password.</p>
        <dl className="creds">
          <dt>Username</dt><dd><code>{creds.username}</code></dd>
          <dt>Temporary password</dt><dd><code>{creds.tempPassword}</code></dd>
        </dl>
        {creds.reset && <p className="small">Their old password no longer works, and they've been signed out everywhere.</p>}
        <div className="mf">
          <a className="btn" href={"https://wa.me/?text=" + encodeURIComponent(text)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} />WhatsApp</a>
          <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy message"}</button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
