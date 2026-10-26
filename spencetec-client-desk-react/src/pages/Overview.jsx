import React, { useMemo } from "react";
import { useDesk } from "../desk.jsx";
import { Link } from "../router.jsx";
import { Empty, Icon, Stage, TaskRow } from "../ui.jsx";
import { STAGES, ACTIVE, kes, today, daysFromNow, allTasks, byDue, owed, paid, ago, contentName, invTotals, invStatus, fmtDate, untilLabel } from "../util.js";

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Overview() {
  const { me, clients, invoices, loaded, error, person } = useDesk();
  const name = me.name && me.name !== "Owner" ? me.name.split(" ")[0] : "";

  const d = useMemo(() => {
    const open = allTasks(clients).filter((x) => !x.t.done);
    const late = open.filter((x) => x.t.due && x.t.due < today()).sort(byDue);
    const week = open.filter((x) => x.t.due && x.t.due >= today() && x.t.due <= daysFromNow(7)).sort(byDue);
    const undated = open.filter((x) => !x.t.due);
    const unpaid = invoices.filter((i) => ["sent", "partial", "overdue"].includes(invStatus(i)));
    const invDue = (cid) => unpaid.filter((i) => i.clientId === cid).reduce((a, i) => a + invTotals(i).balance, 0);
    const owing = clients.map((c) => [c, owed(c) + invDue(c.id)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const invPaid = invoices.filter((i) => i.status !== "void").reduce((a, i) => a + invTotals(i).paid, 0);
    return {
      open, late, week, undated, owing,
      totalOwed: owing.reduce((a, [, n]) => a + n, 0),
      totalPaid: clients.reduce((a, c) => a + paid(c), 0) + invPaid,
      invOverdue: invoices.filter((i) => invStatus(i) === "overdue").length,
      launches: clients.filter((c) => c.deadline && c.deadline <= daysFromNow(30) && !["live", "maintenance"].includes(c.stage)).sort((a, b) => a.deadline.localeCompare(b.deadline)),
      leads: clients.filter((c) => c.stage === "enquiry" && c.createdBy && c.createdBy !== me.email && c.createdBy !== "seed").sort((a, b) => (b.created || "").localeCompare(a.created || "")).slice(0, 6),
      active: clients.filter((c) => ACTIVE.includes(c.stage)).length,
      live: clients.filter((c) => ["live", "maintenance"].includes(c.stage)).length,
      waiting: clients.filter((c) => (c.content || "none") !== "full" && c.stage !== "maintenance"),
      recent: [...clients].sort((a, b) => (b.updated || "").localeCompare(a.updated || "")).slice(0, 5),
    };
  }, [clients]);

  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  if (error) return <Empty title="Can't reach the client database">{error}. Check your connection and refresh.</Empty>;
  if (!loaded) return <Empty title="Loading…" />;

  const attention = [...d.late, ...d.week];

  return (
    <>
      <div className="phead">
        <div><h1>{greet()}{name ? `, ${name}` : ""}</h1><p>{date}</p></div>
      </div>

      <section className="tiles" aria-label="Summary">
        <Tile to="/clients" n={d.active} l="Projects in progress" sub={`${clients.length} clients in total`} />
        <Tile to="/clients?stage=live" n={d.live} l="Live or maintained" />
        <Tile to="/tasks" n={d.open.length} l="Open tasks" sub={d.late.length ? `${d.late.length} overdue` : "None overdue"} alert={d.late.length > 0} />
        <Tile to="/invoices?show=unpaid" n={kes(d.totalOwed)} l="Outstanding" sub={d.invOverdue ? `${d.invOverdue} invoice${d.invOverdue === 1 ? "" : "s"} overdue` : `${kes(d.totalPaid)} received to date`} warn={d.totalOwed > 0} alert={d.invOverdue > 0} />
      </section>

      <div className="cols">
        <div className="stack">
          <section className="card-p">
            <div className="ch"><h2>Needs attention</h2><Link to="/tasks" className="more">All tasks<Icon name="chev" size={14} /></Link></div>
            {attention.length ? (
              <div className="items">
                {d.late.length > 0 && <h3 className="grp late">Overdue</h3>}
                {d.late.map(({ c, t }) => <TaskRow key={c.id + t.id} c={c} t={t} showClient />)}
                {d.week.length > 0 && <h3 className="grp">Due in the next 7 days</h3>}
                {d.week.map(({ c, t }) => <TaskRow key={c.id + t.id} c={c} t={t} showClient />)}
              </div>
            ) : (
              <p className="quiet">Nothing overdue or due this week.{d.undated.length ? <> {d.undated.length} open task{d.undated.length === 1 ? " has" : "s have"} no date — <Link to="/tasks">give them one</Link>.</> : ""}</p>
            )}
          </section>

          {d.leads.length > 0 && (
            <section className="card-p">
              <div className="ch"><h2>New from sales reps</h2><Link to="/clients?stage=enquiry" className="more">Enquiries<Icon name="chev" size={14} /></Link></div>
              <div className="items">
                {d.leads.map((c) => (
                  <Link key={c.id} to={`/clients/${c.id}`} className="rowlink">
                    <span className="t"><b>{c.name}</b><small>{[c.title, c.type].filter(Boolean).join(" · ")}{c.files?.photo ? ` · ${c.files.photo} photo${c.files.photo === 1 ? "" : "s"}` : ""}</small></span>
                    <span className="t r"><small>by {person(c.createdBy)}</small><small>{c.created ? fmtDate(c.created) : ""}</small></span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {d.launches.length > 0 && (
            <section className="card-p">
              <div className="ch"><h2>Launches in the next 30 days</h2></div>
              <div className="items">
                {d.launches.map((c) => (
                  <Link key={c.id} to={`/clients/${c.id}`} className="rowlink">
                    <span className="t"><b>{c.name}</b><small className={c.deadline < today() ? "late" : ""}>{fmtDate(c.deadline)} · {untilLabel(c.deadline)}</small></span>
                    <Stage k={c.stage} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="card-p">
            <div className="ch"><h2>Waiting on client content</h2><span className="count">{d.waiting.length}</span></div>
            {d.waiting.length ? (
              <div className="items">
                {d.waiting.map((c) => (
                  <Link key={c.id} to={`/clients/${c.id}`} className="rowlink">
                    <span className="t"><b>{c.name}</b><small>{c.type}</small></span>
                    <span className={"pill " + ((c.content || "none") === "partial" ? "warn" : "")}>{contentName(c.content)}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="quiet">All content is in.</p>}
          </section>
        </div>

        <div className="stack">
          <section className="card-p">
            <div className="ch"><h2>Pipeline</h2><Link to="/clients" className="more">Board<Icon name="chev" size={14} /></Link></div>
            <div className="pipe">
              {STAGES.map(([k, n]) => {
                const count = clients.filter((c) => c.stage === k).length;
                return (
                  <Link key={k} to={`/clients?stage=${k}`} className="pipe-row" style={{ "--c": `var(--s-${k})` }}>
                    <span className="pn">{n}</span>
                    <span className="bar"><i style={{ width: clients.length ? `${(count / clients.length) * 100}%` : 0 }} /></span>
                    <b>{count}</b>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="card-p">
            <div className="ch"><h2>Money owed</h2><Link to="/invoices" className="more">Billing<Icon name="chev" size={14} /></Link></div>
            {d.owing.length ? (
              <div className="items">
                {d.owing.slice(0, 5).map(([c, n]) => (
                  <Link key={c.id} to={`/clients/${c.id}`} className="rowlink"><span className="t"><b>{c.name}</b></span><b className="amt">{kes(n)}</b></Link>
                ))}
              </div>
            ) : <p className="quiet">Nobody owes anything right now. <Link to="/invoices/new">Create an invoice</Link>.</p>}
          </section>

          <section className="card-p">
            <div className="ch"><h2>Recently changed</h2></div>
            <div className="items">
              {d.recent.map((c) => (
                <Link key={c.id} to={`/clients/${c.id}`} className="rowlink">
                  <span className="t"><b>{c.name}</b><small>{ago(c.updated)}{c.updatedBy && c.updatedBy !== "seed" ? ` · ${person(c.updatedBy)}` : ""}</small></span>
                  <Stage k={c.stage} />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Tile({ to, n, l, sub, alert, warn }) {
  return (
    <Link to={to} className={"tile" + (alert ? " alert" : warn ? " warn" : "")}>
      <span className="tl">{l}</span>
      <b>{n}</b>
      {sub && <small>{sub}</small>}
    </Link>
  );
}
