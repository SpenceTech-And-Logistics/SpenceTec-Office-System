import React, { useMemo, useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link } from "../router.jsx";
import { Empty, Icon, Stage } from "../ui.jsx";
import { STAGES, ACTIVE, fmtDate } from "../util.js";

export default function SalesHome() {
  const { me, clients, loaded, error } = useDesk();
  const [q, setQ] = useState("");
  const first = me.name && me.name !== "Owner" ? me.name.split(" ")[0] : "";
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...clients]
      .filter((c) => !s || [c.name, c.title, c.org, c.location, c.type].join(" ").toLowerCase().includes(s))
      .sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  }, [clients, q]);

  if (error) return <Empty title="Can't reach the office">{error}</Empty>;
  if (!loaded) return <Empty title="Loading…" />;

  const missing = (c) => {
    const m = [];
    if (!c.phone && !c.email) m.push("contact");
    if (!c.files?.photo) m.push("photos");
    if (!(c.links || []).length) m.push("links");
    return m;
  };

  return (
    <>
      <div className="phead">
        <div><h1>{first ? `Hi ${first}` : "My clients"}</h1><p>Clients you've registered for SpenceTec</p></div>
        <div className="pactions"><Link className="btn primary" to="/clients/new"><Icon name="plus" size={16} />Register a client</Link></div>
      </div>

      <section className="tiles three">
        <div className="tile static"><span className="tl">Registered</span><b>{clients.length}</b></div>
        <div className="tile static"><span className="tl">Being built</span><b>{clients.filter((c) => ACTIVE.includes(c.stage)).length}</b></div>
        <div className="tile static ok"><span className="tl">Live</span><b>{clients.filter((c) => ["live", "maintenance"].includes(c.stage)).length}</b></div>
      </section>

      {!clients.length ? (
        <Empty title="No clients yet" action={<Link className="btn primary" to="/clients/new"><Icon name="plus" size={16} />Register your first client</Link>}>
          Add their details, a few photos, their CV and links to their social media. The office takes it from there.
        </Empty>
      ) : (
        <>
          {clients.length > 5 && <input className="filter-q" type="search" placeholder="Find one of your clients" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="rep-grid">
            {list.map((c) => {
              const m = missing(c);
              const si = STAGES.findIndex(([k]) => k === c.stage);
              return (
                <Link key={c.id} to={`/clients/${c.id}`} className="rep-card">
                  <div className="rc-top"><strong>{c.name}</strong><Stage k={c.stage} /></div>
                  <small>{[c.title, c.org, c.location].filter(Boolean).join(" · ") || c.type || "No details yet"}</small>
                  <div className="progress" style={{ "--c": `var(--s-${c.stage})` }}>{STAGES.map(([k], i) => <span key={k} className={i <= si ? "on" : ""} />)}</div>
                  <span className="row">
                    <span className="pill"><Icon name="image" size={12} />{c.files?.photo || 0}</span>
                    {c.files?.cv ? <span className="pill ok">CV</span> : null}
                    <span className="pill"><Icon name="link" size={12} />{(c.links || []).length}</span>
                    {m.length ? <span className="pill warn">Add {m.join(", ")}</span> : null}
                  </span>
                  {c.created && <small className="muted">Registered {fmtDate(c.created)}</small>}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
