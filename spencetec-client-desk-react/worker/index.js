// SpenceTec Client Desk API. Cloudflare Worker + D1.
// Email-code login for people the owner has added. Sessions are HttpOnly cookies.
// Roles: owner (everything), secretary (all clients, invoices, tasks), sales (own clients only, no money).

const STAGES = ["enquiry", "design", "build", "review", "live", "maintenance"];
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
const fail = (status, error) => json({ error }, status);

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const normEmail = (e) => String(e || "").trim().toLowerCase();
const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;
const now = () => Math.floor(Date.now() / 1000);

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function cookie(request, name) {
  const c = request.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find((p) => p.startsWith(name + "="));
  return m ? m.slice(name.length + 1) : "";
}

async function ensureOwner(env, email) {
  if (email && email === normEmail(env.OWNER_EMAIL)) {
    await env.DB.prepare(
      "INSERT INTO users (email,name,role) VALUES (?, 'Owner', 'owner') ON CONFLICT(email) DO UPDATE SET role='owner'"
    ).bind(email).run();
  }
}
const getUser = (env, email) =>
  env.DB.prepare("SELECT email,name,role FROM users WHERE email=?").bind(email).first();

// Returns { user, session } when signed in, { expired: "reason" } when a timeout ended it, or null.
// Owners keep the long session; secretaries and sales reps are signed out after inactivity or a maximum time.
async function sessionUser(request, env) {
  const t = cookie(request, "sid");
  if (!t) return null;
  const hash = await sha256(t);
  const row = await env.DB.prepare("SELECT email,expires_at,created_at,last_seen FROM sessions WHERE token_hash=?").bind(hash).first();
  if (!row || row.expires_at < now()) return null;
  const user = await getUser(env, row.email); // null if the owner has since removed them
  if (!user) return null;
  if (user.role === "owner") return { user, session: { limited: false } };

  const { results } = await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('idleMinutes','maxHours')").all();
  const cfg = Object.fromEntries(results.map((r) => [r.key, +r.value]));
  const idleMinutes = clamp(cfg.idleMinutes || 30, 5, 480);
  const maxHours = clamp(cfg.maxHours || 8, 1, 72);
  const created = row.created_at || now();
  const seen = row.last_seen || created;
  const t0 = now();
  let expired = "";
  if (t0 - seen > idleMinutes * 60) expired = `You were signed out after ${idleMinutes} minutes without activity.`;
  else if (t0 - created > maxHours * 3600) expired = `You were signed out because sign-ins last ${maxHours} hour${maxHours === 1 ? "" : "s"}. Sign in again to continue.`;
  if (expired) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(hash).run();
    return { expired };
  }
  // Background refreshes (x-poll) don't count as activity. Write at most every 30 s.
  let lastSeen = seen;
  if (request.headers.get("x-poll") !== "1" && t0 - seen >= 30) {
    await env.DB.prepare("UPDATE sessions SET last_seen=? WHERE token_hash=?").bind(t0, hash).run();
    lastSeen = t0;
  }
  return { user, session: { limited: true, idleMinutes, maxHours, lastSeen, endsAt: created + maxHours * 3600 } };
}
const clamp = (n, a, b) => Math.min(b, Math.max(a, Math.round(n)));

async function sendCode(env, email, code) {
  if (env.DEV_SHOW_CODE === "1") console.log(`[DEV] login code for ${email}: ${code}`);
  if (!env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY is not set on this Worker, so no code was sent. Run: npx wrangler secret put RESEND_API_KEY");
    return env.DEV_SHOW_CODE === "1";
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [email],
        subject: `Your SpenceTec Client Desk code: ${code}`,
        text: `Your sign-in code is ${code}\n\nIt expires in ${CODE_MINUTES} minutes. If you didn't ask for it, ignore this email.\n\nSpenceTec and Logistics Limited`,
      }),
    });
    if (r.ok) console.log(`[email] code sent to ${email} from ${env.MAIL_FROM}`);
    else console.error(`[email] Resend refused (${r.status}) sending from ${env.MAIL_FROM}: ${(await r.text()).slice(0, 300)}`);
    return r.ok;
  } catch (e) {
    console.error("[email] could not reach Resend:", e.message);
    return false;
  }
}

