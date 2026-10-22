import React, { useState } from "react";
import { api } from "./api.js";

export default function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
  return (
    <div className="login">
      <div className="brand">
        <h1>SpenceTec Client Desk</h1>
        <p>SpenceTec and Logistics Limited · team sign-in</p>
      </div>
      <div className="panel">
        {step === "email" ? (
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
