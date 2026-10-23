import React, { useEffect, useState } from "react";
import { useDesk } from "../desk.jsx";
import { Link, navigate } from "../router.jsx";
import { Empty, Icon, InvPill, PageHead, PayRow, PersonSelect, Stage, TaskRow } from "../ui.jsx";
import { ClientFiles, EditCard, LinksCard } from "../profile.jsx";
import { STAGES, CONTENT, kes, uid, today, tasksOf, paysOf, owed, paid, ago, href, waLink, invTotals, invNo, fmtDate, untilLabel } from "../util.js";

const PROFILE = [
  ["name", "Name", "", "text"],
  ["title", "Title or position", "MP, Kirinyaga Central"],
  ["org", "Organisation", ""],
  ["location", "Location", ""],
  ["phone", "Phone", "+254…", "tel"],
  ["whatsapp", "WhatsApp", "+254…", "tel"],
  ["email", "Email", "", "email"],
  ["source", "How we met", ""],
  ["about", "About", "", "textarea"],
];
const SALES_PROJECT = [
  ["type", "Project", "Portfolio website"],
  ["budget", "Budget estimate", "", "money"],
  ["domain", "Domain", "name.com"],
  ["repNotes", "Your notes", "Anything the office should know", "textarea"],
];
const PROJECT = [
  ["type", "Project", "Portfolio SPA"],
  ["package", "Package", "", "select:Starter,Standard,Premium,Custom,Maintenance"],
  ["quote", "Quoted price", "", "money"],
  ["budget", "Client's budget", "", "money"],
  ["start", "Start date", "", "date"],
  ["deadline", "Launch deadline", "", "date"],
  ["rep", "Sales rep", "", "person:sales,owner,secretary"],
  ["lead", "Project lead", "", "person:owner,secretary"],
];
const TECH = [
  ["domain", "Domain", "name.com"],
  ["hosting", "Hosting", "Cloudflare, Firebase…"],
  ["repo", "Repository", "github.com/…"],
  ["firebase", "Firebase project", ""],
];

export default function ClientPage({ id }) {
  const { clients, loaded, isSales } = useDesk();
  const c = clients.find((x) => x.id === id);
  if (!loaded) return <Empty title="Loading…" />;
  if (!c) return <Empty title="Client not found" action={<Link className="btn" to={isSales ? "/" : "/clients"}>Back</Link>}>It may have been deleted, or it isn't one of yours.</Empty>;
  return isSales ? <SalesView c={c} /> : <StaffView c={c} />;
}

/* ---------- what a sales rep sees: profile only, no money ---------- */
function SalesView({ c }) {
  const si = STAGES.findIndex(([k]) => k === c.stage);
  return (
    <>
      <PageHead back={["/", "My clients"]} title={c.name} sub={[c.title, c.org].filter(Boolean).join(" · ")}>
        <Quick c={c} />
      </PageHead>
      <section className="card-p">
        <div className="ch"><h2>Progress</h2><Stage k={c.stage} /></div>
        <div className="progress" style={{ "--c": `var(--s-${c.stage})` }}>
          {STAGES.map(([k, n], i) => <span key={k} className={i <= si ? "on" : ""} title={n} />)}
        </div>
        <p className="small">The office moves the client through the stages. Registered {c.created ? fmtDate(c.created) : ""}.</p>
      </section>
      <div className="cols">
        <div className="stack">
          <ClientFiles c={c} />
          <LinksCard c={c} />
        </div>
        <div className="stack">
          <EditCard title="Profile" c={c} fields={PROFILE} />
          <EditCard title="Project" c={c} fields={SALES_PROJECT} />
        </div>
      </div>
    </>
  );
}

