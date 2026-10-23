# SpenceTec Client Desk: handoff

Paste this into a new chat along with the project folder (`spencetec-client-desk-react/`).

## Owner and company
- Owner: David (davidspec580@gmail.com), Nairobi, Kenya. Develops on Ubuntu, builds React/Vite sites for clients.
- Company name, always: **SpenceTec and Logistics Limited** (no "H", "and" not "&", "Limited" not "Ltd"). Footer/credit line: "Built by SpenceTec and Logistics Limited".

## What it is
A private client-management web app for SpenceTec's own clients: pipeline board (Enquiry, Design, Build, Review, Live, Maintenance), list view, client records (contact, domain, hosting, repo, Firebase, content received), tasks with deadlines, payments (KES, tick when paid), notes, search, summary counts, "Next up" panel.

## Versions built (in order)
1. **Claude artifact** (private page in the Claude app, uses Claude's own shared database). Seeded with 7 clients. Still exists; separate data from the others.
2. **Cloudflare Worker + KV + one shared password.** Superseded.
3. **Current: React + Vite + Cloudflare Worker + D1 (SQLite) + email-code login.** This is the folder `spencetec-client-desk-react/`.

## Current version: how it works
- `worker/index.js`: API and auth. `src/`: React app (App, Drawer, Team, Login, api.js, util.js, styles.css).
- D1 tables (`migrations/0001_init.sql`): `users` (email, name, role owner|member), `login_codes` (hashed, 10 min, 5 attempts, 45 s resend gap), `sessions` (hashed token, 30 days, HttpOnly cookie), `clients` (id, name, stage, data JSON, updated_at, updated_by).
- Login: user enters email, gets a 6-digit code by email (Resend API), enters it. Only emails in `users` can sign in; the request endpoint answers the same for unknown emails. Owner = `OWNER_EMAIL` var (davidspec580@gmail.com), auto-created on first request.
- Owner: Team screen (add or remove people; removal kills their sessions at once) and can delete clients. Members: view/edit clients, tasks, payments.
- Same-origin check on non-GET requests. Last write wins when two people edit one client. Page polls every 20 s.
- Seven seeded clients in `seed.sql`: Lilian Wanjiku Manegene (live, lilianmanegene.com), Betty Karimi (live), Annet Wanjiku Njiru (review, not deployed), Gachoki Gitari (build), Wangui Ngirici (review), Mary Muthoni Muriuki (design), SpenceTec and Logistics Limited (maintenance, spencetec.com). Contact and payment fields intentionally empty. Stages for Wangui, Mary, SpenceTec were guesses.

## Tested
In a local Worker run: unauthenticated 401, stranger gets no code, wrong code rejected, owner login, add member, member login, stage patch records updated_by, member blocked from /api/users and client delete, removed member's session dies, React build passes. NOT tested: the screens in a browser, real email sending, a deployed Worker.

## Setup status (from the user's terminal)
- User created the D1 database `spencetec-client-desk`, id `c7f9d54f-87b4-4917-8d28-d965659956f3`.
- Problem seen: wrangler added a second binding `spencetec_client_desk` and the original `DB` binding kept `PASTE_D1_DATABASE_ID_HERE`, so `db:remote` failed. Fix given: replace `wrangler.jsonc` with a single `DB` binding using the real id.
- Problem seen: "Server not configured (AUTH_SECRET missing)". Fix given: create `.dev.vars` with `AUTH_SECRET=...` and `DEV_SHOW_CODE=1` for local use (code prints in terminal); for deploy use `wrangler secret put AUTH_SECRET` and `RESEND_API_KEY`.
- Not yet confirmed by the user: `npm run db:remote`, `npm run seed:remote`, local `db:local`/`seed:local`, deploy.
- Still to do: Resend account with a verified domain, set `MAIL_FROM` (placeholder `desk@YOUR-VERIFIED-DOMAIN.com`), set secrets, `npm run deploy`, optional custom domain such as desk.spencetec.com.

## Next steps worth doing
- Confirm the setup steps above and open the deployed site.
- Sort out email sending (or switch provider if the user prefers).
- Add real client contacts and payments.
- Possibly: audit trail, file uploads, client-facing status page.

## Other open items from the same session (not part of the desk)
- Lilian SPA revamp is on branch `revamp-new-design` in SpenceTech-And-Logistics/lilian-spa; must be merged to main for Cloudflare to show it.
- Senior-official MPA design canvas: 8 boards unwritten (Project detail, Positions, Awards, News, Article, Events, Gallery, Contact).
- Some older site footers still say "SpenceTecH & Logistics Ltd".
- Promo video: `SpenceTec-what-we-do-slow.mp4` (67 s, logo watermark) is the latest.

## v3 redesign (23 Oct 2026)
- Front end rebuilt as a multi-page app: Overview, Clients (board/list), client page, Tasks, Payments, Team. Sidebar on desktop, bottom tab bar on phones.
- New files: `src/router.jsx` (small history router), `src/desk.jsx` (shared data and optimistic saves), `src/ui.jsx`, `src/pages/*`. Removed `Drawer.jsx` and the old `Team.jsx`.
- Worker, schema and seed are unchanged. `wrangler.jsonc` now has the real D1 id.
- Tested locally with wrangler dev + local D1: login by code, every page at desktop and phone widths, quick search, adding tasks and payments. Not tested yet: deployed Worker, real email.

## v4: roles, invoices, sales rep pages (23 Oct 2026)
- Roles are now owner / secretary / sales (migration `0002_roles_invoices_files.sql`; old members become secretaries). The Worker enforces them.
- Sales reps: home page "My clients", "Register a client" (details, contacts, project, budget, about, links, up to 12 photos, optional CV). Only their own clients; no money, tasks or stage changes.
- Secretary and owner: invoices (numbered, VAT, discount, payments received, print/PDF, email draft), project fields (package, quote, budget, start, launch deadline, sales rep, project lead), task assignees with "Mine" filter, sortable client list with rep filter, photos/CV/documents on every client, WhatsApp button.
- Owner: Team page with role dropdowns, Settings page (company details, KRA PIN, how to pay, invoice prefix, VAT rate).
- New tables: invoices, files (BLOBs in D1), settings. Files capped at 1.9 MB.
- Tested locally (wrangler dev + local D1) with all three roles: 20 permission checks pass; migration tested on a v3 database with a member user.
- To deploy: `npm run db:remote` then `npm run deploy`.
