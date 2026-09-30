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
5. RLS je i dalje isključen na dijeljenim tablicama (recepti, tjedni plan,
   cjenik, cron) - `anon` ključ ima pun pristup njima, `service_role` ključ
   nije potreban. Korisničke tablice uvedene uz login (`profiles`,
   `user_stores`, `shopping_lists`, `shopping_list_items`) IMAJU RLS
   uključen (vidi `0003_auth_and_persistent_lists.sql`) - svaki korisnik
   vidi samo svoje retke.

## Prijava (Google login)

Auth ide preko Supabase Auth + Google OAuth provider. Da prijava stvarno
proradi na produkciji, treba (jednokratno, u Supabase i Google dashboardu -
kod ne treba dirati):

1. **Google Cloud Console** → OAuth consent screen + kreiraj OAuth 2.0 Client
   ID (tip "Web application"). Authorized redirect URI mora biti Supabaseov
   callback URL, format `https://<project-ref>.supabase.co/auth/v1/callback`
   (točan URL piše u Supabase dashboardu na koraku 2 ispod).
2. **Supabase dashboard → Authentication → Providers → Google** - upali
   provider, zalijepi Google Client ID i Client Secret iz koraka 1.
3. **Supabase dashboard → Authentication → URL Configuration** - dodaj
   produkcijski URL (`https://tjedni-planer.vercel.app`) i
   `http://localhost:3000` u "Redirect URLs" (inače `signInWithOAuth`
   preusmjerava na grešku nakon Google logina).
4. Env varijable za kod ostaju iste kao za bazu
   (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`) - Google
   client ID/secret žive isključivo u Supabase dashboardu, ne u ovom repou.
5. `NEXT_PUBLIC_AUTH_DISABLED=true` u `.env.local` zaobilazi login/onboarding
   redirect za lokalni dev dok gornji koraci nisu gotovi. NIKAD postaviti u
   Vercel Production varijablama.

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
- `src/app/tjedni-plan` - tab 2: odabir recepata po danu + trajan popis za
  kupovinu (Supabase, arhivira se u "Prijašnje liste" kad je sve označeno)
- `src/app/kosarica` - tab 3: usporedba cijena, filtrirano na trgovine koje
  je korisnik odabrao
- `src/app/login`, `src/app/onboarding`, `src/app/auth/callback` - prijava
  (Google OAuth) i prvi odabir trgovina
- `src/proxy.ts` - štiti rute iza logina, redirecta na `/onboarding` dok
  odabir trgovina nije spremljen (Next.js 16 "proxy" konvencija, bivši
  `middleware.ts`)
- `src/app/api/cron/{lidl,kaufland}` - dnevni dohvat i parsiranje cjenika
- `src/lib/price-fetch/` - parseri (Lidl CSV, Kaufland CSV) i upis u bazu
- `src/lib/matching.ts` - word-overlap matching sastojak → proizvod (+ "bez X"
  negacijski filtar) i izračun cijene
- `src/lib/supabase.ts` - dijeljeni Supabase klijent (anon ključ, bez
  sesije) za javne podatke (recepti, tjedni plan, cjenik)
- `src/lib/supabase/{server,client,middleware}.ts` - Supabase klijenti svjesni
  korisničke sesije (kolačići), za sve što je vezano uz prijavljenog
  korisnika
- `src/config/stores.ts` - konfiguracija poslovnice (Lidl/Kaufland scraping)
- `src/config/store-options.ts` - generički popis trgovina za onboarding
- `supabase/migrations/` - SQL migracije

## Van dosega za MVP (moguće buduće nadogradnje)

- Dodatne trgovine (Spar, Konzum, Studenac, Plodine...)
- Povijest cijena / grafovi trendova kroz vrijeme
- Slike recepata, upute za pripremu, broj porcija
- Filtriranje matchinga po kategoriji proizvoda
