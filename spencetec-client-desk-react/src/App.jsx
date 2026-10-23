import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import Login from "./Login.jsx";
import { DeskProvider, useDesk } from "./desk.jsx";
import { Link, navigate, useLocation } from "./router.jsx";
import { Icon, Stage } from "./ui.jsx";
import { STAGES, slug, overdue } from "./util.js";
import Overview from "./pages/Overview.jsx";
import Clients from "./pages/Clients.jsx";
import ClientPage from "./pages/ClientPage.jsx";
import Tasks from "./pages/Tasks.jsx";
import Payments from "./pages/Payments.jsx";
import Team from "./pages/Team.jsx";

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = checking, null = signed out
  useEffect(() => { api.me().then((r) => setMe(r.user)).catch(() => setMe(null)); }, []);
  if (me === undefined) return <div className="boot"><span className="logo">S</span></div>;
  if (!me) return <Login onDone={setMe} />;
  return <DeskProvider me={me} onSignOut={() => setMe(null)}><Shell /></DeskProvider>;
}

const NAV = [
  ["/", "Overview", "home"],
  ["/clients", "Clients", "clients"],
  ["/tasks", "Tasks", "tasks"],
  ["/payments", "Payments", "money"],
];

function Shell() {
  const { me, isOwner, clients, onSignOut } = useDesk();
  const { path } = useLocation();
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const late = clients.reduce((a, c) => a + overdue(c).length, 0);

  const nav = isOwner ? [...NAV, ["/team", "Team", "team"]] : NAV;
  const active = (to) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));

  useEffect(() => {
    const k = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (e.key === "Escape") { setAdding(false); setMenu(false); }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("qsearch")?.focus(); }
      if (e.key === "n") { e.preventDefault(); setAdding(true); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setMenu(false), [path]);

  async function signOut() { await api.logout().catch(() => {}); onSignOut(); }

  let page;
  const m = path.match(/^\/clients\/([^/]+)$/);
  if (path === "/") page = <Overview />;
  else if (path === "/clients") page = <Clients onAdd={() => setAdding(true)} />;
  else if (m) page = <ClientPage id={decodeURIComponent(m[1])} />;
  else if (path === "/tasks") page = <Tasks />;
  else if (path === "/payments") page = <Payments />;
  else if (path === "/team") page = <Team />;
  else page = <div className="empty"><b>Page not found</b><Link to="/">Go to Overview</Link></div>;

  const initial = (me.name && me.name !== "Owner" ? me.name : me.email)[0].toUpperCase();

  return (
    <div className="app">
      <aside className="side">
        <Link to="/" className="brand"><span className="logo">S</span><span><b>Client Desk</b><small>SpenceTec</small></span></Link>
        <button className="btn primary block" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New client</button>
        <nav aria-label="Main">
          {nav.map(([to, n, ic]) => (
            <Link key={to} to={to} className="navlink" aria-current={active(to) ? "page" : undefined}>
              <Icon name={ic} />{n}
              {to === "/tasks" && late > 0 && <em className="badge" title={`${late} overdue`}>{late}</em>}
            </Link>
          ))}
        </nav>
        <div className="me">
          <span className="avatar">{initial}</span>
          <span className="who"><b>{me.name && me.name !== "Owner" ? me.name : me.email.split("@")[0]}</b><small>{me.role === "owner" ? "Owner" : "Team member"}</small></span>
          <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={signOut}><Icon name="out" /></button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <Link to="/" className="brand mobile-only"><span className="logo">S</span></Link>
          <QuickSearch />
          <button className="btn primary add-top" onClick={() => setAdding(true)} aria-label="New client"><Icon name="plus" size={16} /><span>New client</span></button>
          <div className="menuwrap mobile-only">
            <button className="avatar as-btn" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>{initial}</button>
            {menu && (
              <div className="menu" role="menu">
                <span className="menu-who">{me.email}</span>
                {isOwner && <Link to="/team" role="menuitem"><Icon name="team" />Team access</Link>}
                <button role="menuitem" onClick={signOut}><Icon name="out" />Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="page" key={path}>{page}</main>
        <footer className="foot">Built by SpenceTec and Logistics Limited · amounts in KES<span className="hint"> · press <kbd>/</kbd> to search, <kbd>N</kbd> for a new client</span></footer>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.map(([to, n, ic]) => (
          <Link key={to} to={to} aria-current={active(to) ? "page" : undefined}>
            <Icon name={ic} size={20} /><span>{n}</span>
            {to === "/tasks" && late > 0 && <em className="badge">{late}</em>}
          </Link>
        ))}
      </nav>

      {adding && <NewClient onClose={() => setAdding(false)} />}
    </div>
  );
}

function QuickSearch() {
  const { clients } = useDesk();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const box = useRef(null);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return clients.filter((c) => [c.name, c.type, c.domain, c.repo, c.hosting, c.email, c.phone].join(" ").toLowerCase().includes(s)).slice(0, 7);
  }, [clients, q]);
  useEffect(() => setI(0), [q]);
  useEffect(() => {
    const f = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", f);
    return () => document.removeEventListener("pointerdown", f);
  }, []);
  const go = (c) => { setQ(""); setOpen(false); document.activeElement?.blur(); navigate(`/clients/${c.id}`); };
  return (
    <div className="qs" ref={box}>
      <Icon name="search" size={16} />
      <input id="qsearch" type="search" placeholder="Find a client…" aria-label="Find a client" autoComplete="off"
        value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
          if (e.key === "Enter" && hits[i]) go(hits[i]);
          if (e.key === "Escape") { setQ(""); e.currentTarget.blur(); }
        }} />
      <kbd className="qs-k">/</kbd>
      {open && q.trim() && (
        <div className="qs-list" role="listbox">
          {hits.length ? hits.map((c, n) => (
            <button key={c.id} role="option" aria-selected={n === i} className={n === i ? "on" : ""} onMouseEnter={() => setI(n)} onClick={() => go(c)}>
              <span><b>{c.name}</b><small>{[c.type, c.domain].filter(Boolean).join(" · ")}</small></span>
              <Stage k={c.stage} />
            </button>
          )) : <span className="qs-none">No client matches “{q}”.</span>}
        </div>
      )}
    </div>
  );
}

