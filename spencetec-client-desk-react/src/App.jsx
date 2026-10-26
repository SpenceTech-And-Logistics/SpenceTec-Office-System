import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import Login from "./Login.jsx";
import { DeskProvider, useDesk } from "./desk.jsx";
import { Link, navigate, useLocation } from "./router.jsx";
import { Icon, Stage } from "./ui.jsx";
import { overdue, roleName } from "./util.js";
import Overview from "./pages/Overview.jsx";
import Clients from "./pages/Clients.jsx";
import ClientPage from "./pages/ClientPage.jsx";
import Tasks from "./pages/Tasks.jsx";
import Payments from "./pages/Payments.jsx";
import Invoices from "./pages/Invoices.jsx";
import InvoiceEdit from "./pages/InvoiceEdit.jsx";
import Register from "./pages/Register.jsx";
import SalesHome from "./pages/SalesHome.jsx";
import Settings from "./pages/Settings.jsx";
import Team from "./pages/Team.jsx";

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = checking, null = signed out
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const load = () => api.me().then((r) => { setSession(r.session); setMe(r.user); })
    .catch((e) => { if (e.expired) setNotice(e.message); setMe(null); });
  useEffect(() => { load(); }, []);
  // Keep the first reason shown: late background requests from the old page also report 401, without a reason.
  const signedOut = useCallback((msg) => { if (typeof msg === "string" && msg) setNotice(msg); setMe(null); setSession(null); }, []);
  if (me === undefined) return <div className="boot"><span className="logo">S</span></div>;
  if (!me) return <Login notice={notice} onDone={() => { setNotice(""); load(); }} />;
  return <DeskProvider me={me} session={session} onSignOut={signedOut}><Shell /></DeskProvider>;
}

const STAFF_NAV = [
  ["/", "Overview", "home"],
  ["/clients", "Clients", "clients"],
  ["/tasks", "Tasks", "tasks"],
  ["/invoices", "Billing", "invoice"],
];
const SALES_NAV = [
  ["/", "My clients", "clients"],
  ["/clients/new", "Register client", "plus"],
];

function Shell() {
  const { me, isOwner, isSales, clients, onSignOut } = useDesk();
  const { path } = useLocation();
  const [menu, setMenu] = useState(false);
  const late = isSales ? 0 : clients.reduce((a, c) => a + overdue(c).length, 0);

  const base = isSales ? SALES_NAV : STAFF_NAV;
  const nav = isOwner ? [...base, ["/team", "Team", "team"], ["/settings", "Settings", "gear"]] : base;
  const active = (to) => {
    if (to === "/") return path === "/";
    if (to === "/clients") return path === "/clients" || (path.startsWith("/clients/") && path !== "/clients/new");
    if (to === "/invoices") return path.startsWith("/invoices") || path === "/payments";
    return path === to || path.startsWith(to + "/");
  };
  const addClient = () => navigate("/clients/new");

  useEffect(() => {
    const k = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (e.key === "Escape") setMenu(false);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("qsearch")?.focus(); }
      if (e.key === "n") { e.preventDefault(); addClient(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setMenu(false), [path]);

  async function signOut() { await api.logout().catch(() => {}); onSignOut(); }

  let page;
  const m = path.match(/^\/clients\/([^/]+)$/);
  const im = path.match(/^\/invoices\/([^/]+)$/);
  if (path === "/clients/new") page = <Register />;
  else if (m) page = <ClientPage id={decodeURIComponent(m[1])} />;
  else if (isSales) page = path === "/" ? <SalesHome /> : <NotFound />;
  else if (path === "/") page = <Overview />;
  else if (path === "/clients") page = <Clients onAdd={addClient} />;
  else if (path === "/tasks") page = <Tasks />;
  else if (path === "/invoices") page = <Invoices />;
  else if (im) page = <InvoiceEdit key={im[1]} id={decodeURIComponent(im[1])} />;
  else if (path === "/payments") page = <Payments />;
  else if (path === "/team") page = <Team />;
  else if (path === "/settings") page = <Settings />;
  else page = <NotFound />;

  const display = me.name && me.name !== "Owner" ? me.name : me.email.split("@")[0];
  const initial = display[0].toUpperCase();

  return (
    <div className="app">
      <aside className="side">
        <Link to="/" className="brand"><span className="logo">S</span><span><b>Client Desk</b><small>SpenceTec</small></span></Link>
        {!isSales && <button className="btn primary block" onClick={addClient}><Icon name="plus" size={16} />New client</button>}
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
          <span className="who"><b>{display}</b><small>{roleName(me.role)}</small></span>
          <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={signOut}><Icon name="out" /></button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <Link to="/" className="brand mobile-only"><span className="logo">S</span></Link>
          <QuickSearch />
          <button className="btn primary add-top" onClick={addClient} aria-label={isSales ? "Register client" : "New client"}><Icon name="plus" size={16} /><span>{isSales ? "Register client" : "New client"}</span></button>
          <div className="menuwrap mobile-only">
            <button className="avatar as-btn" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>{initial}</button>
            {menu && (
              <div className="menu" role="menu">
                <span className="menu-who">{me.email} · {roleName(me.role)}</span>
                {isOwner && <Link to="/team" role="menuitem"><Icon name="team" />Team and roles</Link>}
                {isOwner && <Link to="/settings" role="menuitem"><Icon name="gear" />Company settings</Link>}
                <button role="menuitem" onClick={signOut}><Icon name="out" />Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="page" key={path}>{page}</main>
        <footer className="foot">Built by SpenceTec and Logistics Limited{!isSales && " · amounts in KES"}<span className="hint"> · press <kbd>/</kbd> to search, <kbd>N</kbd> for a new client</span></footer>
      </div>

      <nav className={"tabbar" + (isSales ? " two" : "")} aria-label="Main">
        {base.map(([to, n, ic]) => (
          <Link key={to} to={to} aria-current={active(to) ? "page" : undefined}>
            <Icon name={ic} size={20} /><span>{n}</span>
            {to === "/tasks" && late > 0 && <em className="badge">{late}</em>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const NotFound = () => <div className="empty"><b>Page not found</b><Link to="/">Go home</Link></div>;

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
