import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { Link, setQuery, useLocation } from "../router.jsx";
import { Empty, Icon, PageHead, PersonSelect, Seg } from "../ui.jsx";
import { roleName, statusText } from "../util.js";

const KINDS = [["", "All"], ["auth", "Sign-ins"], ["client", "Clients"], ["invoice", "Invoices"], ["file", "Files"], ["team", "Team"]];
const ICON = { auth: "user", client: "clients", invoice: "invoice", file: "image", team: "team", settings: "gear" };

const dayLabel = (t) => {
  const d = new Date(t * 1000), today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};
const timeOf = (t) => new Date(t * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/* A list of activity entries. Used on the Activity page and in a client's History. */
export function ActivityFeed({ params, compact, empty = "Nothing recorded yet." }) {
  const { clients, person } = useDesk();
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(false);
  const key = JSON.stringify(params);
  const load = useCallback(async (before) => {
    const limit = compact ? 15 : 60;
    try {
      const rows = await api.activity({ ...params, before, limit });
      setItems((cur) => (before ? [...(cur || []), ...rows] : rows));
      setMore(rows.length === limit);
    } catch { setItems((cur) => cur || []); }
  }, [key]); // eslint-disable-line
  useEffect(() => { setItems(null); load(); const t = setInterval(() => load(), 30000); return () => clearInterval(t); }, [load]);

  if (items === null) return <p className="quiet">Loading…</p>;
  if (!items.length) return <p className="quiet">{empty}</p>;

  const sentence = (a) => {
    const parts = a.summary.split("{client}");
    const exists = clients.some((c) => c.id === a.target);
    const name = a.targetName || "a client";
    return parts.map((p, i) => (
      <React.Fragment key={i}>{p}{i < parts.length - 1 && (exists && !compact ? <Link to={`/clients/${a.target}`} className="clink">{name}</Link> : <b>{name}</b>)}</React.Fragment>
    ));
  };

  let lastDay = "";
  return (
    <div className={"feed" + (compact ? " compact" : "")}>
      {items.map((a) => {
        const day = dayLabel(a.at);
        const head = !compact && day !== lastDay ? <h3 className="grp">{day}</h3> : null;
        lastDay = day;
        return (
          <React.Fragment key={a.id}>
            {head}
            <div className={"act k-" + a.kind}>
              <span className="act-ic"><Icon name={ICON[a.kind] || "file"} size={14} /></span>
              <span className="act-t"><b>{person(a.email) === "You" ? "You" : person(a.email)}</b> {sentence(a)}</span>
              <time title={new Date(a.at * 1000).toLocaleString("en-GB")}>{compact ? `${dayLabel(a.at) === "Today" ? "" : dayLabel(a.at).split(",")[0] + " "}${timeOf(a.at)}` : timeOf(a.at)}</time>
            </div>
          </React.Fragment>
        );
      })}
      {more && <button className="linkbtn" onClick={() => load(items[items.length - 1].id)}>Show older</button>}
    </div>
  );
}

export default function Activity() {
  const { isOwner, users, me, person, toast, loadMeta } = useDesk();
  const { query } = useLocation();
  const who = query.get("person") || "";
  const kind = query.get("kind") || "";
  const [armed, setArmed] = useState(false);
  if (!isOwner) return <Empty title="Owner only" />;
  const u = users.find((x) => x.email === who);

  async function signOutEverywhere() {
    if (!armed) return setArmed(true);
    try { const r = await api.signOutUser(who); toast(`${person(who)} signed out of ${r.devices} device${r.devices === 1 ? "" : "s"}`, "ok"); loadMeta(); }
    catch (e) { toast(e.message, "bad"); }
    setArmed(false);
  }

  return (
    <>
      <PageHead title="Activity" sub="Who did what, and when. Kept for 180 days." />
      <div className="filters">
        <Seg label="Type" value={kind} onChange={(v) => setQuery("kind", v)} options={KINDS} />
        <label className="inline">Person<PersonSelect value={who} onChange={(v) => setQuery("person", v)} empty="Everyone" label="Person" /></label>
      </div>
      {u && (
        <section className="card-p person-card">
          <span className={"dot s-" + u.status} />
          <span className="t"><b>{person(u.email)}</b><small>{roleName(u.role)} · {statusText(u)}{u.sessions ? ` · signed in on ${u.sessions} device${u.sessions === 1 ? "" : "s"}` : ""}</small></span>
          {u.email !== me.email && u.sessions > 0 && (
            <button className={"btn sm danger" + (armed ? " armed" : "")} onBlur={() => setArmed(false)} onClick={signOutEverywhere}>
              {armed ? "Click again to confirm" : "Sign out everywhere"}
            </button>
          )}
        </section>
      )}
      <section className="card-p">
        <ActivityFeed params={{ email: who, kind }} empty={who || kind ? "Nothing matches these filters." : "Nothing recorded yet. Sign-ins, changes to clients and invoices will appear here."} />
      </section>
    </>
  );
}
