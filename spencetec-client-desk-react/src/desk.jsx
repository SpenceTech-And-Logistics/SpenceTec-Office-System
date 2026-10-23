import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// Shared client data for every page, with optimistic updates so ticks and moves feel instant.
const Ctx = createContext(null);
export const useDesk = () => useContext(Ctx);

export function DeskProvider({ me, onSignOut, children }) {
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const busy = useRef(0); // skip polling results while a write is in flight

  const toast = useCallback((text, kind = "") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await api.clients();
      if (!busy.current) setClients(list);
      setLoaded(true); setError("");
    } catch (e) {
      if (e.status === 401) onSignOut(); else { setError(e.message); setLoaded(true); }
    }
  }, [onSignOut]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 20000);
    const v = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [refresh]);

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

  const create = useCallback(async (id, data) => {
    await api.saveClient(id, data);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id) => {
    await api.deleteClient(id);
    setClients((cs) => cs.filter((c) => c.id !== id));
    refresh();
  }, [refresh]);

  const value = { me, isOwner: me.role === "owner", clients, loaded, error, refresh, patch, create, remove, toast, onSignOut };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"toast " + t.kind}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}
