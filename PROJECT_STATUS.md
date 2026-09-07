# Status projekta: Tjedni planer ručkova

Ovaj file postoji da nova Claude Code sesija (novi chat) može nastaviti bez
gubljenja konteksta. Automatski se učitava preko `CLAUDE.md` (@import).

**Pravilo za novu sesiju:** pročitaj ovaj file + `git log --oneline -20`, pa
pitaj korisnika što je sljedeće umjesto pretpostavljanja stanja (npr. tjedni
plan se mijenja kroz UI izvan ove konverzacije, ne pretpostavljaj trenutni
odabir dana).

## Trenutno stanje

MVP je funkcionalno kompletan i live. Sve četiri planirane faze (vidi
`~/.claude/plans/tranquil-sleeping-chipmunk.md` za detaljan plan i Faza 0
istraživanje formata cjenika) su gotove, plus dodatni polish krug (vizualni
redizajn, performance fix, bugfixevi iz korisnikovog testiranja na
mobitelu).

## Live / pristup

- App: https://tjedni-planer.vercel.app
- GitHub: https://github.com/alovric98/tjedni-planer (grana `main`,
  auto-deploy na Vercel pri svakom pushu)
- Vercel projekt: `alovric98s-projects/tjedni-planer`
- Supabase projekt: `oqwzeggdfbdlsexbaljw` (Frankfurt regija)

## Arhitektura (kratko - detalji u README.md)

- Next.js 16 (App Router, TypeScript, Tailwind v4) na Vercelu, Supabase
  Postgres za bazu
- RLS namjerno isključen (nema logina - anon key ima pun pristup, uključujući
  cron rute; odluka iz Faze 1, dokumentirano korisniku)
- Vercel Cron (`vercel.json`) - `/api/cron/lidl` i `/api/cron/kaufland`,
  jednom dnevno u 9h, zaštićeno `CRON_SECRET` Bearer headerom
- Reprezentativna poslovnica: **Slavonski Brod** za oba lanca
  (`src/config/stores.ts` - promijeni ondje za drugu poslovnicu)

## Ključne tehničke odluke (bitno prije diranja koda)

1. **Matching (`src/lib/matching.ts`) NIJE fuse.js** - uklonjen kao ovisnost
   jer je bitap fuzzy matching sustavno loše radio (red riječi, kratke
   riječi pogađaju krivo). Zamijenjen vlastitim word-overlap scorerom: svaka
   riječ upita nosi bod (2 = cijela riječ, 1 = prefiks/korijen), **glavna
   imenica (zadnja riječ upita) mora imati stvarnu vezu** (sprječava npr.
   "mljevena junetina" da pogodi "mljevena kava"), zagrade u nazivu sastojka
   ("(konzerva)", "(light)") se ignoriraju za matching (opisne napomene, ne
   dio naziva proizvoda).
2. **Cijena u Košarici = cijela pakiranja, ne proporcija.** Ne može se
   kupiti pola pakiranja tjestenine - računa se `ceil(potrebno/net_quantity)
   × cijena_pakiranja`, s "× N" oznakom kad treba više paketa. "~" prefiks
   znači da nemamo dovoljno podataka (pouzdanu veličinu pakiranja + kg/l
   bazu) pa se prikazuje cijena jednog pakiranja kao gruba procjena.
3. **g↔ml aproksimacija gustoće ~1** za tekuće/pasirane namirnice unesene u
   gramima (npr. "pasirana rajčica" 500g → tretira se kao 0.5L ako je
   proizvod cjenovno baziran na litri).
4. **Kaufland CSV**: tab-delimited, UTF-8+BOM, `quote:false` u csv-parse
   (stvarni nazivi imaju doslovne navodnike koji bi inače pucali parsanje).
   URL je deterministički (datum + šifra poslovnice), ne treba scraping.
5. **Lidl CSV**: unutar dnevnog ZIP-a (link se mora scrapati sa
   `tvrtka.lidl.hr/cijene`, numerički ID u URL-u ZIP-a se mijenja svaki
   dan), comma-delimited, **windows-1250** enkodiran (ne UTF-8!), treba
   `stripBom` prije dekodiranja jer BOM bajtovi kao cp1250 daju smeće.
6. **`products` tablica se puni DELETE+INSERT svaki dan**, ne upsert - unique
   constraint na `(store,code,barcode)` je uklonjen migracijom
   `0002_drop_products_unique.sql` jer izvorni cjenici imaju prave
   duplikate redaka.
