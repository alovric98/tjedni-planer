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

**30.9.2026 - dodan login + odabir trgovina + trajni popisi (lokalno
komitano, NIJE pushano, Google OAuth NIJE još konfiguriran u Supabase
dashboardu):**

- Supabase Auth (Google provider) - `src/app/login`, `src/app/auth/callback`,
  `src/proxy.ts` (Next 16 preimenovao `middleware.ts` u `proxy.ts` - ne
  brkati sa starim konceptom). `NEXT_PUBLIC_AUTH_DISABLED=true` zaobilazi
  login lokalno dok Google provider nije spojen - vidi README "Prijava
  (Google login)" za točne korake koje treba napraviti u Google Cloud
  Console + Supabase dashboardu (nešto što JA ne mogu napraviti, treba
  korisnik).
- Onboarding (`src/app/onboarding`) - prvi odabir trgovina, upisuje u novu
  `user_stores` tablicu. Generički (`src/config/store-options.ts`) - Tommy/
  Studenac/Konzum su već u pickeru kao "uskoro" (disabled), postaju
  birljivi kad dobiju live cjenik, bez promjene sheme/logike.
- Košarica (`src/app/kosarica/page.tsx`, `StoreTabs.tsx`) sad filtrira
  prikaz/izračun na trgovine koje je korisnik odabrao (`enabledStoreKeys`) -
  ako je odabrana samo jedna, "Jeftinije" usporedba se ne prikazuje (nema s
  čim usporediti).
- `profiles.is_premium` stupac postoji (default false), BEZ ikakve billing
  logike - stub komentar `TODO(premium-gate)` u `kosarica/page.tsx` označava
  gdje će ta provjera ući kad postoji pretplata.
- Popis za kupovinu (Tjedni plan) preseljen iz localStorage u Supabase
  (`shopping_lists` + `shopping_list_items`, `src/app/tjedni-plan/
  list-actions.ts`) - preživljava zatvaranje app-a i promjenu uređaja.
  NOVO ponašanje: cijeli popis nestaje iz aktivnog prikaza tek kad su SVE
  stavke označene, tad pada u "Prijašnje liste" (kolaps kartica ispod).
  Max 10 arhiviranih po korisniku - 11. arhiviranje tiho briše najstariji +
  toast "Stara lista je automatski uklonjena.".
- Nove tablice (`profiles`, `user_stores`, `shopping_lists`,
  `shopping_list_items`) IMAJU RLS uključen (za razliku od starih 4 tablice
  koje ostaju namjerno otvorene - vidi "Poznata ograničenja" ispod, ta
  napomena se odnosi SAMO na stare tablice sad).
- Migracija `0003_auth_and_persistent_lists.sql` NIJE još pokrenuta na
  živoj Supabase bazi (`oqwzeggdfbdlsexbaljw`) - treba je pustiti u SQL
  Editoru prije nego login/onboarding/popisi rade na produkciji.
- localStorage → Supabase napomena: korisnici s postojećim neoznačenim
  stavkama u `tjedni-planer:popis-checked` u browseru GUBE to stanje (nema
  migracijskog koraka koji čita localStorage i upisuje ga u Supabase) - ako
  netko trenutno ima aktivan popis na mobitelu, treba ga ili dovršiti prije
  ovog deploya ili prihvatiti da kreće ispočetka.

**30.9.2026 - premium UI redizajn, Faza 1/3 gotova (nekomitano):** novi
tokeni u `globals.css` (Fraunces h1 + Inter, surface-1/2/3, border-strong,
radius-control/surface, shadow-raised/overlay, type skala `text-title/
heading/label/micro`, zasebna dark paleta, reduced-motion), shared primitivi
u `src/components/ui/` (Button, Input/Select, Badge), primijenjeni na login,
onboarding, settings, RecipeForm, Toast, ThemeSwitcher. Preostalo: Faza 2
(planner `DaySelect`/`tjedni-plan`), Faza 3 (AppHeader, TabNav, mobile,
završni pass, ostali ekrani: recepti lista, košarica, ShoppingListGenerator).

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
- Korisnik u onboardingu bira i poslovnicu po trgovini (`user_stores.branch_key`
  / `branch_label`, migracija `0005`; popis iz javnih cjenika u
  `src/lib/price-fetch/branches.ts`). **Faza 2 (nije napravljeno):** cron i
  Košarica još uvijek koriste samo poslovnicu iz `stores.ts`, ne korisnikovu.

## Ključne tehničke odluke (bitno prije diranja koda)

1. **Matching (`src/lib/matching.ts`) NIJE fuse.js** - uklonjen kao ovisnost
   jer je bitap fuzzy matching sustavno loše radio (red riječi, kratke
   riječi pogađaju krivo). Zamijenjen vlastitim word-overlap scorerom: svaka
   riječ upita nosi bod (2 = cijela riječ, 1 = prefiks/korijen), **glavna
   imenica (zadnja riječ upita) mora imati stvarnu vezu** (sprječava npr.
   "mljevena junetina" da pogodi "mljevena kava"), zagrade u nazivu sastojka
   ("(konzerva)", "(light)") se ignoriraju za matching (opisne napomene, ne
   dio naziva proizvoda).
