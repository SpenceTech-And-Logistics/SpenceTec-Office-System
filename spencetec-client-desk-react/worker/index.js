// SpenceTec Client Desk API. Cloudflare Worker + D1.
// Email-code login for people the owner has added. Sessions are HttpOnly cookies.

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

async function sessionUser(request, env) {
  const t = cookie(request, "sid");
  if (!t) return null;
  const row = await env.DB.prepare("SELECT email,expires_at FROM sessions WHERE token_hash=?")
    .bind(await sha256(t)).first();
  if (!row || row.expires_at < now()) return null;
  return getUser(env, row.email); // null if the owner has since removed them
}

async function sendCode(env, email, code) {
  if (env.DEV_SHOW_CODE === "1") console.log(`[DEV] login code for ${email}: ${code}`);
  if (!env.RESEND_API_KEY) return env.DEV_SHOW_CODE === "1";
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
  return r.ok;
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
          if (!prev || now() - prev.created_at >= 45) {
            const code = randomCode();
            await env.DB.prepare(
              "INSERT INTO login_codes (email,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,0,?) " +
              "ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at"
            ).bind(email, await sha256(`${email}:${code}:${env.AUTH_SECRET}`), now() + CODE_MINUTES * 60, now()).run();
            await sendCode(env, email, code);
          }
        }
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
          env.DB.prepare("INSERT INTO sessions (token_hash,email,expires_at) VALUES (?,?,?)")
            .bind(await sha256(token), email, now() + SESSION_DAYS * 86400),
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
      const me = await sessionUser(request, env);
      if (path === "/api/me" && method === "GET") return me ? json({ user: me }) : fail(401, "Not signed in");
      if (!me) return fail(401, "Not signed in");
      const isOwner = me.role === "owner";

      /* ---------- team (owner only) ---------- */
      if (path === "/api/users") {
        if (!isOwner) return fail(403, "Owner only");
        if (method === "GET") {
          const { results } = await env.DB.prepare("SELECT email,name,role,created_at FROM users ORDER BY role DESC, email").all();
          return json(results);
        }
        if (method === "POST") {
          const b = await request.json().catch(() => ({}));
          const email = normEmail(b.email);
          if (!validEmail(email)) return fail(400, "Enter a valid email address");
          const name = String(b.name || "").trim().slice(0, 80);
          await env.DB.prepare("INSERT INTO users (email,name,role) VALUES (?,?, 'member') ON CONFLICT(email) DO UPDATE SET name=excluded.name WHERE users.role='member'")
            .bind(email, name).run();
          return json({ ok: true });
        }
      }
      const um = path.match(/^\/api\/users\/([^/]+)$/);
      if (um && method === "DELETE") {
        if (!isOwner) return fail(403, "Owner only");
        const email = normEmail(decodeURIComponent(um[1]));
        const u = await getUser(env, email);
        if (!u) return json({ ok: true });
        if (u.role === "owner") return fail(400, "The owner can't be removed");
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE email=?").bind(email),
          env.DB.prepare("DELETE FROM login_codes WHERE email=?").bind(email),
          env.DB.prepare("DELETE FROM users WHERE email=?").bind(email),
        ]);
        return json({ ok: true });
      }

      /* ---------- clients ---------- */
      if (path === "/api/clients" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM clients ORDER BY name COLLATE NOCASE").all();
        return json(results.map(rowToClient));
      }
      const cm = path.match(/^\/api\/clients\/([^/]+)$/);
      if (cm) {
        const id = decodeURIComponent(cm[1]);
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail(400, "Bad id");
        if (method === "DELETE") {
          if (!isOwner) return fail(403, "Only the owner can delete a client");
          await env.DB.prepare("DELETE FROM clients WHERE id=?").bind(id).run();
          return json({ ok: true });
        }
        if (method === "PUT" || method === "PATCH") {
          const text = await request.text();
          if (text.length > 100000) return fail(413, "Too large");
          let body;
          try { body = JSON.parse(text); } catch { return fail(400, "Bad JSON"); }
          if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Bad body");
          for (const k of ["id", "updated", "updatedBy"]) delete body[k];
          let cur = {};
          if (method === "PATCH") {
            const r = await env.DB.prepare("SELECT data FROM clients WHERE id=?").bind(id).first();
            if (!r) return fail(404, "Client not found");
            cur = JSON.parse(r.data);
          }
          const next = { ...cur, ...body };
          if (!next.name || !String(next.name).trim()) return fail(400, "Name is required");
          if (!STAGES.includes(next.stage)) return fail(400, "Bad stage");
          await env.DB.prepare(
            "INSERT INTO clients (id,name,stage,data,updated_at,updated_by) VALUES (?,?,?,?,datetime('now'),?) " +
            "ON CONFLICT(id) DO UPDATE SET name=excluded.name,stage=excluded.stage,data=excluded.data,updated_at=excluded.updated_at,updated_by=excluded.updated_by"
          ).bind(id, String(next.name).trim(), next.stage, JSON.stringify(next), me.email).run();
          return json({ ok: true });
        }
      }
      return fail(404, "Not found");
    } catch (e) {
      console.error(e);
      return fail(500, "Something went wrong");
    }
  },
};
