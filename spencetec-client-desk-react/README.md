# SpenceTec Client Desk (React + Cloudflare Worker + D1)

React app served by one Cloudflare Worker. Data lives in a **D1 database** (SQLite). Sign-in is by **email code** (6 digits, 10 minutes) and only for people the owner adds in the Team screen.

Tables: `users`, `login_codes`, `sessions`, `clients` (see `migrations/0001_init.sql`).

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
Copy the `database_id` it prints into `wrangler.jsonc`.

```bash
npm run db:remote       # creates the tables
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