function rowToClient(r) {
  let d = {};
  try { d = JSON.parse(r.data); } catch {}
  return { ...d, id: r.id, updated: r.updated_at, updatedBy: r.updated_by };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    // Setup check: shows which settings exist (never their values). Open /api/health in a browser.
    if (path === "/api/health" && request.method === "GET") {
      return json({
        worker: "ok",
        authSecret: !!env.AUTH_SECRET,
        resendKey: !!env.RESEND_API_KEY,
        mailFrom: env.MAIL_FROM || "",
        ownerEmail: !!env.OWNER_EMAIL,
        database: !!env.DB,
      });
    }
    if (!env.AUTH_SECRET) return fail(500, "Server not configured (AUTH_SECRET missing)");

    const method = request.method;
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && new URL(origin).host !== url.host) return fail(403, "Bad origin");
    }

    try {
      /* ---------- auth ---------- */
      if (path === "/api/auth/request" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = normEmail(body.email);
        if (!validEmail(email)) return fail(400, "Enter a valid email address");
        await ensureOwner(env, email);
        const user = await getUser(env, email);
        if (user) {
          const prev = await env.DB.prepare("SELECT created_at FROM login_codes WHERE email=?").bind(email).first();
          if (prev && now() - prev.created_at < 45) console.log(`[email] code for ${email} asked again within 45 s; not resent`);
          if (!prev || now() - prev.created_at >= 45) {
            const code = randomCode();
            await env.DB.prepare(
              "INSERT INTO login_codes (email,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,0,?) " +
              "ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at"
            ).bind(email, await sha256(`${email}:${code}:${env.AUTH_SECRET}`), now() + CODE_MINUTES * 60, now()).run();
            await sendCode(env, email, code);
          }
        }
        else console.log(`[email] ${email} is not on the team; no code sent`);
        // Same answer whether or not the email is on the team.
        return json({ ok: true });
      }

      if (path === "/api/auth/verify" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = normEmail(body.email);
        const code = String(body.code || "").replace(/\D/g, "");
        const row = await env.DB.prepare("SELECT * FROM login_codes WHERE email=?").bind(email).first();
        if (!row || row.expires_at < now() || row.attempts >= 5) return fail(401, "Code expired. Ask for a new one.");
        if ((await sha256(`${email}:${code}:${env.AUTH_SECRET}`)) !== row.code_hash) {
          await env.DB.prepare("UPDATE login_codes SET attempts=attempts+1 WHERE email=?").bind(email).run();
          return fail(401, "That code isn't right.");
        }
        const user = await getUser(env, email);
        if (!user) return fail(401, "Code expired. Ask for a new one.");
        await env.DB.prepare("DELETE FROM login_codes WHERE email=?").bind(email).run();
        const token = randomToken();
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now()),
          env.DB.prepare("INSERT INTO sessions (token_hash,email,expires_at,created_at,last_seen) VALUES (?,?,?,?,?)")
            .bind(await sha256(token), email, now() + SESSION_DAYS * 86400, now(), now()),
        ]);
        return json({ user }, 200, {
          "Set-Cookie": `sid=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`,
        });
      }

      if (path === "/api/auth/logout" && method === "POST") {
        const t = cookie(request, "sid");
        if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(t)).run();
        return json({ ok: true }, 200, { "Set-Cookie": "sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
      }


      /* ---------- everything below needs a signed-in team member ---------- */
      const auth = await sessionUser(request, env);
      if (auth?.expired) {
        return json({ error: auth.expired, expired: true }, 401, { "Set-Cookie": "sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
      }
      const me = auth?.user;
      if (!me) return fail(401, "Not signed in");
      if (path === "/api/me" && method === "GET") return json({ user: me, session: auth.session });
      // Activity heartbeat from the page (mouse, keys, scrolling). sessionUser already recorded it.
      if (path === "/api/ping" && method === "POST") return json({ ok: true, session: auth.session });
      const isOwner = me.role === "owner";
      const isStaff = isOwner || me.role === "secretary";
      const isSales = me.role === "sales";

      const readJson = async (max = 100000) => {
        const text = await request.text();
        if (text.length > max) throw Object.assign(new Error("Too large"), { status: 413 });
        let b;
        try { b = JSON.parse(text); } catch { throw Object.assign(new Error("Bad JSON"), { status: 400 }); }
        if (!b || typeof b !== "object" || Array.isArray(b)) throw Object.assign(new Error("Bad body"), { status: 400 });
        return b;
      };
      const loadClient = async (id) => {
        const r = await env.DB.prepare("SELECT * FROM clients WHERE id=?").bind(id).first();
        return r ? rowToClient(r) : null;
      };
      const canSee = (c) => c && (isStaff || ownsClient(c, me.email));

      /* ---------- team ---------- */
      if (path === "/api/users") {
        if (method === "GET") {
          // Secretaries need the list to assign tasks and sales reps; only the owner manages it.
          if (!isStaff) return fail(403, "Not allowed");
          const { results } = await env.DB.prepare("SELECT email,name,role,created_at FROM users ORDER BY email").all();
          return json(results);
        }
        if (method === "POST") {
          if (!isOwner) return fail(403, "Owner only");
          const b = await readJson();
          const email = normEmail(b.email);
          if (!validEmail(email)) return fail(400, "Enter a valid email address");
          const role = ROLES.includes(b.role) ? b.role : "sales";
          const name = String(b.name || "").trim().slice(0, 80);
          if (email === normEmail(env.OWNER_EMAIL) && role !== "owner") return fail(400, "The main owner must stay an owner");
          await env.DB.prepare("INSERT INTO users (email,name,role) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role")
            .bind(email, name, role).run();
          return json({ ok: true });
        }
      }
      const um = path.match(/^\/api\/users\/([^/]+)$/);
      if (um) {
        if (!isOwner) return fail(403, "Owner only");
        const email = normEmail(decodeURIComponent(um[1]));
        const u = await getUser(env, email);
        if (!u) return method === "DELETE" ? json({ ok: true }) : fail(404, "No such person");
        const isMain = email === normEmail(env.OWNER_EMAIL);
        if (method === "PATCH") {
          const b = await readJson();
          const role = b.role === undefined ? u.role : b.role;
          if (!ROLES.includes(role)) return fail(400, "Bad role");
          if ((isMain || email === me.email) && role !== "owner") return fail(400, isMain ? "The main owner must stay an owner" : "You can't remove your own owner role");
          const name = b.name === undefined ? u.name : String(b.name).trim().slice(0, 80);
          await env.DB.prepare("UPDATE users SET role=?, name=? WHERE email=?").bind(role, name, email).run();
          return json({ ok: true });
        }
        if (method === "DELETE") {
          if (isMain || email === me.email) return fail(400, "That owner can't be removed");
          await env.DB.batch([
            env.DB.prepare("DELETE FROM sessions WHERE email=?").bind(email),
            env.DB.prepare("DELETE FROM login_codes WHERE email=?").bind(email),
            env.DB.prepare("DELETE FROM users WHERE email=?").bind(email),
          ]);
          return json({ ok: true });
        }
      }

      /* ---------- clients ---------- */
      if (path === "/api/clients" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM clients ORDER BY name COLLATE NOCASE").all();
        const list = results.map(rowToClient);
        const counts = {};
        const fr = await env.DB.prepare("SELECT client_id, kind, COUNT(*) n FROM files GROUP BY client_id, kind").all();
        for (const r of fr.results) (counts[r.client_id] ||= {})[r.kind] = r.n;
        const withFiles = (c) => ({ ...c, files: counts[c.id] || {} });
        if (isStaff) return json(list.map(withFiles));
        return json(list.filter((c) => ownsClient(c, me.email)).map((c) => withFiles(salesView(c))));
      }
      const cm = path.match(/^\/api\/clients\/([^/]+)(\/files)?$/);
      if (cm) {
        const id = decodeURIComponent(cm[1]);
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail(400, "Bad id");

        /* files of one client */
        if (cm[2]) {
          const c = await loadClient(id);
          if (!canSee(c)) return fail(404, "Client not found");
          if (method === "GET") {
            const { results } = await env.DB.prepare("SELECT id,kind,name,mime,size,created_at,created_by FROM files WHERE client_id=? ORDER BY created_at").bind(id).all();
            return json(results);
          }
          if (method === "POST") {
            const kind = url.searchParams.get("kind");
            const name = (url.searchParams.get("name") || "file").slice(0, 120);
            const mime = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
            if (!["photo", "cv", "doc"].includes(kind)) return fail(400, "Bad kind");
            if (kind === "photo" && !IMAGE_TYPES.includes(mime)) return fail(400, "Photos must be JPG, PNG or WebP");
            if (kind !== "photo" && !DOC_TYPES.includes(mime)) return fail(400, "Upload a PDF, Word document or image");
            const buf = await request.arrayBuffer();
            if (!buf.byteLength) return fail(400, "Empty file");
            if (buf.byteLength > MAX_FILE) return fail(413, "File is over 1.9 MB. Compress it or save a smaller PDF.");
            if (kind === "photo") {
              const n = await env.DB.prepare("SELECT COUNT(*) n FROM files WHERE client_id=? AND kind='photo'").bind(id).first();
              if (n.n >= MAX_PHOTOS) return fail(400, `Up to ${MAX_PHOTOS} photos per client. Remove one first.`);
            }
            const fid = randomToken().slice(0, 20);
            const stmts = [];
            if (kind === "cv") stmts.push(env.DB.prepare("DELETE FROM files WHERE client_id=? AND kind='cv'").bind(id));
            stmts.push(env.DB.prepare("INSERT INTO files (id,client_id,kind,name,mime,size,data,created_by) VALUES (?,?,?,?,?,?,?,?)")
              .bind(fid, id, kind, name, mime, buf.byteLength, buf, me.email));
            await env.DB.batch(stmts);
            return json({ id: fid });
          }
          return fail(405, "Method not allowed");
        }

        if (method === "DELETE") {
          if (!isOwner) return fail(403, "Only the owner can delete a client");
          await env.DB.batch([
            env.DB.prepare("DELETE FROM clients WHERE id=?").bind(id),
            env.DB.prepare("DELETE FROM files WHERE client_id=?").bind(id),
          ]);
          return json({ ok: true });
        }
        if (method === "PUT" || method === "PATCH") {
          const body = await readJson();
          for (const k of ["id", "updated", "updatedBy", "createdBy", "created", "files"]) delete body[k];
          const cur = await loadClient(id);
          if (method === "PATCH" && !cur) return fail(404, "Client not found");
          if (method === "PUT" && cur) {
            if (isSales) return fail(409, "That client already exists");
          }
          let next;
          if (isSales) {
            if (cur && !ownsClient(cur, me.email)) return fail(404, "Client not found");
            const allowed = Object.fromEntries(Object.entries(body).filter(([k]) => SALES_FIELDS.includes(k)));
            next = cur
              ? { ...stripMeta(cur), ...allowed }
              : { ...allowed, stage: "enquiry", content: "none", rep: me.email, createdBy: me.email, created: new Date().toISOString().slice(0, 10), tasks: [], payments: [] };
          } else {
            next = cur ? { ...stripMeta(cur), ...body } : { ...body, createdBy: me.email, created: new Date().toISOString().slice(0, 10) };
          }
          if (!next.name || !String(next.name).trim()) return fail(400, "Name is required");
          if (!STAGES.includes(next.stage)) return fail(400, "Bad stage");
          if (next.links && !Array.isArray(next.links)) return fail(400, "Bad links");
          await env.DB.prepare(
            "INSERT INTO clients (id,name,stage,data,updated_at,updated_by) VALUES (?,?,?,?,datetime('now'),?) " +
            "ON CONFLICT(id) DO UPDATE SET name=excluded.name,stage=excluded.stage,data=excluded.data,updated_at=excluded.updated_at,updated_by=excluded.updated_by"
          ).bind(id, String(next.name).trim(), next.stage, JSON.stringify(next), me.email).run();
          return json({ ok: true });
        }
      }

      /* ---------- single file ---------- */
      const fm = path.match(/^\/api\/files\/([A-Za-z0-9]{1,40})$/);
      if (fm) {
        const meta = await env.DB.prepare("SELECT id,client_id,kind,name,mime,created_by FROM files WHERE id=?").bind(fm[1]).first();
        const c = meta && await loadClient(meta.client_id);
        if (!meta || !canSee(c)) return fail(404, "File not found");
        if (method === "GET") {
          const row = await env.DB.prepare("SELECT data FROM files WHERE id=?").bind(fm[1]).first();
          const d = row.data;
          const bytes = d instanceof ArrayBuffer ? d : ArrayBuffer.isView(d) ? d : Uint8Array.from(d);
          const safe = meta.name.replace(/[^\w.\- ]+/g, "_");
          const inline = url.searchParams.get("download") ? "attachment" : "inline";
          return new Response(bytes, { headers: {
            "content-type": meta.mime,
            "content-disposition": `${inline}; filename="${safe}"`,
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          } });
        }
        if (method === "DELETE") {
          await env.DB.prepare("DELETE FROM files WHERE id=?").bind(fm[1]).run();
          return json({ ok: true });
        }
      }

      /* ---------- invoices (owner + secretary) ---------- */
      if (path.startsWith("/api/invoices")) {
        if (!isStaff) return fail(403, "Not allowed");
        if (path === "/api/invoices" && method === "GET") {
          const { results } = await env.DB.prepare("SELECT * FROM invoices ORDER BY number DESC").all();
          return json(results.map(rowToInvoice));
        }
        if (path === "/api/invoices" && method === "POST") {
          const b = await readJson();
          if (!b.clientId) return fail(400, "Choose a client");
          const c = await loadClient(String(b.clientId));
          if (!c) return fail(400, "Client not found");
          const id = "inv-" + randomToken().slice(0, 12);
          const data = cleanInvoice(b);
          for (let tries = 0; tries < 3; tries++) {
            const m = await env.DB.prepare("SELECT COALESCE(MAX(number),0)+1 n FROM invoices").first();
            try {
              await env.DB.prepare("INSERT INTO invoices (id,number,client_id,status,data,created_by,updated_by) VALUES (?,?,?,?,?,?,?)")
                .bind(id, m.n, c.id, "draft", JSON.stringify(data), me.email, me.email).run();
              return json({ id, number: m.n });
            } catch (e) { if (!String(e.message).includes("UNIQUE")) throw e; }
          }
          return fail(409, "Try again");
        }
        const im = path.match(/^\/api\/invoices\/([A-Za-z0-9_-]{1,40})$/);
        if (im) {
          const row = await env.DB.prepare("SELECT * FROM invoices WHERE id=?").bind(im[1]).first();
          if (!row) return fail(404, "Invoice not found");
          if (method === "GET") return json(rowToInvoice(row));
          if (method === "PATCH") {
            const b = await readJson();
            const status = b.status === undefined ? row.status : b.status;
            if (!["draft", "sent", "void"].includes(status)) return fail(400, "Bad status");
            const cur = JSON.parse(row.data);
            const data = cleanInvoice({ ...cur, ...b });
            await env.DB.prepare("UPDATE invoices SET status=?, data=?, client_id=?, updated_at=datetime('now'), updated_by=? WHERE id=?")
              .bind(status, JSON.stringify(data), data.clientId || row.client_id, me.email, row.id).run();
            return json({ ok: true });
          }
          if (method === "DELETE") {
            if (!isOwner && row.status !== "draft") return fail(403, "Only drafts can be deleted. Void the invoice instead.");
            await env.DB.prepare("DELETE FROM invoices WHERE id=?").bind(row.id).run();
            return json({ ok: true });
          }
        }
      }

      /* ---------- company settings ---------- */
      if (path === "/api/settings") {
        if (!isStaff) return fail(403, "Not allowed");
        if (method === "GET") {
          const { results } = await env.DB.prepare("SELECT key,value FROM settings").all();
          return json(Object.fromEntries(results.map((r) => [r.key, r.value])));
        }
        if (method === "PUT") {
          if (!isOwner) return fail(403, "Owner only");
          const b = await readJson();
          const stmts = SETTINGS.filter((k) => b[k] !== undefined).map((k) =>
            env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, String(b[k]).slice(0, 2000)));
          if (stmts.length) await env.DB.batch(stmts);
          return json({ ok: true });
        }
      }

      return fail(404, "Not found");
    } catch (e) {
      if (e.status) return fail(e.status, e.message);
      console.error(e);
      return fail(500, "Something went wrong");
    }
  },
};

