import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import Login from "./Login.jsx";
import Team from "./Team.jsx";
import Drawer from "./Drawer.jsx";
import { STAGES, today, kes, stageName, uid, openTasks, overdue, owed, paid } from "./util.js";

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = checking, null = signed out
  useEffect(() => { api.me().then((r) => setMe(r.user)).catch(() => setMe(null)); }, []);
  if (me === undefined) return <div className="wrap"><div className="empty"><b>Loading…</b></div></div>;
  if (!me) return <Login onDone={setMe} />;
  return <Desk me={me} onSignOut={() => setMe(null)} />;
}

function Desk({ me, onSignOut }) {
  const isOwner = me.role === "owner";
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState(() => { try { return localStorage.getItem("stc-view") || "board"; } catch { return "board"; } });
  const [sel, setSel] = useState(null); // id of open client
  const [draft, setDraft] = useState(null);
  const [team, setTeam] = useState(false);

  const refresh = useCallback(async () => {
    try { setClients(await api.clients()); setLoaded(true); setError(""); }
    catch (e) { if (e.status === 401) onSignOut(); else { setError(e.message); setLoaded(true); } }
  }, [onSignOut]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { try { localStorage.setItem("stc-view", view); } catch {} }, [view]);
  useEffect(() => { const k = (e) => e.key === "Escape" && (setSel(null), setDraft(null), setTeam(false)); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => !s || [c.name, c.type, c.domain, c.repo, c.hosting, c.email].join(" ").toLowerCase().includes(s));
  }, [clients, q]);

  const stats = useMemo(() => {
    const od = clients.reduce((a, c) => a + overdue(c).length, 0);
    const ow = clients.reduce((a, c) => a + owed(c), 0);
    return [
      [clients.length, "Clients"],
      [clients.filter((c) => ["live", "maintenance"].includes(c.stage)).length, "Live or maintained"],
      [clients.filter((c) => ["design", "build", "review"].includes(c.stage)).length, "In progress"],
      [clients.reduce((a, c) => a + openTasks(c).length, 0), "Open tasks"],
      [od, "Overdue tasks", od > 0],
      [kes(ow), "Outstanding", ow > 0],
      [kes(clients.reduce((a, c) => a + paid(c), 0)), "Paid to date"],
    ];
  }, [clients]);

  const upnext = useMemo(() => {
    const all = [];
    clients.forEach((c) => openTasks(c).forEach((t) => all.push({ c, t })));
    return all.sort((a, b) => (a.t.due || "9999").localeCompare(b.t.due || "9999")).slice(0, 8);
  }, [clients]);

  const move = async (c, d) => {
    const i = STAGES.findIndex((s) => s[0] === c.stage) + d;
    if (STAGES[i]) { await api.patchClient(c.id, { stage: STAGES[i][0] }).catch(() => {}); refresh(); }
  };

  const openClient = sel ? clients.find((c) => c.id === sel) : null;
  const current = draft || openClient;
  const close = () => { setSel(null); setDraft(null); };

  async function signOut() { await api.logout().catch(() => {}); onSignOut(); }

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1>SpenceTec Client Desk</h1>
          <p>SpenceTec and Logistics Limited · private client pipeline</p>
        </div>
        <div className="tools">
          <input className="search" type="search" placeholder="Search clients" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === "board"} onClick={() => setView("board")}>Board</button>
            <button aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          </div>
          <button className="btn primary" onClick={() => { const id = "c-" + uid(); setDraft({ id, name: "", stage: "enquiry", content: "none", tasks: [], payments: [] }); setSel(id); }}>Add client</button>
          {isOwner && <button className="btn" onClick={() => setTeam(true)}>Team</button>}
          <span className="who">{me.email}</span>
          <button className="btn sm" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="stats" aria-label="Summary">
        {stats.map(([v, l, alert]) => <div key={l} className={"stat" + (alert ? " alert" : "")}><b>{v}</b><span>{l}</span></div>)}
      </section>

      <div className="grid">
        <main>
          {error ? <div className="empty"><b>Can't reach the client database</b>{error}. Check your connection and refresh.</div>
          : !loaded ? <div className="empty"><b>Loading clients…</b>One moment.</div>
          : !clients.length ? <div className="empty"><b>No clients yet</b>Add your first client, or run the seed step in the README.</div>
          : !list.length ? <div className="empty"><b>No match</b>Nothing matches that search.</div>
          : view === "board" ? (
            <div className="board">
              {STAGES.map(([k, n]) => {
                const cs = list.filter((c) => c.stage === k);
                return (
                  <section className="col" key={k} style={{ "--c": `var(--s-${k})` }}>
                    <h3><span><i />{n}</span><em>{cs.length}</em></h3>
                    {cs.map((c) => <Card key={c.id} c={c} onOpen={() => setSel(c.id)} onMove={move} />)}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="tablewrap"><table>
              <thead><tr><th>Client</th><th>Stage</th><th>Domain</th><th>Hosting</th><th>Tasks</th><th>Outstanding</th></tr></thead>
              <tbody>{list.map((c) => (
                <tr key={c.id} onClick={() => setSel(c.id)}>
                  <td><b>{c.name}</b><br /><span className="note">{c.type}</span></td>
                  <td><span className="pill" style={{ color: `var(--s-${c.stage})` }}>{stageName(c.stage)}</span></td>
                  <td>{c.domain || "—"}</td><td>{c.hosting || "—"}</td>
                  <td>{openTasks(c).length}{overdue(c).length > 0 && <> <span className="pill bad">{overdue(c).length} late</span></>}</td>
                  <td>{owed(c) ? kes(owed(c)) : "—"}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </main>
        <aside className="panel" aria-label="Next up">
          <h2>Next up</h2>
          {upnext.length ? upnext.map(({ c, t }) => (
            <button className="up" key={c.id + t.id} onClick={() => setSel(c.id)}>
              <span>{c.name}</span>{t.text}
              <span>{t.due ? (t.due < today() ? <b style={{ color: "var(--bad)" }}>Overdue · {t.due}</b> : "Due " + t.due) : "No date"}</span>
            </button>
          )) : <span className="note">{loaded ? "No open tasks." : "Loading…"}</span>}
        </aside>
      </div>
      <p className="foot">Built by SpenceTec and Logistics Limited · amounts in KES</p>

      {current && (
        <Drawer
          key={current.id}
          client={current}
          isNew={!!draft}
          isOwner={isOwner}
          onClose={close}
          onSave={async (data) => {
            await api.saveClient(current.id, draft ? data : { ...openClient, ...data });
            if (draft) { setDraft(null); }
            await refresh();
          }}
          onPatch={async (d) => { await api.patchClient(current.id, d); await refresh(); }}
          onDelete={async () => { await api.deleteClient(current.id); close(); await refresh(); }}
        />
      )}
      {team && <Team me={me} onClose={() => setTeam(false)} />}
    </div>
  );
}

function Card({ c, onOpen, onMove }) {
  const i = STAGES.findIndex((s) => s[0] === c.stage);
  const od = overdue(c).length, ot = openTasks(c).length, ow = owed(c), cs = c.content || "none";
  return (
    <div className="card" style={{ "--c": `var(--s-${c.stage})` }} role="button" tabIndex={0}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
      <strong>{c.name}</strong>
      <small>{c.type}{c.domain ? " · " + c.domain : ""}</small>
      <div className="row">
        {od ? <span className="pill bad">{od} overdue</span> : ot ? <span className="pill">{ot} open</span> : null}
        {ow ? <span className="pill warn">{kes(ow)} due</span> : null}
        {cs !== "full" && <span className={"pill" + (cs === "partial" ? " warn" : "")}>Content: {cs === "partial" ? "partial" : "awaited"}</span>}
        <span className="mv">
          <button disabled={i <= 0} aria-label="Move back" onClick={(e) => { e.stopPropagation(); onMove(c, -1); }}>←</button>
          <button disabled={i >= STAGES.length - 1} aria-label="Move forward" onClick={(e) => { e.stopPropagation(); onMove(c, 1); }}>→</button>
        </span>
      </div>
    </div>
  );
}
