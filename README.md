# Tjedni planer ručkova

Osobna web aplikacija za planiranje ručkova za tjedan dana, s automatskim
generiranjem popisa za kupovinu i usporedbom procijenjenog troška u Lidlu i
Kauflandu na temelju njihovih službeno objavljenih dnevnih cjenika.

Stack: Next.js (App Router) na Vercelu, Supabase (Postgres) za bazu, Vercel
Cron za dnevni dohvat cijena. Sve u besplatnim planovima.

Trenutni status: **Faza 1 (setup)** - prazan skeleton s tri taba, bez stvarne
funkcionalnosti. Recepti, tjedni plan, dohvat cijena i košarica dolaze u
sljedećim fazama.

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
   ```
4. Pokreni SQL migraciju iz `supabase/migrations/0001_init.sql` u Supabase
   dashboardu (**SQL Editor** → zalijepi sadržaj fajla → Run), ili preko
   Supabase CLI-ja (`supabase db push`) ako imaš povezan projekt.
5. `SUPABASE_SERVICE_ROLE_KEY` (isto u **Project Settings → API**) treba tek od
   Faze 4 (cron dohvat cijena, piše u bazu mimo RLS-a) - može ostati prazan
   dotad.

Napomena o besplatnom planu: Supabase projekt na besplatnom planu se pauzira
nakon dužeg perioda potpune neaktivnosti. Dnevni cron (Faza 4) bi to trebao
sprječavati, ali ako se nakon duže pauze u korištenju nešto čudno dogodi s
podacima, prvo provjeri je li projekt pauziran.

## Deploy na Vercel

1. Poveži repozitorij s Vercelom (Import Project na [vercel.com](https://vercel.com/new))
   ili koristi `npx vercel` iz ovog foldera.
2. U Vercel projektu pod **Settings → Environment Variables** dodaj iste
   varijable kao u `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. `vercel.json` već sadrži cron konfiguraciju (jednom dnevno, u skladu s
   limitom Vercel Hobby plana od najviše 1x dnevno po jobu) - te rute
   (`/api/cron/lidl`, `/api/cron/kaufland`) dolaze u Fazi 4. Dok ne postoje,
   deploy će proći, a cron pozivi će samo vraćati 404 do tada.

## Struktura projekta

- `src/app/recepti` - tab 1: CRUD recepata
- `src/app/tjedni-plan` - tab 2: odabir recepata po danu + generiranje popisa
- `src/app/kosarica` - tab 3: usporedba cijena Lidl vs Kaufland
- `src/lib/supabase.ts` - Supabase klijent (browser/anon ključ)
- `supabase/migrations/` - SQL migracije

## Van dosega za MVP (moguće buduće nadogradnje)

- Dodatne trgovine (Spar, Konzum, Studenac, Plodine...)
- Povijest cijena / grafovi trendova kroz vrijeme
- Slike recepata, upute za pripremu, broj porcija
