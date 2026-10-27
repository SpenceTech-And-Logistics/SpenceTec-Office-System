import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// Shared data for every page, with optimistic updates so ticks and moves feel instant.
const Ctx = createContext(null);
export const useDesk = () => useContext(Ctx);

export function DeskProvider({ me, session, onSignOut, children }) {
  const isOwner = me.role === "owner";
  const isStaff = isOwner || me.role === "secretary";
  const isSales = me.role === "sales";
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const busy = useRef(0); // skip polling results while a write is in flight

  const toast = useCallback((text, kind = "") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // poll = background refresh, which must not count as activity for the sign-in timeout
  const refresh = useCallback(async (poll) => {
    try {
      const bg = poll === true;
      const [list, inv] = await Promise.all([api.clients(bg), isStaff ? api.invoices(bg) : []]);
      if (!busy.current) { setClients(list); setInvoices(inv); }
      setLoaded(true); setError("");
    } catch (e) {
      if (e.status === 401) onSignOut(e.expired ? e.message : ""); else { setError(e.message); setLoaded(true); }
    }
  }, [onSignOut, isStaff]);

  const loadMeta = useCallback((poll) => {
    if (!isStaff) return;
    api.users(poll === true).then(setUsers).catch(() => {});
    if (poll !== true) api.settings().then(setSettings).catch(() => {});
  }, [isStaff]);

  useEffect(() => {
    refresh(); loadMeta();
    const t = setInterval(() => { if (document.visibilityState === "visible") { refresh(true); loadMeta(true); } }, 20000);
    const v = () => document.visibilityState === "visible" && refresh(true);
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [refresh, loadMeta]);

  // patch(id, fields | (client) => fields)
  const patch = useCallback(async (id, fields, okText) => {
    let body = fields;
    setClients((cs) => cs.map((c) => {
      if (c.id !== id) return c;
      if (typeof fields === "function") body = fields(c);
      return { ...c, ...body };
    }));
    busy.current++;
    try {
      await api.patchClient(id, body);
      if (okText) toast(okText, "ok");
    } catch (e) {
      toast(e.message || "Couldn't save", "bad");
    } finally {
      busy.current--;
      refresh();
    }
  }, [refresh, toast]);

  const create = useCallback(async (id, data) => { await api.saveClient(id, data); await refresh(); }, [refresh]);
  const remove = useCallback(async (id) => {
    await api.deleteClient(id);
    setClients((cs) => cs.filter((c) => c.id !== id));
    refresh();
  }, [refresh]);

  const patchInvoice = useCallback(async (id, fields, okText) => {
    setInvoices((xs) => xs.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    busy.current++;
    try { await api.patchInvoice(id, fields); if (okText) toast(okText, "ok"); }
    catch (e) { toast(e.message || "Couldn't save", "bad"); throw e; }
    finally { busy.current--; refresh(); }
  }, [refresh, toast]);

  const person = useCallback((email) => {
    if (!email) return "";
    if (email === me.email) return "You";
    const u = users.find((x) => x.email === email);
    return (u && u.name && u.name !== "Owner" ? u.name : email.split("@")[0]);
  }, [users, me.email]);

  const value = {
    me, isOwner, isStaff, isSales, clients, invoices, users, settings, loaded, error,
    refresh, loadMeta, patch, create, remove, patchInvoice, setSettings, toast, onSignOut, person,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {session?.limited ? <SessionGuard session={session} onSignOut={onSignOut} /> : <ActivityPing />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"toast " + t.kind}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}

/* ---------- sign-in timeout for secretaries and sales reps ---------- */
// The Worker is the real guard (it refuses requests after the limits). This keeps the page in step
// with it, warns two minutes before an inactivity sign-out, and shares activity across open tabs.
const ACT_KEY = "stc-last-activity";
const readShared = () => { try { return +localStorage.getItem(ACT_KEY) || 0; } catch { return 0; } };
const writeShared = (t) => { try { localStorage.setItem(ACT_KEY, String(t)); } catch {} };
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function SessionGuard({ session, onSignOut }) {
  const idleMs = session.idleMinutes * 60000;
  const endsAt = session.endsAt * 1000;
  const last = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const done = useRef(false);
  const [left, setLeft] = useState(null);   // ms until inactivity sign-out, when warning
  const [endsSoon, setEndsSoon] = useState(false);

  const end = useCallback(async (msg) => {
    if (done.current) return;
    done.current = true;
    await api.logout().catch(() => {});
    onSignOut(msg);
  }, [onSignOut]);

  const activity = useCallback(() => {
    const t = Date.now();
    if (t - last.current < 3000) return;
    last.current = t;
    writeShared(t);
    if (t - lastPing.current > 60000) {
      lastPing.current = t;
      api.ping().catch((e) => { if (e.status === 401) end(e.expired ? e.message : ""); });
    }
  }, [end]);

  useEffect(() => {
    writeShared(Date.now());
    const evs = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"];
    evs.forEach((e) => window.addEventListener(e, activity, { passive: true, capture: true }));
    const tick = setInterval(() => {
      const t = Date.now();
      const lastAct = Math.max(last.current, readShared());
      const remaining = idleMs - (t - lastAct);
      if (remaining <= 0) return end(`You were signed out after ${session.idleMinutes} minutes without activity.`);
      if (t >= endsAt) return end(`You were signed out because sign-ins last ${session.maxHours} hour${session.maxHours === 1 ? "" : "s"}. Sign in again to continue.`);
      setLeft(remaining <= 120000 ? remaining : null);
      setEndsSoon(endsAt - t <= 10 * 60000);
    }, 1000);
    return () => { evs.forEach((e) => window.removeEventListener(e, activity, { capture: true })); clearInterval(tick); };
  }, [activity, end, idleMs, endsAt, session]);

  const stay = () => { last.current = 0; lastPing.current = 0; activity(); setLeft(null); };
  const endTime = new Date(endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {endsSoon && left === null && (
        <div className="session-bar" role="status">Your sign-in ends at {endTime}. Save what you're working on; you'll need to sign in again after that.</div>
      )}
      {left !== null && (
        <div className="scrim" role="alertdialog" aria-labelledby="idle-h">
          <div className="modal idle">
            <h2 id="idle-h">Are you still there?</h2>
            <p>To keep client details safe, you'll be signed out in <b>{mmss(left)}</b> because there's been no activity.</p>
            <div className="mf">
              <button className="btn" onClick={() => end("You signed out.")}>Sign out now</button>
              <button className="btn primary" autoFocus onClick={stay}>Stay signed in</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Owners don't time out, but their activity still shows them as online. */
function ActivityPing() {
  useEffect(() => {
    let last = 0;
    const f = () => { const t = Date.now(); if (t - last > 60000) { last = t; api.ping().catch(() => {}); } };
    const evs = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"];
    evs.forEach((e) => window.addEventListener(e, f, { passive: true, capture: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, f, { capture: true }));
  }, []);
  return null;
}
