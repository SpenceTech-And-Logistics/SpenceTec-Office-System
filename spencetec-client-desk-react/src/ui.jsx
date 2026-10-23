import React from "react";
import { Link } from "./router.jsx";
import { stageName, dueLabel, today, kes, fmtDate, INV_STATUS, invStatus } from "./util.js";
import { useDesk } from "./desk.jsx";

const P = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  clients: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" /><path d="M18 14.8c1.8.7 3 2.4 3.5 5.2" /></>,
  tasks: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 12 3 3 5-6" /></>,
  money: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>,
  team: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  out: <><path d="M9 4H5v16h4" /><path d="m14 8 4 4-4 4M18 12H9" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  ext: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 7 8.5-7" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  board: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></>,
  cal: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  chev: <path d="m9 5 7 7-7 7" />,
  invoice: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  print: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m4 19 6-6 4 4 3-3 3 3" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  chat: <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
};
export function Icon({ name, size = 18 }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>
  );
}

export const Stage = ({ k }) => <span className="stage" style={{ "--c": `var(--s-${k})` }}><i />{stageName(k)}</span>;

export function Empty({ title, children, action }) {
  return <div className="empty"><b>{title}</b>{children && <span>{children}</span>}{action}</div>;
}

export function PageHead({ title, sub, children, back }) {
  return (
    <div className="phead">
      <div>
        {back && <Link className="backlink" to={back[0]}><Icon name="back" size={15} />{back[1]}</Link>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="pactions">{children}</div>}
    </div>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, n, icon]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {icon && <Icon name={icon} size={15} />}{n}
        </button>
      ))}
    </div>
  );
}

/* ---------- shared task + payment rows ---------- */

export function TaskRow({ c, t, showClient }) {
  const { patch, users, person, isStaff } = useDesk();
  const late = !t.done && t.due && t.due < today();
  const soon = !t.done && t.due && !late && t.due <= today();
  return (
    <div className={"item" + (t.done ? " done" : "")}>
      <label className="tick" title={t.done ? "Mark as not done" : "Mark as done"}>
        <input type="checkbox" checked={!!t.done}
          onChange={(e) => patch(c.id, (cur) => ({ tasks: (cur.tasks || []).map((x) => x.id === t.id ? { ...x, done: e.target.checked } : x) }), e.target.checked ? "Task done" : "")} />
        <span aria-hidden="true"><Icon name="check" size={13} /></span>
      </label>
      <div className="t">
        <span className="tt">{t.text}</span>
        <span className="meta">
          {showClient && <Link to={`/clients/${c.id}`} className="clink">{c.name}</Link>}
          <span className={late ? "late" : soon ? "soon" : ""}>{t.done ? (t.due ? fmtDate(t.due) : "") : dueLabel(t.due)}</span>
          {isStaff && users.length > 1 ? (
            <select className="mini-sel" value={t.assignee || ""} aria-label="Assigned to" title="Assigned to"
              onChange={(e) => patch(c.id, (cur) => ({ tasks: (cur.tasks || []).map((x) => x.id === t.id ? { ...x, assignee: e.target.value } : x) }), e.target.value ? `Assigned to ${person(e.target.value)}` : "")}>
              <option value="">Unassigned</option>
              {users.filter((u) => u.role !== "sales").map((u) => <option key={u.email} value={u.email}>{person(u.email)}</option>)}
            </select>
          ) : t.assignee ? <span>{person(t.assignee)}</span> : null}
        </span>
      </div>
      <button className="icon-btn" aria-label="Remove task" title="Remove task"
        onClick={() => patch(c.id, (cur) => ({ tasks: (cur.tasks || []).filter((x) => x.id !== t.id) }), "Task removed")}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export function PayRow({ c, p, showClient }) {
  const { patch } = useDesk();
  const isPaid = p.status === "paid";
  return (
    <div className={"item pay" + (isPaid ? " paid" : "")}>
      <div className="t">
        <span className="tt">{p.label}</span>
        <span className="meta">
          {showClient && <Link to={`/clients/${c.id}`} className="clink">{c.name}</Link>}
          {p.date && <span>{fmtDate(p.date)}</span>}
        </span>
      </div>
      <b className="amt">{kes(p.amount)}</b>
      <button className={"status " + (isPaid ? "ok" : "warn")}
        title={isPaid ? "Mark as pending" : "Mark as paid"}
        onClick={() => patch(c.id, (cur) => ({ payments: (cur.payments || []).map((x) => x.id === p.id ? { ...x, status: isPaid ? "pending" : "paid" } : x) }), isPaid ? "" : "Marked as paid")}>
        {isPaid ? <><Icon name="check" size={13} />Paid</> : "Pending"}
      </button>
      <button className="icon-btn" aria-label="Remove payment" title="Remove payment"
        onClick={() => patch(c.id, (cur) => ({ payments: (cur.payments || []).filter((x) => x.id !== p.id) }), "Payment removed")}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export function ClientSelect({ value, onChange, clients, required = true }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required={required} aria-label="Client">
      <option value="">Choose client…</option>
      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export function InvPill({ inv }) {
  const [n, cls] = INV_STATUS[invStatus(inv)];
  return <span className={"pill " + cls}>{n}</span>;
}

export function PersonSelect({ value, onChange, roles, empty = "Nobody", label }) {
  const { users, person } = useDesk();
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{empty}</option>
      {users.filter((u) => !roles || roles.includes(u.role)).map((u) => <option key={u.email} value={u.email}>{person(u.email)}</option>)}
    </select>
  );
}
