-- eBay Automation Bot schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- One row per user who has connected an eBay seller account via OAuth.
create table if not exists ebay_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ebay_user_id text,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, environment)
);

-- Cached snapshot of each seller's live eBay listings (offers), refreshed by
-- the sync job. This is what the dashboard reads/writes for price & stock.
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ebay_account_id uuid not null references ebay_accounts (id) on delete cascade,
  sku text not null,
  offer_id text,
  listing_id text,
  title text,
  price numeric(12, 2),
  currency text default 'USD',
  quantity integer,
  quantity_sold integer default 0,
  status text,
  listing_url text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (ebay_account_id, sku)
);

-- Every price/quantity change we push to eBay, for audit + undo.
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  old_quantity integer,
  new_quantity integer,
  reason text,
  created_at timestamptz not null default now()
);

-- Saved results from the product-research tool (candidate items to source
-- and list, based on sold-comp / demand signals pulled from eBay).
create table if not exists research_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  title text not null,
  category text,
  avg_sold_price numeric(12, 2),
  min_sold_price numeric(12, 2),
  max_sold_price numeric(12, 2),
  sold_count_90d integer,
  active_listing_count integer,
  sell_through_rate numeric(6, 4),
  ebay_item_id text,
  image_url text,
  item_url text,
  saved boolean not null default false,
  created_at timestamptz not null default now()
);

-- One repricing rule per listing: watches a competitor search term and
-- keeps the listing's price at/under it within a margin-safe range.
create table if not exists repricing_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references listings (id) on delete cascade,
  competitor_query text not null,
  strategy text not null check (strategy in ('match_lowest', 'undercut_lowest')),
  undercut_amount numeric(12, 2),
  undercut_percent numeric(6, 4),
  floor_price numeric(12, 2) not null,
  ceiling_price numeric(12, 2),
  enabled boolean not null default true,
  last_applied_price numeric(12, 2),
  last_applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id)
);

-- Row Level Security: every table is scoped to the owning user.
alter table ebay_accounts enable row level security;
alter table listings enable row level security;
alter table price_history enable row level security;
alter table research_items enable row level security;
alter table repricing_rules enable row level security;

create policy "Users manage their own ebay_accounts" on ebay_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own listings" on listings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own price_history" on price_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own research_items" on research_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own repricing_rules" on repricing_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists listings_user_id_idx on listings (user_id);
create index if not exists listings_ebay_account_id_idx on listings (ebay_account_id);
create index if not exists research_items_user_id_idx on research_items (user_id);
create index if not exists repricing_rules_user_id_idx on repricing_rules (user_id);
