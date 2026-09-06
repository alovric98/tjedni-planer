-- Inicijalna shema za "Tjedni planer ručkova".
-- Pokreni ovo u Supabase SQL editoru (ili preko Supabase CLI-ja) na novom projektu.

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  name text not null,
  quantity numeric not null,
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'kom'))
);

-- Jedan globalni tjedni plan (bez logina/više korisnika) - 7 redaka, po jedan po danu.
create table if not exists weekly_plan_days (
  day_of_week smallint primary key check (day_of_week between 1 and 7), -- 1 = pon ... 7 = ned
  recipe_id uuid references recipes(id) on delete set null
);

insert into weekly_plan_days (day_of_week)
select d from generate_series(1, 7) as d
on conflict (day_of_week) do nothing;

-- Dnevni cache cjenika - prepisuje se (upsert) svaki dan po trgovini preko crona.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store text not null check (store in ('lidl', 'kaufland')),
  code text,
  barcode text,
  name text not null,
  brand text,
  net_quantity numeric,
  unit text,
  price numeric not null,
  unit_price numeric,
  category text,
  updated_at timestamptz not null default now(),
  unique (store, code, barcode)
);

create index if not exists products_store_name_idx on products (store, name);

-- Log dohvata cijena - za prikaz "zadnje uspješno osvježeno" i praćenje grešaka.
create table if not exists price_fetch_log (
  id uuid primary key default gen_random_uuid(),
  store text not null check (store in ('lidl', 'kaufland')),
  status text not null check (status in ('success', 'error')),
  product_count int,
  error_message text,
  fetched_at timestamptz not null default now()
);
