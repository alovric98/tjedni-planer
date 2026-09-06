# Tjedni planer ručkova

Osobna web aplikacija za planiranje ručkova za tjedan dana, s automatskim
generiranjem popisa za kupovinu i usporedbom procijenjenog troška u Lidlu i
Kauflandu na temelju njihovih službeno objavljenih dnevnih cjenika.

Stack: Next.js (App Router) na Vercelu, Supabase (Postgres) za bazu, Vercel
Cron za dnevni dohvat cijena. Sve u besplatnim planovima.

Trenutni status: **Faza 4 gotova** - Recepti (CRUD), Tjedni plan (odabir
recepta po danu + popis za kupovinu) i Košarica (usporedba cijena Lidl vs
Kaufland za poslovnicu Slavonski Brod) rade. Cron dohvat cijena je spreman za
Vercel, ali dok se ne postavi service_role/CRON_SECRET na produkciji i ne
prođe barem jedan uspješan dnevni dohvat, `products` tablica je prazna dok se
ručno ne pokrene.

Live: https://tjedni-planer.vercel.app

## Pokretanje lokalno

```bash
npm install
npm run dev
```

Otvori [http://localhost:3000](http://localhost:3000).

## Povezivanje sa Supabaseom

1. Napravi besplatan projekt na [supabase.com](https://supabase.com/dashboard).
2. U Supabase dashboardu: **Project Settings → API** - odatle uzmi `Project URL`
   i `anon public` ključ.
3. Kopiraj `.env.example` u `.env.local` i popuni:
   ```bash
   cp .env.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   CRON_SECRET=...   # npr. `openssl rand -hex 32`
   ```
4. Pokreni SQL migracije iz `supabase/migrations/` redom (`0001_init.sql`,
   `0002_drop_products_unique.sql`) u Supabase dashboardu (**SQL Editor** →
   zalijepi sadržaj fajla → Run), ili preko Supabase CLI-ja (`supabase db
   push`) ako imaš povezan projekt.
5. RLS je namjerno isključen (aplikacija nema login) - `anon` ključ ima pun
   pristup bazi, uključujući i cron rute, pa `service_role` ključ nije
   potreban.

Napomena o besplatnom planu: Supabase projekt na besplatnom planu se pauzira
nakon dužeg perioda potpune neaktivnosti. Dnevni cron bi to trebao
sprječavati, ali ako se nakon duže pauze u korištenju nešto čudno dogodi s
podacima, prvo provjeri je li projekt pauziran.

## Deploy na Vercel

1. Poveži repozitorij s Vercelom (Import Project na [vercel.com](https://vercel.com/new))
   ili koristi `npx vercel` iz ovog foldera.
2. U Vercel projektu pod **Settings → Environment Variables** dodaj iste
   varijable kao u `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`).
3. `vercel.json` već sadrži cron konfiguraciju - `/api/cron/lidl` i
   `/api/cron/kaufland` se pozivaju jednom dnevno (u skladu s limitom Vercel
   Hobby plana od najviše 1x dnevno po jobu), s `maxDuration: 60`. Vercel
   automatski šalje `Authorization: Bearer <CRON_SECRET>` pri pozivu.
4. Za ručno pokretanje dohvata (npr. prvi put, ili test): `curl -H
   "Authorization: Bearer <CRON_SECRET>"
   https://tjedni-planer.vercel.app/api/cron/kaufland` (isto za `/lidl`).

## Poslovnica

MVP koristi **Slavonski Brod** za oba lanca (konfigurirano u
`src/config/stores.ts`) - promijeni konstante ondje za drugu poslovnicu.

## Matching sastojak → proizvod (napomene)

- Fuzzy pretraga (`fuse.js`) uz prednost cijeloj riječi i kraćem, doslovnijem
  nazivu proizvoda - i dalje nije savršeno (npr. "riža" može pogoditi
  aromatiziranu varijantu umjesto najosnovnije).
- Cijena po jedinici mjere (kg/l/kom) se čita izravno iz cjenika kad je
  dostupna; kad nije, ili kad se jedinica sastojka i proizvoda ne mogu uskladiti
  (npr. sastojak u komadima, a proizvod se cijenom vodi po kg), Košarica
  prikazuje cijenu cijelog pakiranja kao procjenu i to označava s "~".
- Ako za sastojak nema pouzdanog poklapanja, jasno piše "nije pronađeno"
  umjesto pogrešnog izračuna.

## Struktura projekta

- `src/app/recepti` - tab 1: CRUD recepata
- `src/app/tjedni-plan` - tab 2: odabir recepata po danu + generiranje popisa
- `src/app/kosarica` - tab 3: usporedba cijena Lidl vs Kaufland
- `src/app/api/cron/{lidl,kaufland}` - dnevni dohvat i parsiranje cjenika
- `src/lib/price-fetch/` - parseri (Lidl ZIP+CSV, Kaufland CSV) i upis u bazu
- `src/lib/matching.ts` - fuzzy matching sastojak → proizvod + izračun cijene
- `src/lib/supabase.ts` - Supabase klijent (anon ključ, koristi se svugdje
  jer je RLS isključen)
- `src/config/stores.ts` - konfiguracija poslovnice
- `supabase/migrations/` - SQL migracije

## Van dosega za MVP (moguće buduće nadogradnje)

- Dodatne trgovine (Spar, Konzum, Studenac, Plodine...)
- Povijest cijena / grafovi trendova kroz vrijeme
- Slike recepata, upute za pripremu, broj porcija
- Filtriranje matchinga po kategoriji proizvoda