2. **Cijena u Košarici = cijela pakiranja jednog stvarnog proizvoda, nikad
   prosjek ni proporcija** (prepisano 30.9.2026; stara logika - prosjek €/kg
   svih fuzzy pogodaka × sintetička "kupovna količina" - davala je npr.
   0,44 € za 25 g papra i 26,55 € za 2,5 kg piletine). `src/lib/pricing.ts`:
   trošak = `ceil(potrebno / veličina pakiranja) × cijena pakiranja`;
   bira se najmanja veličina koja JEDNIM pakiranjem pokriva potrebu, a
   unutar 2× te veličine najjeftiniji proizvod; ako nijedno ne pokriva,
   N istih pakiranja. Višak se prikazuje. Izuzetak: artikli na vagu
   (Lidl "rinfuza", "cca", Kaufland "_OC"/bez veličine u nazivu, samo za
   sastojke s `looseOk`) računaju se proporcionalno po kg; samo sirovo meso
   (`mode: "average"`) uzima prosjek €/kg varijanti. Veličina pakiranja se
   nikad ne nagađa - bez pouzdanog podatka "cijena nedostupna".
   Veličina: `net_quantity` (masa, kg); za volumen iz naziva ("500 ml")
   jer je `net_quantity` uvijek masa; komadi iz naziva ("10/1").
   `net_quantity = 1` je dvosmislen (pravi 1 kg ili cijena po kg) - vidi
   `isSoldByWeight`. `unit_price` se više NE koristi (u cjeniku je mjestimice
   pogrešan, npr. Lidl papar 14 g ima unit_price = cijena pakiranja).
   **Ručna pravila po sastojku** (`src/config/ingredient-rules.ts`): regex
   include/exclude nad nazivom proizvoda, sinonimi (Papar/Biber,
   Piletina/Pileća prsa), `mode`, `looseOk`. Retci koje pokriva isto pravilo
   spajaju se prije cijenjenja (`mergeItemsByRule`). Sastojak bez pravila
   ide generičkim uparivanjem (`matchPrimaryCandidates`) i u UI-u je
   "procjena". Golden testovi nad snapshotom stvarnog kataloga:
   `src/config/ingredient-rules.test.ts` + `src/lib/__fixtures__/` (nakon
   promjene pravila regenerirati fixture - vidi `note` u JSON-u). Nova
   pravila dodavati tek uz stvaran primjer iz recepta i provjeru nad
   katalogom.
   **Svježe povrće i smrznuto** (30.9.2026): pravila povrća su `fresh` -
   prvo proizvodi koji nisu smrznuti (naziv smrz./zamrz./Ledo ili marka
   Freshona/Chira/Ledo), smrznuto tek kad svježeg nema (grašak, špinat,
   mahune) ili kad recept kaže "smrznuti ..." (zasebna varijanta pravila,
   ne spaja se sa svježim). Smrznuto se nikad ne računa na vagu. Konzerve i
   kiselo se izbacuju, BIO se izbacuje osim ako ga recept traži (Lidl ima
   samo BIO đumbir -> "cijena nedostupna"). Lidl `unit = kom` znači cijenu
   po KOMADU (cvjetača, salate, krastavac) = pakiranje; Lidl `unit = kg` uz
   `unit_price = cijena` i `net_quantity < 1` znači cijenu po kg (tikvica).
   Dio Kauflandovog smrznutog nije ničim označen - hvata ga prednost artikla
   na vagu; bez vage (npr. KLC brokula 450 g) može proći kao "svježe".
   Batak je zasebno pravilo (prosjek kao prsa, bez zabatka i purećeg).
3. **g↔ml aproksimacija gustoće ~1** za tekuće/pasirane namirnice unesene u
   gramima (npr. "pasirana rajčica" 500g → tretira se kao 0.5L ako je
   proizvod cjenovno baziran na litri).
4. **Kaufland CSV**: tab-delimited, UTF-8+BOM, `quote:false` u csv-parse
   (stvarni nazivi imaju doslovne navodnike koji bi inače pucali parsanje).
   URL je deterministički (datum + šifra poslovnice), ne treba scraping.