/* ---------- owner and secretary ---------- */
function StaffView({ c }) {
  const { patch, isOwner, remove, toast, person } = useDesk();
  const [armed, setArmed] = useState(false);
  const si = STAGES.findIndex(([k]) => k === c.stage);
  const late = c.deadline && c.deadline < today() && !["live", "maintenance"].includes(c.stage);

  return (
    <>
      <PageHead back={["/clients", "Clients"]} title={c.name} sub={[c.title, c.org, c.type].filter(Boolean).join(" · ")}>
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

      {(c.deadline || c.rep || c.quote) && (
        <div className="facts">
          {c.deadline && <span className={late ? "late" : ""}><Icon name="cal" size={15} />Launch {fmtDate(c.deadline)}{!["live", "maintenance"].includes(c.stage) ? ` · ${untilLabel(c.deadline)}` : ""}</span>}
          {c.quote ? <span><Icon name="money" size={15} />Quoted {kes(c.quote)}</span> : null}
          {c.rep && <span><Icon name="user" size={15} />Sales rep: {person(c.rep)}</span>}
          {c.lead && <span><Icon name="star" size={15} />Lead: {person(c.lead)}</span>}
        </div>
      )}

      <div className="cols wide-left">
        <div className="stack">
          <Tasks c={c} />
          <ClientInvoices c={c} />
          <Payments c={c} />
          <ClientFiles c={c} />
        </div>
        <div className="stack">
          <EditCard title="Project" c={c} fields={PROJECT} />
          <EditCard title="Contact and profile" c={c} fields={PROFILE} />
          <LinksCard c={c} />
          <EditCard title="Website and hosting" c={c} fields={TECH} />
          <section className="card-p">
            <div className="ch"><h2>Content from client</h2></div>
            <div className="seg full" role="group" aria-label="Content from client">
              {CONTENT.map(([k, n]) => (
                <button key={k} aria-pressed={(c.content || "none") === k} onClick={() => patch(c.id, { content: k })}>{n}</button>
              ))}
            </div>
          </section>
          {c.repNotes && <section className="card-p"><div className="ch"><h2>Notes from {c.rep ? person(c.rep) : "the sales rep"}</h2></div><p className="pre quiet">{c.repNotes}</p></section>}
          <Notes c={c} />
          <p className="small">
            {c.createdBy && c.createdBy !== "seed" ? `Registered by ${person(c.createdBy)}${c.created ? " on " + fmtDate(c.created) : ""}. ` : ""}
            Last changed {ago(c.updated)}{c.updatedBy && c.updatedBy !== "seed" ? ` by ${person(c.updatedBy)}` : ""}.
          </p>
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

function ClientInvoices({ c }) {
  const { invoices, settings } = useDesk();
  const mine = invoices.filter((i) => i.clientId === c.id);
  return (
    <section className="card-p">
      <div className="ch"><h2>Invoices</h2><Link className="btn sm primary" to={`/invoices/new?client=${c.id}`}><Icon name="plus" size={14} />New invoice</Link></div>
      {mine.length ? (
        <div className="items">
          {mine.map((inv) => {
            const t = invTotals(inv);
            return (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className="rowlink">
                <span className="t"><b>{invNo(inv, settings)}</b><small>{inv.issueDate ? fmtDate(inv.issueDate) : "No date"}{t.balance && inv.status !== "draft" && inv.status !== "void" ? ` · ${kes(t.balance)} to pay` : ""}</small></span>
                <span className="row"><b className="amt">{kes(t.total)}</b><InvPill inv={inv} /></span>
              </Link>
            );
          })}
        </div>
      ) : <p className="quiet">No invoices yet.</p>}
    </section>
  );
}

function Quick({ c }) {
  const wa = waLink(c.whatsapp || c.phone);
  const links = [
    c.domain && [href(c.domain), "Visit site", "globe"],
    c.repo && [href(c.repo), "Repo", "code"],
    c.email && ["mailto:" + c.email, "Email", "mail"],
    c.phone && ["tel:" + c.phone.replace(/\s/g, ""), "Call", "phone"],
    wa && [wa, "WhatsApp", "chat"],
  ].filter(Boolean);
  if (!links.length) return null;
  return links.map(([u, n, ic]) => (
    <a key={n} className="btn" href={u} target={u.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><Icon name={ic} size={16} />{n}</a>
  ));
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
  const [who, setWho] = useState("");
  const [showDone, setShowDone] = useState(false);
  const all = tasksOf(c).slice().sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
  const open = all.filter((t) => !t.done), done = all.filter((t) => t.done);
  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    patch(c.id, (cur) => ({ tasks: [...tasksOf(cur), { id: uid(), text: text.trim(), due, done: false, assignee: who }] }), "Task added");
    setText(""); setDue("");
  };
  return (
    <section className="card-p">
      <div className="ch"><h2>Tasks</h2><span className="count">{open.length} open</span></div>
      <form className="addrow task" onSubmit={add}>
        <input placeholder="Add a task, e.g. Send design for approval" aria-label="New task" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="date" aria-label="Due date" value={due} min={today()} onChange={(e) => setDue(e.target.value)} />
        <PersonSelect value={who} onChange={setWho} roles={["owner", "secretary"]} empty="Anyone" label="Assign to" />
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
      <div className="ch"><h2>Other payments</h2></div>
      <p className="small">For quick deposits and balances without a formal invoice.</p>
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

