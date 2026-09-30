-- Auth-vezane tablice: profili, odabir trgovina po korisniku, i trajni
-- popisi za kupovinu (zamjena za localStorage stanje kvačica).
-- Postojeće tablice (recipes, weekly_plan_days, products, price_fetch_log)
-- ostaju dijeljene/globalne - namjerno bez RLS-a, nisu vezane uz korisnika.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Korisnik vidi/uređuje samo svoj profil"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Automatski kreira redak u profiles pri registraciji (Google OAuth i sl.) -
-- bez ovoga bi svaki novi korisnik trebao ručni insert prije prvog upita.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Generički odabir trgovina po korisniku - nove trgovine (Tommy, Studenac,
-- Konzum) se dodaju kao novi store_key bez promjene sheme ili logike
-- filtriranja u Košarici.
create table if not exists user_stores (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_key text not null check (store_key in ('lidl', 'kaufland', 'tommy', 'studenac', 'konzum')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, store_key)
);

alter table user_stores enable row level security;

create policy "Korisnik vidi/uređuje samo svoj odabir trgovina"
  on user_stores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trajni popisi za kupovinu. "active" je popis vidljiv na Tjednom planu,
-- "archived" pada u "Prijašnje liste" tek kad su SVE stavke označene.
-- Partial unique index ispod osigurava točno jedan aktivan popis po
-- korisniku u bilo kojem trenutku.
create table if not exists shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists shopping_lists_one_active_per_user
  on shopping_lists (user_id)
  where status = 'active';

create index if not exists shopping_lists_user_archived_idx
  on shopping_lists (user_id, archived_at desc)
  where status = 'archived';

alter table shopping_lists enable row level security;

create policy "Korisnik vidi/uređuje samo svoje popise"
  on shopping_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  item_key text not null,
  name text not null,
  quantity numeric not null,
  unit text not null,
  checked boolean not null default false,
  checked_at timestamptz,
  unique (list_id, item_key)
);

alter table shopping_list_items enable row level security;

-- Nema izravnog user_id stupca na stavkama - vlasništvo se provjerava kroz
-- roditeljski shopping_lists redak (ista tehnika kao recipe_ingredients ->
-- recipes u 0001_init.sql, samo uz auth.uid() provjeru na kraju lanca).
create policy "Korisnik vidi/uređuje samo stavke svojih popisa"
  on shopping_list_items for all
  using (exists (select 1 from shopping_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from shopping_lists l where l.id = list_id and l.user_id = auth.uid()));