5. **Lidl CSV**: pojedinačni dnevni CSV PO POSLOVNICI (nema više ZIP-a) -
   link se scrapa sa `www.lidl.hr/c/cijene/s10073252` (stranica ima
   povijest svih poslovnica, filtrira se po datumu + `LIDL_STORE_MATCH`),
   comma-delimited, **windows-1250** enkodiran (ne UTF-8!). Kategorije su
   u formatu "Hrana"/"Piće" (Kaufland: "HRANA"/"PIĆE") - `matching.ts`
   uspoređuje kategoriju bez obzira na velika/mala slova; bez toga bi se
   svi Lidlovi proizvodi filtrirali i Košarica bi za Lidl prikazivala
   "cijena nedostupna" (bug pronađen 30.9.2026, cron i baza su radili
   ispravno).
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
- RLS isključen na starim, dijeljenim tablicama (`recipes`,
  `recipe_ingredients`, `weekly_plan_days`, `products`, `price_fetch_log`) -
  namjerno, nisu vezane uz korisnika. Nove korisničke tablice (`profiles`,
  `user_stores`, `shopping_lists`, `shopping_list_items`) OD 30.9.2026 IMAJU
  RLS uključen (migracija `0003_auth_and_persistent_lists.sql`).

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

**30.9.2026 - centralizirani design system + app shell (lokalno, NIJE
pushano):** stari alias tokeni (`--color-cream`, `--color-brand*`,
`--color-accent-green*`, `--color-accent-peach*`, `--color-accent-red*`)
uklonjeni iz `globals.css` - sve komponente sad koriste izravno Zarine
tokene (`bg`, `surface-1/2`, `border`, `ink`, `ink-muted`, `accent`,
`accent-hover`, `warn`, `warn-bg`). 🛒 emoji u `kosarica/loading.tsx`
zamijenjen inline SVG ikonom (isti oblik kao brand-mark u headeru i login
ikona). Popravljen jedan kontrast-fail (`text-ink-muted/80` u
`StoreTabs.tsx`, padao na ~3.8:1 na bijeloj pozadini).

Dodan `src/components/AppHeader.tsx` (sticky top, vidljiv na sve rute
osim `/login`) - naziv app-a + account meni (avatar/inicijal, dropdown:
Profil "uskoro" placeholder, Uredi odabir trgovina → `/onboarding`,
Odjava → isti `supabase.auth.signOut()` flow kao prije). Uklonjen stari
`onboarding/LogoutButton.tsx` (bio dupliciran, logout je sad dostupan sa
svakog ekrana kroz header, ne samo s onboardinga). `layout.tsx` je sad
async i dohvaća korisnika (`getUser()`) da bi header znao prikazati
avatar/meni vs. "Prijava" link - dodaje jedan Supabase auth poziv po
requestu koji prije nije postojao na `/recepti` i `/tjedni-plan` (na
`/kosarica` se time udvostručio, jer ta stranica već radi svoj
`getUser()` za filtriranje trgovina - nisam dirao tu logiku, samo
napominjem kao poznati P2 za buduću optimizaciju ako zatreba).

`tsc --noEmit`, `eslint .` i `vitest run` prolaze čisto (23/23 testova).

**30.9.2026 - performance/SEO/PWA dovršetak preostalog iz brief-a (lokalno
komitano, NIJE pushano):**

- **Performance (N9 provjera):** `getAllProducts`/`buildProductIndex` se NE
  pozivaju suvišno - svaki se zove točno jednom po odabranoj trgovini po
  loadu Košarice (nužno, različit katalog po trgovini). Stvarni suvišan rad
  bio je u `src/lib/matching.ts`: `wordScoreForLiteral`/`isNegatedInTarget`
  su gradili nov `RegExp` za svaki (riječ, proizvod) par - do ~15.000 puta
  po riječi upita po pozivu `matchProductCandidates`. Dodan
  `Map`-cache po riječi (regex ovisi samo o riječi, ne o target nazivu) -
  isti rezultat, bez ponovnog parsiranja regexa. Šira arhitekturna
  optimizacija (SQL-side filtriranje/indeks umjesto linearnog skena
  cijelog kataloga po sastojku) ostaje otvoren P2, nije napravljena.
- **SEO:** `metadataBase`, Open Graph (`title/description/url/siteName/
  locale/type`), Twitter card (`summary`), i `robots: { index:false,
  follow:false }` dodani u `layout.tsx` - aplikacija je privatan alat bez
  javnog sadržaja za indeksiranje (audit N20).
- **PWA:** `public/manifest.webmanifest` (ime, boje iz Zarinih tokena,
  `display: standalone`, `start_url: /recepti`) + `apple-touch-icon.png`
  (180×180) i manifest ikone (192/512) generirane iz postojećeg brand marka
  (ista korpa-ikona kao `AppHeader.tsx` `BrandMark`, na `--accent`
  pozadini). Bez service workera (namjerno, izvan opsega).
- **Čišćenje:** uklonjen stari komitani sync-artefakt
  `src/lib/matching.server-conflict-*.ts` (identičan `matching.ts` osim
  trivijalne regex-escape razlike, nigdje uvezen) - vjerojatno slučajno
  komitan u prošloj sesiji.
- `tsc --noEmit`, `eslint .`, `vitest run` prolaze čisto (23/23 testova).
