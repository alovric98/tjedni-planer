-- P0 fix: recipes / weekly_plan_days / recipe_ingredients dosad nisu imali
-- user_id ni RLS (namjerno tako u 0001_init.sql, dok je postojao jedan
-- korisnik). Sad kad se drugi stvaran korisnik prijavio Google loginom,
-- vidio je Antoniove recepte i tjedni plan jer baza nije razlikovala
-- vlasnika. shopping_lists/shopping_list_items već su izolirani (0003) -
-- ne diraju se ovdje. products/price_fetch_log ostaju globalni katalog
-- cijena trgovina - ne diraju se ovdje.

-- 1) recipes: dodaj vlasnika --------------------------------------------
alter table recipes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) weekly_plan_days: dodaj vlasnika. Dosad je day_of_week bio primarni
--    ključ (jedan globalni redak po danu, 1-7) - sad svaki korisnik treba
--    svojih 7 redaka, pa dobiva vlastiti id i (user_id, day_of_week)
--    postaje jedinstvena kombinacija.
alter table weekly_plan_days drop constraint if exists weekly_plan_days_pkey;
alter table weekly_plan_days add column if not exists id uuid not null default gen_random_uuid();
alter table weekly_plan_days add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table weekly_plan_days add primary key (id);
create unique index if not exists weekly_plan_days_user_day_idx
  on weekly_plan_days (user_id, day_of_week);

-- 3) Backfill: ako u trenutku pokretanja ove migracije postoji TOČNO
--    jedan korisnik (auth.users), svi postojeći retci (nastali prije
--    login sustava) se vežu na njega. Ako ih je više, retci ostaju
--    user_id = NULL - RLS ispod ih čini nevidljivima dok se ručno ne
--    backfilla (vidi napomenu na dnu ove datoteke).
do $$
declare
  target_user_id uuid;
  user_count int;
begin
  select count(*) into user_count from auth.users;

  if user_count = 1 then
    select id into target_user_id from auth.users limit 1;
    update recipes set user_id = target_user_id where user_id is null;
    update weekly_plan_days set user_id = target_user_id where user_id is null;
  end if;
end $$;

-- 4) RLS -----------------------------------------------------------------
alter table recipes enable row level security;

create policy "Korisnik vidi/uređuje samo svoje recepte"
  on recipes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table weekly_plan_days enable row level security;

create policy "Korisnik vidi/uređuje samo svoj tjedni plan"
  on weekly_plan_days for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- recipe_ingredients nema vlastiti user_id - vlasništvo se provjerava kroz
-- roditeljski recipes redak (ista tehnika kao shopping_list_items ->
-- shopping_lists u 0003_auth_and_persistent_lists.sql).
alter table recipe_ingredients enable row level security;

create policy "Korisnik vidi/uređuje samo sastojke svojih recepata"
  on recipe_ingredients for all
  using (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- ⚠️ RUČNI KORAK ako se ova migracija pokreće dok već postoji VIŠE od
-- jednog korisnika (trenutno stanje, 30.9.2026. - drugi korisnik se već
-- prijavio): automatski backfill iznad se NIJE pokrenuo, pa su svi
-- postojeći recepti/tjedni plan bez user_id, i RLS ih čini nevidljivima
-- dok se ručno ne dodijele tebi. Nađi svoj user id (Supabase dashboard ->
-- Authentication -> Users) i pokreni ručno, PRIJE nego što ikome najaviš
-- da je popravljeno:
--
--   update recipes set user_id = '<TVOJ-USER-ID>' where user_id is null;
--   update weekly_plan_days set user_id = '<TVOJ-USER-ID>' where user_id is null;
