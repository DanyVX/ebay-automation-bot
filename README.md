# eBay Automation Bot

A dashboard that automates the repetitive parts of running an eBay store:

- **Connect your eBay account** via official OAuth (eBay Sell API) — no scraping, no shared logins.
- **Sync listings** — pulls your live offers and current price/stock into a local cache.
- **Update price & stock** — edit a listing and push the change straight to eBay (single or scheduled via cron).
- **Product research** — search a product idea and see current eBay competition (active listing count, price range) to help decide what to source and list next.

Built with Next.js (App Router) + TypeScript + Supabase (auth & storage) + Tailwind CSS.

## Why this uses eBay's official APIs

eBay only permits automation through its Developer Program APIs (OAuth-authenticated Sell/Browse APIs). This project does **not** scrape ebay.com or automate a browser session — every listing/price/stock action goes through eBay's Sell Inventory API with a token the seller explicitly authorized. See `lib/ebay/` for the API client.

## Getting started

### 1. eBay Developer setup

1. Create an app at [developer.ebay.com](https://developer.ebay.com) → **My Account → Application Keys**.
2. Create a **Redirect URL (RuName)** under **User Tokens → Get a Token from eBay via Your Application** and set:
   - "Your auth accepted URL" to `https://<your-domain>/api/ebay/callback` (or `http://localhost:3000/api/ebay/callback` for local dev — eBay's sandbox environment supports plain `http://localhost`).
3. Note your **Client ID**, **Client Secret**, and the **RuName** value.

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` to create the tables and row-level-security policies.
3. Copy your Project URL, anon key, and service role key.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in the Supabase and eBay values (see comments in the file for what each one is).

### 4. Install & run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, then go to **Settings** to connect your eBay account.

## Scheduled sync

`POST /api/cron/sync` resyncs price & stock for every connected account. Point a scheduler (Vercel Cron, GitHub Actions, cron on any server) at it with an `Authorization: Bearer <CRON_SECRET>` header matching the `CRON_SECRET` env var. Example Vercel `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/sync", "schedule": "0 */6 * * *" }]
}
```

(Vercel Cron doesn't send custom headers, so either leave `CRON_SECRET` unset when deploying that way, or trigger the route from a scheduler that can send the header, such as a GitHub Actions workflow calling `curl` on a schedule.)

## Roadmap ideas

- Automatic repricing rules (e.g. match lowest competitor price within a margin floor).
- Low-stock email/Slack alerts.
- Bulk CSV import/export for listings.
- Sold-comp data via eBay's Marketplace Insights API (requires a separate, gated application).
- Multi-account / team support.

## Project structure

```
app/
  api/ebay/        OAuth connect/callback, sync, listing updates, research search
  api/cron/sync     scheduled resync endpoint
  dashboard/        overview, listings, research, settings pages
lib/ebay/           eBay OAuth + Inventory + Browse API client
lib/supabase/       Supabase client/server/middleware helpers
supabase/schema.sql  database schema + RLS policies
```