function NewClient({ onClose }) {
  const { clients, create, toast } = useDesk();
  const [f, setF] = useState({ name: "", type: "", stage: "enquiry", domain: "", email: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) { setErr("Give the client a name."); return; }
    let id = slug(name);
    while (clients.some((c) => c.id === id)) id = slug(name) + "-" + Math.random().toString(36).slice(2, 5);
    setBusy(true);
    try {
      await create(id, { ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()])), content: "none", hosting: "", repo: "", firebase: "", notes: "", tasks: [], payments: [] });
      toast("Client added", "ok");
      onClose();
      navigate(`/clients/${id}`);
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-label="New client" onSubmit={submit}>
        <div className="mh"><h2>New client</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
        <div className="fields">
          <label className="full">Client name<input autoFocus value={f.name} onChange={set("name")} placeholder="e.g. Lilian Wanjiku Manegene" /></label>
          <label>Project type<input value={f.type} onChange={set("type")} placeholder="Portfolio SPA" /></label>
          <label>Stage<select value={f.stage} onChange={set("stage")}>{STAGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label>Email<input type="email" value={f.email} onChange={set("email")} /></label>
          <label>Phone<input type="tel" value={f.phone} onChange={set("phone")} placeholder="+254…" /></label>
          <label className="full">Domain<input value={f.domain} onChange={set("domain")} placeholder="name.com" /></label>
        </div>
        <p className="small">You can add hosting, repo, tasks and payments on the client's page.</p>
        <div className="err" role="alert">{err}</div>
        <div className="mf">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Adding…" : "Add client"}</button>
        </div>
      </form>
    </div>
  );
}
