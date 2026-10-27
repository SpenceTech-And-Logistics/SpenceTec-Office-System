import React, { useState } from "react";
import { api } from "./api.js";

export default function Login({ onDone, notice }) {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem("stc-login-mode") || "email"; } catch { return "email"; } });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const switchTo = (m) => { setMode(m); setErr(""); try { localStorage.setItem("stc-login-mode", m); } catch {} };

  async function ask(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api.requestCode(email); setStep("code"); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  async function check(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const r = await api.verify(email, code); onDone(r.user); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  async function signIn(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const r = await api.passwordLogin(username.trim().toLowerCase(), password); onDone(r.user); }
    catch (x) { setErr(x.message); setPassword(""); }
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="login-brand">
        <span className="logo lg">S</span>
        <h1>Client Desk</h1>
        <p>SpenceTec and Logistics Limited · team sign-in</p>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="seg full" role="group" aria-label="How do you sign in?">
        <button type="button" aria-pressed={mode === "email"} onClick={() => switchTo("email")}>Email code</button>
        <button type="button" aria-pressed={mode === "password"} onClick={() => switchTo("password")}>Sales rep username</button>
      </div>
      <div className="panel">
        {mode === "password" ? (
          <form onSubmit={signIn}>
            <label>Username
              <input required autoFocus autoComplete="username" autoCapitalize="none" spellCheck="false" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label>Password
              <input type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
            <button className="btn primary" disabled={busy || !username || !password}>{busy ? "Signing in…" : "Sign in"}</button>
            <span className="small">Forgot your password? Ask the office to reset it.</span>
          </form>
        ) : step === "email" ? (
          <form onSubmit={ask}>
            <label>Work email
              <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
            <span className="small">Only people the owner has added can sign in.</span>
          </form>
        ) : (
          <form onSubmit={check}>
            <span className="small">If {email} is on the team, a 6-digit code is on its way. It lasts 10 minutes.</span>
            <label>Code
              <input className="codein" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </label>
            <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
            <button type="button" className="btn" onClick={() => { setStep("email"); setCode(""); setErr(""); }}>Use a different email</button>
          </form>
        )}
        <div className="err" role="alert">{err}</div>
      </div>
    </div>
  );
}

/* Shown after a sales rep signs in with a temporary password, and from "Change password". */
export function ChangePassword({ forced, onDone, onCancel, onSignOut }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr("");
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("The two new passwords don't match.");
    setBusy(true);
    try { await api.changePassword(current, pw); onDone(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const body = (
    <form onSubmit={submit}>
      {forced
        ? <p className="small">You're signed in with a temporary password. Choose your own to continue. Use at least 8 characters, and don't share it.</p>
        : <label>Current password<input type={show ? "text" : "password"} required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>}
      <label>New password<input type={show ? "text" : "password"} required autoFocus={forced} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <label>Type it again<input type={show ? "text" : "password"} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
      {forced ? <button type="button" className="btn" onClick={onSignOut}>Sign out</button> : <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      <div className="err" role="alert">{err}</div>
    </form>
  );
  if (forced) return (
    <div className="login">
      <div className="login-brand"><span className="logo lg">S</span><h1>Choose your password</h1></div>
      <div className="panel">{body}</div>
    </div>
  );
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-label="Change password">
        <div className="mh"><h2>Change password</h2></div>
        {body}
      </div>
    </div>
  );
}
