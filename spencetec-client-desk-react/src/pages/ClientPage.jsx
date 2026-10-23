import React, { useEffect, useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link, navigate } from "../router.jsx";
import { Empty, Icon, PageHead, PayRow, TaskRow } from "../ui.jsx";
import { STAGES, CONTENT, kes, uid, today, tasksOf, paysOf, owed, paid, ago, href } from "../util.js";

const FIELDS = [
  ["type", "Project type", "Portfolio SPA"],
  ["domain", "Domain", "name.com"],
  ["hosting", "Hosting", "Cloudflare, Firebase…"],
  ["repo", "Repository", "github.com/…"],
  ["firebase", "Firebase project", ""],
  ["email", "Client email", ""],
  ["phone", "Client phone", "+254…"],
];

export default function ClientPage({ id }) {
  const { clients, loaded, patch, isOwner, remove, toast } = useDesk();
  const c = clients.find((x) => x.id === id);
  const [armed, setArmed] = useState(false);

  if (!loaded) return <Empty title="Loading…" />;
  if (!c) return <Empty title="Client not found" action={<Link className="btn" to="/clients">Back to clients</Link>}>It may have been deleted.</Empty>;

  const si = STAGES.findIndex(([k]) => k === c.stage);

  return (
    <>
      <PageHead back={["/clients", "Clients"]} title={c.name} sub={c.type}>
        <Quick c={c} />
      </PageHead>

      <section className="stepper" aria-label="Stage">
        {STAGES.map(([k, n], i) => (
          <button key={k} className={"step" + (i < si ? " past" : i === si ? " now" : "")} style={{ "--c": `var(--s-${k})` }}
            aria-pressed={i === si} onClick={() => i !== si && patch(c.id, { stage: k }, `Moved to ${n}`)}>
            <i>{i < si ? <Icon name="check" size={12} /> : i + 1}</i><span>{n}</span>
          </button>
        ))}
      </section>

      <div className="cols wide-left">
        <div className="stack">
          <Tasks c={c} />
          <Payments c={c} />
        </div>
        <div className="stack">
          <Details c={c} />
          <section className="card-p">
            <div className="ch"><h2>Content from client</h2></div>
            <div className="seg full" role="group" aria-label="Content from client">
              {CONTENT.map(([k, n]) => (
                <button key={k} aria-pressed={(c.content || "none") === k} onClick={() => patch(c.id, { content: k })}>{n}</button>
              ))}
            </div>
          </section>
          <Notes c={c} />
          <p className="small">Last changed {ago(c.updated)}{c.updatedBy && c.updatedBy !== "seed" ? ` by ${c.updatedBy}` : ""}.</p>
          {isOwner && (
            <button className={"btn danger" + (armed ? " armed" : "")} onBlur={() => setArmed(false)}
              onClick={async () => {
                if (!armed) return setArmed(true);
                try { await remove(c.id); toast(`${c.name} deleted`); navigate("/clients"); } catch (e) { toast(e.message, "bad"); }
              }}>{armed ? "Click again to delete for good" : "Delete client"}</button>
          )}
        </div>
      </div>
    </>
  );
}

