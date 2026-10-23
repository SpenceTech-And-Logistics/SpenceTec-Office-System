import React, { useMemo, useState } from "react";
import { useDesk } from "../desk.jsx";
import { setQuery, useLocation } from "../router.jsx";
import { ClientSelect, Empty, Icon, PageHead, PersonSelect, Seg, TaskRow } from "../ui.jsx";
import { allTasks, byDue, today, daysFromNow, uid, tasksOf } from "../util.js";

export default function Tasks() {
  const { me, clients, loaded, patch } = useDesk();
  const { query } = useLocation();
  const show = query.get("show") || "open";
  const who = query.get("client") || "";
  const mine = query.get("for") || "";
  const [assignee, setAssignee] = useState("");
  const [text, setText] = useState("");
  const [cid, setCid] = useState(who);
  const [due, setDue] = useState("");

  const groups = useMemo(() => {
    const t = today(), wk = daysFromNow(7);
    const items = allTasks(clients).filter((x) => (!who || x.c.id === who) && (!mine || (mine === "me" ? x.t.assignee === me.email : mine === "none" ? !x.t.assignee : x.t.assignee === mine)));
    const open = items.filter((x) => !x.t.done).sort(byDue);
    const done = items.filter((x) => x.t.done);
    if (show === "done") return [["Done", done, ""]];
    const g = [
      ["Overdue", open.filter((x) => x.t.due && x.t.due < t), "late"],
      ["Today", open.filter((x) => x.t.due === t), "soon"],
      ["Next 7 days", open.filter((x) => x.t.due > t && x.t.due <= wk), ""],
      ["Later", open.filter((x) => x.t.due > wk), ""],
      ["No date", open.filter((x) => !x.t.due), ""],
    ];
    return show === "all" ? [...g, ["Done", done, ""]] : g;
  }, [clients, show, who, mine, me.email]);

  const total = groups.reduce((a, g) => a + g[1].length, 0);

  const add = (e) => {
    e.preventDefault();
    if (!text.trim() || !cid) return;
    patch(cid, (cur) => ({ tasks: [...tasksOf(cur), { id: uid(), text: text.trim(), due, done: false, assignee }] }), "Task added");
    setText(""); setDue("");
  };

  return (
    <>
      <PageHead title="Tasks" sub="Every task across all clients, soonest first">
        <Seg label="Show" value={show} onChange={(v) => setQuery("show", v === "open" ? "" : v)} options={[["open", "Open"], ["done", "Done"], ["all", "All"]]} />
      </PageHead>

      <form className="card-p addbar" onSubmit={add}>
        <input placeholder="What needs doing?" aria-label="New task" value={text} onChange={(e) => setText(e.target.value)} />
        <ClientSelect value={cid} onChange={setCid} clients={clients} />
        <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
        <PersonSelect value={assignee} onChange={setAssignee} roles={["owner", "secretary"]} empty="Anyone" label="Assign to" />
        <button className="btn primary"><Icon name="plus" size={16} />Add task</button>
      </form>

      <div className="filters">
        <Seg label="Whose tasks" value={mine || "all"} onChange={(v) => setQuery("for", v === "all" ? "" : v)} options={[["all", "Everyone's"], ["me", "Mine"], ["none", "Unassigned"]]} />
        <label className="inline">Client
          <select value={who} onChange={(e) => setQuery("client", e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {!loaded ? <Empty title="Loading…" />
      : !total ? <Empty title={show === "done" ? "Nothing done yet" : "All clear"}>{show === "done" ? "Ticked tasks show up here." : "No open tasks. Add one above."}</Empty>
      : (
        <div className="stack">
          {groups.filter((g) => g[1].length).map(([n, list, cls]) => (
            <section key={n} className="card-p">
              <div className="ch"><h2 className={cls}>{n}</h2><span className="count">{list.length}</span></div>
              <div className="items">{list.map(({ c, t }) => <TaskRow key={c.id + t.id} c={c} t={t} showClient />)}</div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
