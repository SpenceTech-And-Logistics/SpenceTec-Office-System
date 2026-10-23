import React, { useMemo, useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link, navigate, setQuery, useLocation } from "../router.jsx";
import { Empty, Icon, PageHead, Seg } from "../ui.jsx";
import { STAGES, kes, openTasks, overdue, owed, stageName } from "../util.js";

export default function Clients({ onAdd }) {
  const { clients, loaded, error, patch } = useDesk();
  const { query } = useLocation();
  const stage = query.get("stage") || "";
  const [q, setQ] = useState("");
  const [view, setViewState] = useState(() => { try { return localStorage.getItem("stc-view") || (innerWidth < 700 ? "list" : "board"); } catch { return "board"; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem("stc-view", v); } catch {} };
  const [over, setOver] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => (!stage || c.stage === stage) && (!s || [c.name, c.type, c.domain, c.repo, c.hosting, c.email].join(" ").toLowerCase().includes(s)));
  }, [clients, q, stage]);

  const drop = (k) => (e) => {
    e.preventDefault(); setOver("");
    const id = e.dataTransfer.getData("text/plain");
    const c = clients.find((x) => x.id === id);
    if (c && c.stage !== k) patch(id, { stage: k }, `${c.name} moved to ${stageName(k)}`);
  };

  const cols = stage ? STAGES.filter(([k]) => k === stage) : STAGES;

  return (
    <>
      <PageHead title="Clients" sub={`${clients.length} client${clients.length === 1 ? "" : "s"} · drag a card to change its stage`}>
        <Seg label="View" value={view} onChange={setView} options={[["board", "Board", "board"], ["list", "List", "list"]]} />
      </PageHead>

      <div className="filters">
        <div className="chips" role="group" aria-label="Filter by stage">
          <button className="chip" aria-pressed={!stage} onClick={() => setQuery("stage", "")}>All <em>{clients.length}</em></button>
          {STAGES.map(([k, n]) => (
            <button key={k} className="chip" aria-pressed={stage === k} style={{ "--c": `var(--s-${k})` }} onClick={() => setQuery("stage", stage === k ? "" : k)}>
              <i />{n} <em>{clients.filter((c) => c.stage === k).length}</em>
            </button>
          ))}
        </div>
        <input className="filter-q" type="search" placeholder="Filter this list" aria-label="Filter clients" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error ? <Empty title="Can't reach the client database">{error}</Empty>
      : !loaded ? <Empty title="Loading clients…" />
      : !clients.length ? <Empty title="No clients yet" action={<button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} />Add your first client</button>}>Or run the seed step in the README.</Empty>
      : view === "board" ? (
        <div className={"board" + (stage ? " single" : "")}>
          {cols.map(([k, n]) => {
            const cs = list.filter((c) => c.stage === k);
            return (
              <section key={k} className={"col" + (over === k ? " over" : "")} style={{ "--c": `var(--s-${k})` }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== k) setOver(k); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(""); }}
                onDrop={drop(k)}>
                <h3><span><i />{n}</span><em>{cs.length}</em></h3>
                {cs.map((c) => <Card key={c.id} c={c} />)}
                {!cs.length && <span className="col-empty">{q ? "No match" : "Drop a client here"}</span>}
              </section>
            );
          })}
        </div>
      ) : !list.length ? <Empty title="No match">Nothing matches that filter.</Empty>
      : (
        <div className="tablewrap"><table>
          <thead><tr><th>Client</th><th>Stage</th><th>Domain</th><th>Tasks</th><th className="r">Outstanding</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id} onClick={(e) => { if (!e.target.closest("select,a")) navigate(`/clients/${c.id}`); }}>
              <td><Link to={`/clients/${c.id}`} className="tname">{c.name}</Link><small>{c.type}</small></td>
              <td>
                <select className="stage-sel" style={{ "--c": `var(--s-${c.stage})` }} value={c.stage} aria-label={`Stage for ${c.name}`}
                  onChange={(e) => patch(c.id, { stage: e.target.value }, `${c.name} moved to ${stageName(e.target.value)}`)}>
                  {STAGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </td>
              <td className="muted">{c.domain || "—"}</td>
              <td>{openTasks(c).length || "—"}{overdue(c).length > 0 && <> <span className="pill bad">{overdue(c).length} late</span></>}</td>
              <td className="r">{owed(c) ? <b>{kes(owed(c))}</b> : <span className="muted">—</span>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </>
  );
}

function Card({ c }) {
  const od = overdue(c).length, ot = openTasks(c).length, ow = owed(c), cs = c.content || "none";
  return (
    <Link to={`/clients/${c.id}`} className="kcard" draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("dragging"); }}
      onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}>
      <strong>{c.name}</strong>
      {(c.type || c.domain) && <small>{[c.type, c.domain].filter(Boolean).join(" · ")}</small>}
      {(od || ot || ow || cs !== "full") ? (
        <span className="row">
          {od ? <span className="pill bad">{od} overdue</span> : ot ? <span className="pill">{ot} open task{ot === 1 ? "" : "s"}</span> : null}
          {ow ? <span className="pill warn">{kes(ow)} due</span> : null}
          {cs !== "full" && <span className="pill">{cs === "partial" ? "Some content in" : "Awaiting content"}</span>}
        </span>
      ) : null}
    </Link>
  );
}