function Quick({ c }) {
  const links = [
    c.domain && [href(c.domain), "Visit site", "globe"],
    c.repo && [href(c.repo), "Repo", "code"],
    c.email && ["mailto:" + c.email, "Email", "mail"],
    c.phone && ["tel:" + c.phone.replace(/\s/g, ""), "Call", "phone"],
  ].filter(Boolean);
  if (!links.length) return null;
  return links.map(([u, n, ic]) => (
    <a key={n} className="btn" href={u} target={u.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><Icon name={ic} size={16} />{n}</a>
  ));
}

function Details({ c }) {
  const { patch } = useDesk();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(c);
  useEffect(() => { if (!edit) setF(c); }, [c, edit]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (!f.name?.trim()) return;
    const data = { name: f.name.trim() };
    FIELDS.forEach(([k]) => (data[k] = (f[k] || "").trim()));
    await patch(c.id, data, "Details saved");
    setEdit(false);
  }

  if (edit) return (
    <form className="card-p" onSubmit={save}>
      <div className="ch"><h2>Edit details</h2></div>
      <div className="fields one">
        <label>Client name<input value={f.name || ""} onChange={set("name")} required autoFocus /></label>
        {FIELDS.map(([k, l, ph]) => <label key={k}>{l}<input value={f[k] || ""} placeholder={ph} onChange={set(k)} /></label>)}
      </div>
      <div className="row end">
        <button type="button" className="btn" onClick={() => setEdit(false)}>Cancel</button>
        <button className="btn primary">Save</button>
      </div>
    </form>
  );

  const show = (k, v) => {
    if (!v) return <span className="muted">—</span>;
    if (k === "domain" || k === "repo") return <a href={href(v)} target="_blank" rel="noreferrer" className="link">{v}</a>;
    if (k === "email") return <a href={"mailto:" + v} className="link">{v}</a>;
    if (k === "phone") return <a href={"tel:" + v.replace(/\s/g, "")} className="link">{v}</a>;
    return v;
  };
  return (
    <section className="card-p">
      <div className="ch"><h2>Details</h2><button className="btn sm" onClick={() => setEdit(true)}><Icon name="edit" size={14} />Edit</button></div>
      <dl className="dl">
        {FIELDS.map(([k, l]) => <React.Fragment key={k}><dt>{l}</dt><dd>{show(k, c[k])}</dd></React.Fragment>)}
      </dl>
    </section>
  );
}

function Notes({ c }) {
  const { patch } = useDesk();
  const [v, setV] = useState(c.notes || "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setV(c.notes || ""); }, [c.notes, dirty]);
  const save = async () => { await patch(c.id, { notes: v.trim() }, "Notes saved"); setDirty(false); };
  return (
    <section className="card-p">
      <div className="ch"><h2>Notes</h2>{dirty && <button className="btn sm primary" onClick={save}>Save notes</button>}</div>
      <textarea value={v} placeholder="Anything worth remembering about this client…" aria-label="Notes"
        onChange={(e) => { setV(e.target.value); setDirty(true); }}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }} />
    </section>
  );
}

function Tasks({ c }) {
  const { patch } = useDesk();
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [showDone, setShowDone] = useState(false);
  const all = tasksOf(c).slice().sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
  const open = all.filter((t) => !t.done), done = all.filter((t) => t.done);
  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    patch(c.id, (cur) => ({ tasks: [...tasksOf(cur), { id: uid(), text: text.trim(), due, done: false }] }), "Task added");
    setText(""); setDue("");
  };
  return (
    <section className="card-p">
      <div className="ch"><h2>Tasks</h2><span className="count">{open.length} open</span></div>
      <form className="addrow" onSubmit={add}>
        <input placeholder="Add a task, e.g. Send design for approval" aria-label="New task" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="date" aria-label="Due date" value={due} min={today()} onChange={(e) => setDue(e.target.value)} />
        <button className="btn primary" aria-label="Add task"><Icon name="plus" size={16} /><span className="hide-sm">Add</span></button>
      </form>
      <div className="items">
        {open.length ? open.map((t) => <TaskRow key={t.id} c={c} t={t} />) : <p className="quiet">No open tasks.</p>}
      </div>
      {done.length > 0 && (
        <>
          <button className="linkbtn" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : "Show"} {done.length} done</button>
          {showDone && <div className="items">{done.map((t) => <TaskRow key={t.id} c={c} t={t} />)}</div>}
        </>
      )}
    </section>
  );
}

function Payments({ c }) {
  const { patch } = useDesk();
  const [label, setLabel] = useState("");
  const [amt, setAmt] = useState("");
  const [date, setDate] = useState("");
  const pays = paysOf(c);
  const add = (e) => {
    e.preventDefault();
    const a = +amt;
    if (!label.trim() || !a) return;
    patch(c.id, (cur) => ({ payments: [...paysOf(cur), { id: uid(), label: label.trim(), amount: a, date, status: "pending" }] }), "Payment added");
    setLabel(""); setAmt(""); setDate("");
  };
  return (
    <section className="card-p">
      <div className="ch"><h2>Payments</h2></div>
      <div className="money">
        <span>Invoiced<b>{kes(paid(c) + owed(c))}</b></span>
        <span className="ok">Paid<b>{kes(paid(c))}</b></span>
        <span className={owed(c) ? "warn" : ""}>Outstanding<b>{kes(owed(c))}</b></span>
      </div>
      <div className="items">
        {pays.length ? pays.map((p) => <PayRow key={p.id} c={c} p={p} />) : <p className="quiet">No payments recorded yet.</p>}
      </div>
      <form className="addrow pay" onSubmit={add}>
        <input placeholder="Deposit, balance…" aria-label="Payment label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input type="number" min="0" inputMode="numeric" placeholder="Amount (KES)" aria-label="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <input type="date" aria-label="Due or paid date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn" aria-label="Add payment"><Icon name="plus" size={16} /><span className="hide-sm">Add</span></button>
      </form>
      <p className="small">Payments start as pending. Click “Pending” when the money arrives.</p>
    </section>
  );
}