7. **`getAllProducts` (`src/lib/products.ts`) dohvaća stranice PARALELNO**
   (Promise.all), ne sekvencijalno - Supabase vraća max 1000 redaka po
   pozivu, a kataloga ima ~15 000, pa je sekvencijalno straničenje na
   produkciji/mobitelu bilo vidljivo sporo (korisnik prijavio "čekam minutu
   i ništa").
8. **`/recepti`, `/tjedni-plan`, `/kosarica` imaju `export const dynamic =
   "force-dynamic"`** - inače bi se Next.js statički prerenderirao na
   buildu i ne bi vidio dnevne cron promjene niti međusobne izmjene
   (recept promijenjen na jednoj ruti mora se vidjeti na drugoj).
9. **Vizualni dizajn** (Faza 5): topla paleta po referenci koju je korisnik
   poslao (kremasta pozadina, tamnozeleno/crno, meke zeleno/breskva
   kartice) - tokeni u `src/app/globals.css` (`@theme` blok: `--color-cream`,
   `--color-ink`, `--color-brand`, `--color-brand-dark`, `--color-accent-*`).
   Plutajuća pill navigacija na mobitelu (fiksna na dnu), obična traka na
   desktopu. Košarica je lista kartica, ne tablica.
10. **`loading.tsx` na `/kosarica`** - Next.js loading UI konvencija,
    prikazuje animaciju punjenja košarice (🛒 + traka) dok se stranica
    računa (paralelni dohvat iz #7 to sad radi u par sekundi umjesto
    desetke sekundi).

## MCP / pristup u novoj sesiji

- **Supabase MCP** je konfiguriran u `.mcp.json` (project-scoped, bez
  tajni u fajlu). U novoj sesiji treba autenticirati ako alati nisu vidljivi:
  otvori pravi terminal u ovom folderu, pokreni `claude`, unutar te sesije
  `/mcp` → odaberi `supabase` → Authenticate (otvara browser). Desktop app
  sesija to ne vidi dok se ne restarta/reconnecta.
- **Claude in Chrome** (`mcp__claude-in-chrome__*`) - koristio sam ga za
  Vercel/GitHub setup preko korisnikovog pravog Chromea (env varijable,
  deploy provjere, GitHub auth). Isto dostupno u novoj sesiji po potrebi.
- `CRON_SECRET` vrijednost je u `.env.local` (lokalno) i Vercel env
  varijablama (Production) - za ručno testiranje cron ruta vidi
  `.env.local`.
- GitHub CLI (`gh`) je prijavljen kao `alovric98`.

## Poznata ograničenja / namjerno odgođeno

- Matching neće uvijek pogoditi najspecifičniji proizvod (npr. "riža" može
  pogoditi aromatiziranu varijantu) - prihvaćeno, spec eksplicitno dopušta
  nesavršenost.
- **Nema praćenja zaliha/ostataka između tjedana** (npr. kupio 500g za 250g
  potrebe, ostatak za idući tjedan) - eksplicitno razmotreno s korisnikom i
  namjerno odgođeno, previše kompleksnosti/rizika krivih pretpostavki za
  MVP. Ne implementirati bez novog dogovora s korisnikom.
- Brend "Obrok" i logo prompt predloženi korisniku (vidi git povijest
  razgovora ako zatreba doslovni tekst prompta) - korisnik treba
  generirati logo pa ga ubaciti u navigaciju/header.
- RLS isključen na svim tablicama - SQL za uključivanje postoji u
  razgovoru ali NIJE primijenjen, ne primjenjivati bez izričitog traženja.

## Testni podaci trenutno u bazi

- 10 recepata (2 juhe + 7 glavnih jela iz korisnikovog jelovnika + "Piletina
  i riža" stariji test recept) - **stvarni recepti, ne brisati bez pitanja**.
- `weekly_plan_days` stanje se mijenja kroz UI izvan ove konverzacije
  (korisnik testira na mobitelu) - provjeri trenutno stanje umjesto
  pretpostavljanja.

## Sljedeći korak

Nema formalno definirane "Faze 6" - MVP je funkcionalno gotov. Zadnje
pushano: performance fix + loading animacija za Košaricu (commit
`5b6460a`), korisnik treba retestirati na mobitelu. Otvoreno je što god
korisnik sljedeće zatraži - pitaj, ne pretpostavljaj.