/* ---------- helpers for roles, files and invoices ---------- */
const ROLES = ["owner", "secretary", "sales"];
// Fields a sales rep may see and edit on their own clients. Money, tasks and internal notes stay with the office.
const SALES_FIELDS = ["name", "org", "title", "type", "phone", "email", "whatsapp", "location", "about", "budget", "links", "domain", "source", "repNotes"];
const SALES_VIEW = [...SALES_FIELDS, "id", "stage", "rep", "createdBy", "created", "updated", "updatedBy"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [...IMAGE_TYPES, "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const MAX_FILE = 1900000;
const MAX_PHOTOS = 12;
const SETTINGS = ["company", "address", "email", "phone", "kraPin", "invoicePrefix", "vatRate", "payInstructions", "footer", "idleMinutes", "maxHours"];

const ownsClient = (c, email) => c.rep === email || c.createdBy === email;
const salesView = (c) => Object.fromEntries(Object.entries(c).filter(([k]) => SALES_VIEW.includes(k)));
const stripMeta = (c) => { const { id, updated, updatedBy, files, ...rest } = c; return rest; };

function rowToInvoice(r) {
  let d = {};
  try { d = JSON.parse(r.data); } catch {}
  return { ...d, id: r.id, number: r.number, clientId: r.client_id, status: r.status, created: r.created_at, createdBy: r.created_by, updated: r.updated_at, updatedBy: r.updated_by };
}
function cleanInvoice(b) {
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  const str = (v, n = 300) => String(v ?? "").slice(0, n);
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "");
  return {
    clientId: str(b.clientId, 80),
    issueDate: date(b.issueDate),
    dueDate: date(b.dueDate),
    billTo: { name: str(b.billTo?.name, 120), email: str(b.billTo?.email, 120), phone: str(b.billTo?.phone, 40), address: str(b.billTo?.address, 300) },
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 50).map((i) => ({ id: str(i.id, 20), desc: str(i.desc, 300), qty: num(i.qty), price: num(i.price) })),
    vat: !!b.vat,
    vatRate: num(b.vatRate ?? 16),
    discount: Math.max(0, num(b.discount)),
    notes: str(b.notes, 2000),
    receipts: (Array.isArray(b.receipts) ? b.receipts : []).slice(0, 50).map((p) => ({ id: str(p.id, 20), amount: num(p.amount), date: date(p.date), method: str(p.method, 40), ref: str(p.ref, 80) })),
    sentAt: str(b.sentAt, 30),
  };
}
