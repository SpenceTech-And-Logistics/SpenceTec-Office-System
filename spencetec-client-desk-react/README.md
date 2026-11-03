# SpenceTec Client Desk (React + Cloudflare Worker + D1)

React app served by one Cloudflare Worker. Data lives in a **D1 database** (SQLite). Sign-in is by **email code** (6 digits, 10 minutes) and only for people the owner adds in the Team screen.

Tables: `users`, `login_codes`, `sessions`, `clients`, `invoices`, `files`, `settings` (see `migrations/`).

## Roles (v4)
| Role | Can do |
|---|---|
| **Owner** | Everything. Team and roles, company settings, deleting clients and any invoice. |
| **Secretary** | All clients and project details, tasks (with assignees), invoices and payments, photos and files. Adds clients. Can delete draft invoices only. |
| **Sales rep** | Registers clients with photos (up to 12), an optional CV, documents and social/other links. Sees and edits only their own clients; never sees money, tasks or office notes; can't change the stage. |

Permissions are enforced in the Worker, not just hidden in the page. Existing v3 "members" become secretaries when you run the migration.

## Invoice template (v4.4)
Invoices now match SpenceTec's own design: the logo across the top, a Bill from / Bill to panel, a navy line table, a fee / deposit / balance summary, payment details, payment terms and a closing line.
- **Start from** a template when creating an invoice: Web portfolio page, Multi-page website, Monthly updates only, or Blank.
- **Monthly** lines (e.g. website updates) show as "/mo" but aren't added to the total.
- **Deposit %** splits the total into "Deposit payable" and "Balance on completion" (default 75/25).
- Numbering continues from your Word invoices: INV-006, INV-007… (Settings → Invoice template).
- Payment details, default terms (with {deposit}/{balance}) and the closing line are set in Settings.
- The logo lives at `public/invoice-logo.png`; replace that file to change it.
- Migration `0006_invoice_template.sql` fills in your company and payment details only where they were empty.

## Online status and activity log (v4.3)
- **Team** shows a dot for each person: green *Online now* (active in the last 3 minutes), amber *Idle* (signed in but quiet), grey *Offline · last active …*. Background refreshes don't count as activity; mouse, keys and scrolling do.
- **Activity** (owner only, in the sidebar) lists who did what: sign-ins and sign-outs, time-outs, lockouts, clients added and edited, stage moves, tasks, payments, invoices, files, team and settings changes. Filter by type or person. Kept for 180 days.
- Pick a person on Activity to see their status and devices, and **Sign out everywhere** if needed.
- Each client page has a **History** card (owner and secretary). The Overview shows **Team now** for the owner.
- Migration `0005_activity.sql`.

## Sales rep usernames (v4.2)
Sales reps don't need an email address. On **Team**, choose role *Sales rep* → *Username and password*, type their name (a username is suggested) and click **Create login**. You get a temporary password to send them (Copy or WhatsApp buttons); it's shown only once. On first sign-in ("Sales rep username" on the sign-in screen) they must choose their own password (8+ characters). Forgotten password: **Reset password** on Team gives a new temporary one and signs them out everywhere. Five wrong passwords lock the account for 15 minutes. Passwords are stored as PBKDF2 hashes; nobody can read them. Username accounts can only ever be sales reps.

## Sign-in timeouts (v4.1)
Secretaries and sales reps are signed out after **30 minutes without activity** and after **8 hours** at most, whichever comes first. They get a two-minute "Are you still there?" warning first, and the sign-in screen says why they were signed out. The owner can change both limits in **Settings → Sign-in security**; the owner's own sign-in isn't affected. The Worker enforces this (background refreshes don't count as activity), so closing the tab doesn't keep a session alive.

## Invoices (v4)
Billing → New invoice (or "New invoice" on a client's page). Numbers run automatically (prefix set in Settings, default `SPT-0001`). Lines, discount, optional VAT, notes. Mark as sent, record payments (M-Pesa, bank, cash, with reference), and the invoice shows Part paid / Paid / Overdue by itself. "Print or save PDF" prints just the invoice. Set your company details, KRA PIN and how-to-pay text under **Settings** (owner).

## Files
Photos, CVs and documents are stored in D1 (max 1.9 MB each; photos are resized in the browser first). For heavy use later, these can move to Cloudflare R2.

## Pages (v3 redesign)
- **Overview** (`/`): summary tiles, tasks that are overdue or due this week, clients you're still waiting on for content, pipeline, money owed, recently changed.
- **Clients** (`/clients`): board or list. Drag a card to another column to change its stage. In the list, change the stage from the dropdown. The stage chips filter the list (`/clients?stage=live`).
- **Client page** (`/clients/<id>`): click a stage to move the client. Also on this page: tasks, payments, details (click Edit), content status, notes, and quick buttons to visit the site, open the repo, email or call.
- **Tasks** (`/tasks`): every task across all clients, grouped Overdue / Today / Next 7 days / Later / No date. Add a task for any client from here.
- **Payments** (`/payments`): all invoices with Invoiced / Received / Outstanding totals. Click "Pending" to mark a payment as paid.
- **Team** (`/team`, owner only).

Shortcuts: `/` to find a client, `N` for a new client, `Esc` to close. On phones, a bottom tab bar replaces the sidebar.
No backend changes: the Worker API and database are the same as v2.

## 1. Install (Ubuntu)
```bash
sudo apt update && sudo apt install -y nodejs npm     # Node 20+ recommended (use nvm if older)
cd spencetec-client-desk
npm install
npx wrangler login
```

## 2. Create the database
```bash
npx wrangler d1 create spencetec-client-desk
```
Copy the `database_id` it prints into `wrangler.jsonc` (already set to `c7f9d54f-87b4-4917-8d28-d965659956f3`). Keep a single binding named `DB`.

```bash
npm run db:remote       # creates or updates the tables (applies any new migrations)
npm run seed:remote     # loads the 7 starting clients (run once)
```

## 3. Email sending (Resend)
Codes are emailed through Resend (resend.com, free tier is enough).
1. Create an account, add and verify your domain (e.g. spencetec.com), create an API key.
2. In `wrangler.jsonc` set `MAIL_FROM`, e.g. `"SpenceTec Client Desk <desk@spencetec.com>"`.
3. Set `OWNER_EMAIL` in `wrangler.jsonc` to the owner's address (already set to davidspec580@gmail.com).

## 4. Secrets and deploy
```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put AUTH_SECRET      # any long random string, e.g. output of: openssl rand -hex 32
npm run deploy
```
Open the `workers.dev` URL, enter the owner email, type the code you receive. Use **Team** to add people; they sign in the same way. Removing someone signs them out immediately.

## Roles
- **Owner**: everything, plus Team and deleting clients.
- **Member**: view and edit clients, tasks and payments.

## Local test (no email needed)
```bash
cp .dev.vars.example .dev.vars          # set OWNER_EMAIL to your address
npm run db:local && npm run seed:local
npm run dev                             # codes are printed in the terminal
```

## Notes
- Two people editing the same client at the same moment: last save wins.
- The page refreshes data every 20 seconds.
- Don't re-run the seed after editing; it only adds missing clients (won't overwrite), but is not needed again.
- Custom domain: Workers & Pages → spencetec-client-desk → Settings → Domains.
- Built by SpenceTec and Logistics Limited.
