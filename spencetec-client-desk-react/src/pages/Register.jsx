import React, { useRef, useState } from "react";
import { api } from "../api.js";
import { useDesk } from "../desk.jsx";
import { navigate } from "../router.jsx";
import { Icon, PageHead, PersonSelect } from "../ui.jsx";
import { LinksEditor } from "../profile.jsx";
import { STAGES, slug, shrinkImage } from "../util.js";

const SOURCES = ["Referral", "Met in person", "Phone call", "WhatsApp", "Social media", "Website", "Event", "Other"];

export default function Register() {
  const { me, isStaff, clients, refresh, toast } = useDesk();
  const [f, setF] = useState({ name: "", title: "", org: "", location: "", phone: "", whatsapp: "", email: "", type: "", budget: "", domain: "", source: "", about: "", stage: "enquiry", rep: isStaff ? "" : me.email });
  const [links, setLinks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [cv, setCv] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const photoIn = useRef(null), cvIn = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) { setErr("Enter the client's name."); return; }
    setErr(""); setBusy("Saving client…");
    // Sales reps can't see every client, so their ids always get a short random ending.
    let id = slug(name) + (isStaff ? "" : "-" + Math.random().toString(36).slice(2, 6));
    while (clients.some((c) => c.id === id)) id = slug(name) + "-" + Math.random().toString(36).slice(2, 5);
    const data = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    data.budget = data.budget === "" ? "" : +data.budget;
    data.links = links;
    if (isStaff) Object.assign(data, { content: "none", tasks: [], payments: [], hosting: "", repo: "", notes: "" });
    try { await api.saveClient(id, data); }
    catch (x) { setErr(x.message); setBusy(""); return; }
    const all = [...photos.map((p) => ["photo", p]), ...(cv ? [["cv", cv]] : [])];
    for (let i = 0; i < all.length; i++) {
      setBusy(`Uploading file ${i + 1} of ${all.length}…`);
      try { await api.upload(id, all[i][0], all[i][0] === "photo" ? await shrinkImage(all[i][1]) : all[i][1]); }
      catch (x) { toast(`${all[i][1].name}: ${x.message}`, "bad"); }
    }
    await refresh();
    toast(`${name} registered`, "ok");
    navigate(`/clients/${id}`);
  }

  const field = (k, l, ph, type = "text", extra = {}) => (
    <label className={extra.full ? "full" : ""}>{l}{extra.req && <em className="req">required</em>}
      <input type={type} value={f[k]} placeholder={ph} onChange={set(k)} {...(type === "number" ? { min: 0, inputMode: "numeric" } : {})} autoFocus={extra.auto} />
    </label>
  );

  return (
    <>
      <PageHead back={isStaff ? ["/clients", "Clients"] : ["/", "My clients"]} title="Register a client"
        sub={isStaff ? "Add a new client to the pipeline." : "Your client goes to the office as a new enquiry. Only you and the office can see it."} />

      <form className="reg" onSubmit={submit}>
        <section className="card-p">
          <div className="ch"><h2><span className="num">1</span>Who is the client?</h2></div>
          <div className="fields">
            {field("name", "Full name", "e.g. Hon. Jane Wanjiru", "text", { req: true, full: true, auto: true })}
            {field("title", "Title or position", "e.g. MP, Kirinyaga Central")}
            {field("org", "Organisation", "Company, office or party")}
            {field("location", "Location", "Town or county")}
            <label>How did you meet?<select value={f.source} onChange={set("source")}><option value="">—</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
        </section>

        <section className="card-p">
          <div className="ch"><h2><span className="num">2</span>Contact details</h2></div>
          <div className="fields">
            {field("phone", "Phone", "+254 7…", "tel")}
            {field("whatsapp", "WhatsApp (if different)", "+254 7…", "tel")}
            {field("email", "Email", "name@example.com", "email", { full: true })}
          </div>
        </section>

        <section className="card-p">
          <div className="ch"><h2><span className="num">3</span>What do they need?</h2></div>
          <div className="fields">
            {field("type", "Project", "e.g. Portfolio website", "text")}
            {field("budget", "Budget estimate (KES)", "Optional", "number")}
            {field("domain", "Domain they own or want", "name.com", "text", { full: true })}
            <label className="full">About the client<textarea value={f.about} onChange={set("about")} placeholder="Background, what they're known for, what they want the site to say…" /></label>
          </div>
          {isStaff && (
            <div className="fields">
              <label>Stage<select value={f.stage} onChange={set("stage")}>{STAGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label>Sales rep<PersonSelect value={f.rep} onChange={(v) => setF((x) => ({ ...x, rep: v }))} roles={["sales", "owner", "secretary"]} label="Sales rep" /></label>
            </div>
          )}
        </section>

        <section className="card-p">
          <div className="ch"><h2><span className="num">4</span>Social media and other pages</h2></div>
          <p className="small">Facebook, X, Instagram, LinkedIn, Wikipedia, news articles: anything that helps the designers.</p>
          <LinksEditor links={links} onChange={setLinks} />
        </section>

        <section className="card-p">
          <div className="ch"><h2><span className="num">5</span>Photos and CV</h2></div>
          <input ref={photoIn} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => { const picked = [...e.target.files]; setPhotos((p) => [...p, ...picked].slice(0, 12)); e.target.value = ""; }} />
          <input ref={cvIn} type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={(e) => { setCv(e.target.files[0] || null); e.target.value = ""; }} />
          <div className="gallery">
            {photos.map((p, i) => (
              <figure key={i} className="ph">
                <span className="ph-img"><Preview file={p} /></span>
                <button type="button" className="ph-del" aria-label="Remove photo" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
              </figure>
            ))}
            {photos.length < 12 && <button type="button" className="ph add" onClick={() => photoIn.current.click()}><Icon name="image" size={22} /><span>Add photos</span></button>}
          </div>
          <div className="item">
            <Icon name="user" />
            <span className="t"><span className="tt">CV / profile document</span><span className="meta">{cv ? cv.name : "Optional · PDF or Word, up to 1.9 MB"}</span></span>
            {cv && <button type="button" className="icon-btn" aria-label="Remove CV" onClick={() => setCv(null)}><Icon name="x" size={15} /></button>}
            <button type="button" className="btn sm" onClick={() => cvIn.current.click()}><Icon name="upload" size={14} />{cv ? "Change" : "Choose file"}</button>
          </div>
        </section>

        <div className="reg-foot">
          <div className="err" role="alert">{err}</div>
          <button type="button" className="btn" onClick={() => history.back()}>Cancel</button>
          <button className="btn primary" disabled={!!busy}>{busy || "Register client"}</button>
        </div>
      </form>
    </>
  );
}

function Preview({ file }) {
  const [url, setUrl] = React.useState("");
  React.useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return url ? <img src={url} alt={file.name} /> : null;
}
