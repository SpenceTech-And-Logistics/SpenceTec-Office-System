import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, fileUrl } from "./api.js";
import { useDesk } from "./desk.jsx";
import { Icon } from "./ui.jsx";
import { LINK_TYPES, fmtSize, href, shrinkImage, uid } from "./util.js";

/* ---------- photos, CV and documents for one client ---------- */
export function ClientFiles({ c, canEdit = true }) {
  const { toast, refresh } = useDesk();
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState("");
  const [view, setView] = useState(null);
  const photoIn = useRef(null), cvIn = useRef(null), docIn = useRef(null);
  const load = useCallback(() => api.files(c.id).then(setFiles).catch(() => setFiles([])), [c.id]);
  useEffect(() => { load(); }, [load]);

  async function upload(kind, list) {
    const arr = [...list];
    if (!arr.length) return;
    for (let i = 0; i < arr.length; i++) {
      setBusy(arr.length > 1 ? `Uploading ${i + 1} of ${arr.length}…` : "Uploading…");
      try {
        const f = kind === "photo" ? await shrinkImage(arr[i]) : arr[i];
        await api.upload(c.id, kind, f);
      } catch (e) { toast(`${arr[i].name}: ${e.message}`, "bad"); }
    }
    setBusy(""); load(); refresh();
  }
  async function del(f) {
    if (!confirmDel(f)) return;
    try { await api.deleteFile(f.id); load(); refresh(); } catch (e) { toast(e.message, "bad"); }
  }
  const [armed, setArmed] = useState("");
  const confirmDel = (f) => { if (armed === f.id) { setArmed(""); return true; } setArmed(f.id); setTimeout(() => setArmed((a) => (a === f.id ? "" : a)), 3000); return false; };

  const photos = (files || []).filter((f) => f.kind === "photo");
  const cv = (files || []).find((f) => f.kind === "cv");
  const docs = (files || []).filter((f) => f.kind === "doc");

  return (
    <section className="card-p">
      <div className="ch"><h2>Photos and documents</h2>{busy && <span className="count">{busy}</span>}</div>
      <input ref={photoIn} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload("photo", e.target.files); e.target.value = ""; }} />
      <input ref={cvIn} type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={(e) => { upload("cv", e.target.files); e.target.value = ""; }} />
      <input ref={docIn} type="file" accept=".pdf,.doc,.docx,image/*" multiple hidden onChange={(e) => { upload("doc", e.target.files); e.target.value = ""; }} />

      {files === null ? <p className="quiet">Loading…</p> : (
        <>
          <div className="gallery">
            {photos.map((f) => (
              <figure key={f.id} className="ph">
                <button className="ph-img" onClick={() => setView(f)} aria-label={`View ${f.name}`}><img src={fileUrl(f.id)} alt={f.name} loading="lazy" /></button>
                {canEdit && <button className={"ph-del" + (armed === f.id ? " armed" : "")} onClick={() => del(f)} aria-label="Remove photo" title={armed === f.id ? "Click again to remove" : "Remove photo"}><Icon name="x" size={14} /></button>}
              </figure>
            ))}
            {canEdit && photos.length < 12 && (
              <button className="ph add" onClick={() => photoIn.current.click()} disabled={!!busy}>
                <Icon name="image" size={22} /><span>Add photos</span>
              </button>
            )}
            {!canEdit && !photos.length && <p className="quiet">No photos.</p>}
          </div>

          <div className="items">
            <div className="item">
              <Icon name="user" />
              <span className="t"><span className="tt">CV / profile</span>
                <span className="meta">{cv ? <a className="clink" href={fileUrl(cv.id)} target="_blank" rel="noreferrer">{cv.name}</a> : "Optional"}{cv && <span>{fmtSize(cv.size)}</span>}</span>
              </span>
              {canEdit && <button className="btn sm" onClick={() => cvIn.current.click()} disabled={!!busy}><Icon name="upload" size={14} />{cv ? "Replace" : "Upload"}</button>}
              {canEdit && cv && <button className={"icon-btn" + (armed === cv.id ? " danger-on" : "")} onClick={() => del(cv)} aria-label="Remove CV" title={armed === cv.id ? "Click again to remove" : "Remove"}><Icon name="x" size={15} /></button>}
            </div>
            {docs.map((f) => (
              <div className="item" key={f.id}>
                <Icon name="file" />
                <span className="t"><a className="tt clink" href={fileUrl(f.id)} target="_blank" rel="noreferrer">{f.name}</a><span className="meta"><span>{fmtSize(f.size)}</span></span></span>
                {canEdit && <button className={"icon-btn" + (armed === f.id ? " danger-on" : "")} onClick={() => del(f)} aria-label="Remove document" title={armed === f.id ? "Click again to remove" : "Remove"}><Icon name="x" size={15} /></button>}
              </div>
            ))}
          </div>
          {canEdit && <button className="linkbtn" onClick={() => docIn.current.click()} disabled={!!busy}>+ Add another document (contract, brief, logo…)</button>}
          <p className="small">Photos are resized automatically. Each file can be up to 1.9 MB; up to 12 photos.</p>
        </>
      )}

      {view && (
        <div className="scrim dark" onClick={() => setView(null)}>
          <figure className="lightbox" onClick={(e) => e.stopPropagation()}>
            <img src={fileUrl(view.id)} alt={view.name} />
            <figcaption>
              <span>{view.name}</span>
              <a className="btn sm" href={fileUrl(view.id, true)}><Icon name="upload" size={14} />Download</a>
              <button className="btn sm" onClick={() => setView(null)}>Close</button>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}

/* ---------- social media and other links ---------- */
export function LinksEditor({ links, onChange }) {
  const [label, setLabel] = useState("Facebook");
  const [url, setUrl] = useState("");
  const add = () => {
    const u = url.trim();
    if (!u) return;
    onChange([...(links || []), { id: uid(), label, url: u }]);
    setUrl("");
  };
  return (
    <div className="links-ed">
      {(links || []).map((l) => (
        <div className="item" key={l.id}>
          <span className="pill">{l.label}</span>
          <a className="t link" href={href(l.url)} target="_blank" rel="noreferrer">{l.url}</a>
          <button type="button" className="icon-btn" aria-label="Remove link" onClick={() => onChange(links.filter((x) => x.id !== l.id))}><Icon name="x" size={15} /></button>
        </div>
      ))}
      <div className="addrow link">
        <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link type">{LINK_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <input value={url} placeholder="Paste a link" aria-label="Link address" onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn" onClick={add}><Icon name="plus" size={16} /><span className="hide-sm">Add</span></button>
      </div>
    </div>
  );
}

export function LinksCard({ c, canEdit = true }) {
  const { patch } = useDesk();
  const links = c.links || [];
  return (
    <section className="card-p">
      <div className="ch"><h2>Links</h2><span className="count">{links.length}</span></div>
      {canEdit ? <LinksEditor links={links} onChange={(next) => patch(c.id, { links: next }, "Links saved")} />
        : links.length ? <div className="items">{links.map((l) => <a key={l.id} className="rowlink" href={href(l.url)} target="_blank" rel="noreferrer"><span className="t"><b>{l.label}</b><small>{l.url}</small></span><Icon name="ext" size={15} /></a>)}</div>
        : <p className="quiet">No links yet.</p>}
    </section>
  );
}

/* ---------- a card of fields with view and edit modes ---------- */
// fields: [key, label, placeholder, type?] ; type: text|email|tel|date|number|textarea|money|select:<a,b>|person:<roles>
export function EditCard({ title, c, fields, canEdit = true, render }) {
  const { patch, person, users } = useDesk();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(c);
  useEffect(() => { if (!edit) setF(c); }, [c, edit]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    const data = {};
    fields.forEach(([k, , , type]) => { const v = f[k] ?? ""; data[k] = type === "number" || type === "money" ? (v === "" ? "" : +v) : String(v).trim(); });
    if ("name" in data && !data.name) return;
    await patch(c.id, data, `${title} saved`);
    setEdit(false);
  }

  if (edit) return (
    <form className="card-p" onSubmit={save}>
      <div className="ch"><h2>Edit {title.toLowerCase()}</h2></div>
      <div className="fields one">
        {fields.map(([k, l, ph, type = "text"], i) => (
          <label key={k}>{l}
            {type === "textarea" ? <textarea value={f[k] || ""} placeholder={ph} onChange={set(k)} />
            : type.startsWith("select:") ? <select value={f[k] || ""} onChange={set(k)}><option value="">—</option>{type.slice(7).split(",").map((o) => <option key={o}>{o}</option>)}</select>
            : type.startsWith("person:") ? <select value={f[k] || ""} onChange={set(k)}><option value="">Nobody</option>{users.filter((u) => type.slice(7).split(",").includes(u.role)).map((u) => <option key={u.email} value={u.email}>{person(u.email)}</option>)}</select>
            : <input type={type === "money" ? "number" : type} min={type === "money" ? 0 : undefined} value={f[k] ?? ""} placeholder={ph} onChange={set(k)} autoFocus={i === 0} />}
          </label>
        ))}
      </div>
      <div className="row end">
        <button type="button" className="btn" onClick={() => setEdit(false)}>Cancel</button>
        <button className="btn primary">Save</button>
      </div>
    </form>
  );

  return (
    <section className="card-p">
      <div className="ch"><h2>{title}</h2>{canEdit && <button className="btn sm" onClick={() => setEdit(true)}><Icon name="edit" size={14} />Edit</button>}</div>
      <dl className="dl">
        {fields.map(([k, l, , type]) => (
          <React.Fragment key={k}><dt>{l}</dt><dd>{render?.(k, c[k], type) ?? defaultShow(k, c[k], type, person)}</dd></React.Fragment>
        ))}
      </dl>
    </section>
  );
}

function defaultShow(k, v, type, person) {
  if (v === undefined || v === null || v === "") return <span className="muted">—</span>;
  if (type === "money") return "KES " + Math.round(+v).toLocaleString("en-KE");
  if (type?.startsWith("person:")) return person(v);
  if (type === "date") return new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (type === "email") return <a href={"mailto:" + v} className="link">{v}</a>;
  if (type === "tel") return <a href={"tel:" + String(v).replace(/\s/g, "")} className="link">{v}</a>;
  if (k === "domain" || k === "repo") return <a href={href(v)} target="_blank" rel="noreferrer" className="link">{v}</a>;
  if (type === "textarea") return <span className="pre">{v}</span>;
  return String(v);
}
