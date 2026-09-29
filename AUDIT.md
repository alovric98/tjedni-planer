# AUDIT — Tjedni planer ručkova

**Datum audita:** 29.09.2026.
**Auditirani commit:** `0ef2ee2b7b338df6cee9968e5505acd66b791699` ("Dodaj PROJECT_STATUS.md za handoff izmedju Claude Code sesija", 07.09.2026.)
**Repo:** https://github.com/alovric98/tjedni-planer.git
**Priroda ovog dokumenta:** audit + plan implementacije. **Nijedna linija aplikacijskog koda nije izmijenjena** u ovom prolazu. Dokaz: `git status --porcelain` prije pisanja ovog dokumenta vraća samo `?? .qa/` i `?? screenshots/`; `git diff --stat -- src supabase README.md package.json` je prazan. Ništa nije commitano ni pushano.

---

## 1. Kako je audit izveden (i što je bilo blokirano)

Što je stvarno pokrenuto (točni nalozi, bez izmišljanja):

| Nalog | Rezultat |
|---|---|
| `git clone https://github.com/alovric98/tjedni-planer.git` | OK |
| `npm install --no-audit --no-fund` | OK, 305 paketa |
| `npx eslint src` | **exit 0**, bez grešaka i bez upozorenja |
| `npx tsc --noEmit` (svježi klon) | **TS2304** u `src/app/layout.tsx(24,50)`: `Cannot find name 'LayoutProps'` |
| `npx tsc --noEmit` (nakon što je `.next/types/` generiran) | exit 0, čisto |
| `npm run build` | **prekinut**: `Killed` (SIGKILL/OOM) na koraku "Creating an optimized production build" — sandbox ima strop od 1 GB RAM-a |
| `node .qa/csv_probe.mjs`, `npx tsx .qa/behaviour_probe.ts` | OK — stvarni Kaufland cjenik za 29.09.2026 (2,1 MB, 15.358 proizvoda) propušten kroz **stvarne funkcije iz repoa** (`fetchKauflandProducts`, `buildProductIndex`, `matchProduct`, `calculateItemPrice`) |
| `chromium --headless=new --screenshot ...` | OK — 6 snimki live deploya u `screenshots/` |

**Zašto aplikacija nije pokrenuta lokalno (2 konkretna razloga, bez nagađanja):**
1. `src/lib/supabase.ts:7-11` baca iznimku na razini modula ako nema `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. U repou nema `.env*` datoteke (`find . -name ".env*"` → prazno), a te vrijednosti nisu javno dostupne: pretražio sam sve JS chunkove live deploya i **nijedan ne sadrži `supabase`** — klijent je isključivo serverski, pa se anon ključ ne može izvući iz javnog bundlea.
2. `npm run build` je ubijen zbog memorijskog stropa sandboxa.

**Zato su snimke stanja "prije" uzete s produkcijskog deploya** koji odgovara ovom commitu (provjereno: live HTML sadrži `Ukupno za tjedan`, `Zadnje osvježeno` i `animate-basket-*` iz `globals.css`, i iste nazive recepata kao kod u repou). Live: https://tjedni-planer.vercel.app

---

## 2. Tech stack (stvarno stanje)

- **Framework:** Next.js 16.3.4, App Router, Turbopack (`package.json`), React 19, TypeScript 5 (`strict: true`).
- **Stil:** Tailwind CSS 4 (`@import "tailwindcss"` + `@theme inline` u `src/app/globals.css`), PostCSS plugin `@tailwindcss/postcss`. Nema `tailwind.config.*` — sve je u `@theme`.
- **Baza:** Supabase (Postgres) preko `@supabase/supabase-js`, **bez ikakve autentifikacije**; RLS je namjerno isključen (`README.md:46`, `src/lib/supabase.ts`).
- **Ostale biblioteke:** `csv-parse` (CSV cjenici), `jszip` (Lidl ZIP). Bez state managementa, bez ikona, bez validacije sheme, bez ijednog testnog okvira.
- **Hosting:** Vercel + Vercel Cron (`vercel.json`: `/api/cron/lidl` i `/api/cron/kaufland`, oba `0 9 * * *`, `maxDuration: 60`).
- **Fontovi:** `next/font/google` — Geist Sans + Geist Mono (`src/app/layout.tsx:2,6-14`). **Geist Mono se nigdje ne koristi** (`grep -rn "font-mono" src` → 0 pogodaka), a učitava se.
- **Jezik sučelja:** hrvatski (`<html lang="hr">`, `layout.tsx:27`).

**Ne postoji:** nigdje `error.tsx` / `global-error.tsx` / `not-found.tsx`. Postoji samo `src/app/kosarica/loading.tsx`. Nema `test` scripta, nema `*.test.*`, nema vitest/jest konfiguracije.

---

## 3. Arhitektura i kako se podaci stvarno spremaju

Sve je jedan Next.js projekt bez odvojenog backenda; "backend" su server komponente i server akcije. Baza: 4 tablice (`supabase/migrations/0001_init.sql`):

```
recipes            (id uuid pk, name, created_at, updated_at)
recipe_ingredients (id uuid pk, recipe_id → recipes on delete cascade,
                    name, quantity numeric, unit text CHECK (unit in ('g','kg','ml','l','kom')))
weekly_plan_days   (day_of_week smallint pk CHECK 1..7, recipe_id → recipes on delete set null)
                   -- 7 redaka se seeda u migraciji, jedan po danu
products           (id, store CHECK in ('lidl','kaufland'), code, barcode, name, brand,
                    net_quantity numeric, unit text, price numeric NOT NULL,
                    unit_price numeric, category, updated_at)
price_fetch_log    (id, store, status CHECK in ('success','error'), product_count, error_message, fetched_at)
```

- **Model je jedan globalni tjedni plan bez korisnika** — nema `user_id` nigdje, tjedan je uvijek isti skup od 7 redaka. Sve što jedan korisnik promijeni, vidi svatko.
- `0002_drop_products_unique.sql` **uklanja** `unique (store, code, barcode)` jer stvarni cjenici imaju prave duplikate.
- `products` je dnevni cache koji se **briše i ponovno upisuje po trgovini** (`src/lib/price-fetch/db.ts:13-28`), a ne upsert.
- Nema migracijskog alata u projektu — SQL se ručno pokreće u Supabase SQL editoru (`README.md`).

---

## 4. End-to-end tok: recepti → tjedni plan → agregacija → match s cjenikom → cijena u košarici

### 4.1 Recepti (unos)
- `src/app/recepti/page.tsx:12-55` — lista recepata, `select("id, name, recipe_ingredients(name, quantity, unit)")`.
- `src/app/recepti/actions.ts:14-39` `parseIngredients` — validira količinu > 0 i jedinicu protiv `UNITS = ["g","kg","ml","l","kom"]` (linija 7). **Nikakve normalizacije jedinica nema** — "1 kg" i "1000 g" ostaju dva različita zapisa.
- `createRecipe` (`actions.ts:41-80`) upisuje recept pa sastojke; `updateRecipe` (`82-127`) **briše sve sastojke (110-116) pa ih ponovno upisuje (118-123)** — nije transakcija.

### 4.2 Tjedni plan
- `src/app/tjedni-plan/page.tsx:22-60` — dohvaća 7 dana + listu recepata, renderira `DaySelect` po danu.
- `src/app/tjedni-plan/actions.ts:12-24` `setDayRecipe` — `update({recipe_id}).eq("day_of_week", dayOfWeek)`; radi ispravno jer je `day_of_week` primarni ključ.

### 4.3 Agregacija sastojaka
- `src/app/tjedni-plan/actions.ts:26-52` `generateShoppingList()` — jedina implementacija agregacije u projektu:
  - linija 27-32: `select("recipes(recipe_ingredients(name, quantity, unit))").not("recipe_id","is",null)`
  - **linija 41:** `const key = \`${normalize(ingredient.name)}|${ingredient.unit}\``
  - linija 44: `existing.quantity += ingredient.quantity`
  - linija 49: sortiranje po nazivu (`localeCompare(..., "hr")`)

**Ključna posljedica:** agregira se isključivo unutar iste *sirove* jedinice. "200 ml" i "0,2 l" istog sastojka postaju **dva odvojena retka** i nikad se ne zbroje. Nema pretvorbe g↔kg ni ml↔l na ovom mjestu.

### 4.4 Match s cjenikom
- `src/app/kosarica/page.tsx:15-54` `buildBasket(items, products)`:
  - linija 22-23: za svaku agregiranu stavku `matchProduct(index, item.name)`
  - `src/lib/matching.ts:13-21` `buildProductIndex` — priprema indeks (polje) s normaliziranim nazivom svakog proizvoda
  - `src/lib/matching.ts:53-85` `matchProduct` — scoring i **odabir jednog** proizvoda (detalji u N1)
  - `src/lib/matching.ts:88-112` `convertToBasis` — g→kg (÷1000), ml→l (÷1000), **g↔ml uz pretpostavljenu gustoću 1** (komentar to i priznaje)
  - `src/lib/matching.ts:128-146` `calculateItemPrice` — izračun cijene stavke

### 4.5 Prikaz cijene u košarici
- `src/app/kosarica/page.tsx:70-81` — jedan `Promise.all`: `buildBasket(getAllProducts("lidl"))`, `buildBasket(getAllProducts("kaufland"))` i zadnji zapis iz `price_fetch_log` po trgovini (`:80` `logs?.find(l => l.store === store)`).
- `src/app/kosarica/StoreTabs.tsx` — klijentska komponenta, **default tab je "lidl"** (`useState<"lidl"|"kaufland">("lidl")`), `BasketRowCard` (27-55), ukupni iznos (60-66), "Zadnje osvježeno" (63-65), fusnota (74-79), tabovi (89-105).
- `src/lib/products.ts:15-52` `getAllProducts(store)` — count pa 15 stranica po 1000 redova paralelno (`Promise.all`), `select("*")`.

**Bitno:** košarica **ne čita** ono što je korisnik vidio pod "Generiraj popis za kupovinu" — ona sama poziva istu `generateShoppingList()` funkciju na serveru. Isti izvor, ali gumb na `/tjedni-plan` ne perzistira ništa (vidi N11).

---

## 5. Dohvat i parsiranje cjenika + ponašanje kad cjenika nema

### 5.1 Kaufland (radi)
- `src/config/stores.ts:17-28` `buildKauflandCsvUrl(date)` — **deterministički sastavljen URL** iz hardkodirane poslovnice (`KAUFLAND_STORE`, `stores.ts:6-10`) i datuma:
  `.../mpc_15_5/{mjesec}/{dan}/Hipermarket_Naselje_Slavonija_2_kc_br_5_Slavonski_Brod_2830_{DDMMYYYY}_7-30.csv`
- `src/lib/price-fetch/kaufland.ts:43-53` — mapiranje stupaca po **fiksnom indeksu**: `name=row[0]`, `code=row[1]`, `brand=row[2]`, `net_quantity=row[3]`, `price=row[5]`, `unit=mapUnitBasis(row[8])`, `unit_price=row[9]`, `barcode=row[13]`, `category=row[14]`.
- **Provjereno danas (29.09.2026): HTTP 200, `text/csv`, 2.179.206 bajtova, 15.358 redova.** Stvarni header datoteke je:
  `naziv proizvoda | šifra proizvoda | marka proizvoda | neto količina(KG) | jedinica mjere | maloprod.cijena(EUR) | akc.cijena | kol.jed.mj. | jed.mj. (1 KOM/L/KG) | cijena jed.mj.(EUR) | MPC poseb.oblik prod | Najniža MPC u 30dana | Sidrena cijena | barkod | kategorija proizvoda | Dostupan/Nedostupan`
  → mapiranje je točno, **osim što je značenje stupca 3 pogrešno protumačeno** (vidi N8).

### 5.2 Lidl (NE radi — izvor se promijenio)
- `src/lib/price-fetch/lidl.ts:24-43` `findTodaysZipUrl` dohvaća `https://tvrtka.lidl.hr/cijene` i traži regexom (`:35-37`):
  `https://tvrtka\.lidl\.hr/content/download/\d+/fileupload/Popis_cijena_po_trgovinama_na_dan_{DD}_{MM}_{YYYY}\.zip`
  Ako ne nađe → baca `Nije pronađen link za današnji Lidl cjenik` (`:40`).
- **Provjereno danas:** stranica (i sirovi HTML i DOM nakon izvršavanja JS-a, `chromium --dump-dom`) sadrži **0 (nula) pojavljivanja `.zip`, `fileupload` i `content/download`**. Najnoviji datum na stranici je **18.09.2026**, a jedina dva `href`-a koja postoje (za 06.08. i 07.08.2026.) vode na `/home-hr/media/media-materials/cijena_06-08-2026` i **vraćaju 404**. Dakle regex danas nema što pronaći.
- Posljedica u produkciji: live košarica prikazuje **"Zadnje osvježeno: 22. ruj 2026. 09:23"** dok je danas 29.09.2026. — Lidl cijene stoje zamrznute, a UI o tome ne upozorava (vidi N4).
- Nisam mogao doći do stvarnog Lidl ZIP-a (ni preko izvora, ni preko arhive — Wayback CDX API je vratio HTTP 503), pa su pretpostavke o stupcima `row[2]`/`row[3]` (N9) **nepotvrđene**.

### 5.3 Što se dogodi kad danas nema cjenika
- **Kaufland nedostupan:** `fetchKauflandProducts` baca → ruta vraća 500 i logira `status='error'` (`api/cron/kaufland/route.ts:19-22`). Stari podaci **ostaju** u tablici jer se `replaceStoreProducts` poziva tek nakon uspješnog dohvata. Košarica prikazuje stare cijene s malim sivim tekstom "Zadnje osvježeno: <datum>" — **bez ikakve oznake da su cijene stare N dana**.
- **Lidl nedostupan (danas):** isto, ali se ponavlja svaki dan već najmanje od 23.09.2026.
- **Ako je tablica prazna (npr. prvi deploy):** `getAllProducts` vrati `[]` → svaka stavka pada u granu "nije pronađeno" → ukupno **"0,00 €"** bez ijedne upozoravajuće poruke. To je najgori oblik tihog laganja košarice.

---

## 6. Nalazi

Oznake: **[KRITIČNO]**, **[VISOKO]**, **[SREDNJE]**, **[NISKO]**. Svaki nalaz je nešto što sam stvarno pročitao u kodu ili vidio u izvršavanju/na live aplikaciji.

---

### N1 — BUG A: nema prosjeka, uzima se jedan proizvod; prag sličnosti ne postoji **[KRITIČNO]**

`src/lib/matching.ts:53-85`. Cijeli mehanizam odabira je:

```ts
// :67-69
if (wordScore(headWord, entry.normalizedName) === 0) continue;
// ...
if (score > 0) candidates.push({ entry, score });
// :71-85
if (candidates.length === 0) return null;
// ... sort: score desc -> kraći normalizedName -> niža cijena (:78-84)
return candidates[0].entry.product;      // <-- :85
```

- **Prosjeka nema.** Lista `candidates` se izračuna i onda baci — uzima se isključivo `candidates[0]`.
- **Prag sličnosti ne postoji nigdje u projektu.** Ne postoji konstanta tipa `MIN_SIMILARITY`, ne postoji omjer, ne postoji `fuse.js` (vidi N18). Jedini uvjet je `score > 0`, a `wordScore` (`:46-51`) daje 0 za riječi kraće od 3 znaka, 2 za cijelu riječ, 1 za prefix od `min(len, max(4, 70%))`. To je binarno "ima/ne ma", ne sličnost.
- Pobjednika, kad više kandidata ima isti score, određuje **najkraći naziv** (`:78-84`), pa tek onda najniža cijena.

**Stvarno izmjereno na današnjem Kaufland cjeniku** (kroz `matchProduct`, ne kroz moju reimplementaciju):

| Sastojak | Kandidata (naziv sadrži korijen) | Što algoritam odabere | Cijena |
|---|---|---|---|
| `mlijeko` (200 ml) | 260 | **"Nivea mlijeko Q10 400 ml"** (losion za tijelo) | **12,39 €**, `exact=true` |
| `jaja` (10 kom) | 32 | **"KLC.Spatzle 4 jaja 500 g"** (tjestenina) | 1,99 € |
| `maslinovo ulje` (500 ml) | 116 (svi "ulje") | "Freoli Ulje maslinovo 1L" | 6,99 € |
| `brašno` (1,3 kg) | 62 | "KLC.Brašno pirovo 1kg" | 1,69 € |
| `riža` (500 g) | 73 | "KLC.Gyros riža 750 g" | 4,99 € |

Isti obrazac je vidljiv i na live košarici: `mrkva i celer` → "Celer", `kiselo vrhnje ili grčki jogurt` → "Grčki jogurt SK3", `krastavci i čeri rajčica` → "Rajčica".

**Zašto je važno:** jedan pogrešan odabir ulazi u ukupni trošak kao da je točan (`exact=true` za Nivea losion!), pa korisnik u trgovini dobije bitno krivi broj. Ovo je točno onaj bug iz briefa, ali teži nego što brief pretpostavlja — nije "nasumičan od 6 maslinovih ulja", nego pogrešna *vrsta* proizvoda.

---

### N2 — BUG B: zaokruživanje na pakiranja postoji samo djelomično i ne pokriva 19,6 % kataloga **[KRITIČNO]**

`src/lib/matching.ts:128-146`:

```ts
if ((product.unit === "kg" || product.unit === "l") && product.net_quantity) {   // :135
  const neededInBasis = convertToBasis(item.quantity, item.unit, product.unit);   // :136
  // ...
  const packages = Math.max(1, Math.ceil(neededInBasis / product.net_quantity));  // :139
  return { price: round2(packages * product.price), packages, exact: true };      // :140-142
}
return { price: round2(product.price), packages: 1, exact: false };              // :144
```

- **`Math.ceil` postoji** (zaokruživanje prema gore je ispravno načelno), ali **samo ako proizvod ima `unit` `"kg"` ili `"l"` I `net_quantity`**. U svakom drugom slučaju (`:144`) vraća se **cijena jednog pakiranja bez ikakvog zaokruživanja** — nikad se ne pogleda treba li više pakiranja.
- U današnjem Kaufland cjeniku (**15.358 proizvoda**): s jedinicom kg/l ima ih 11.407, **`unit === null` ima ih 3.017**, a "kom" 934. Dakle **3.017 proizvoda s ispravnom `net_quantity` nikad ne uđe u granu zaokruživanja** samo zato što je kolona `jed.mj. (1 KOM/L/KG)` u CSV-u prazna.
- **Ne postoji odabir najmanje kombinacije pakiranja.** Algoritam koristi isključivo veličinu pakiranja *jednog* odabranog proizvoda; ne gleda ostale veličine iz cjenika (`0.5/1/2 l`, `0.5/1/2/5 kg`), niti postoji ikakva zadana standardna veličina po kategoriji (brief to izričito traži, a u kodu je nema).
- **"kom" se nikad ne zaokružuje.** Broj komada u pakiranju (npr. jaja `6/1`, `10/1`, `58/1`) postoji **samo u nazivu proizvoda**, jer `net_quantity` za KOM redove nije broj komada nego **masa pakiranja** — npr. `KLC.NMNP Svj.jaja iz slobod.uzg.6/1` ima `net_quantity = 0.39`, `unit_price = 0.332`.

Izmjereno izravnim pozivom stvarnih funkcija:

| Slučaj | Rezultat stvarnog koda | Trebalo bi |
|---|---|---|
| 10 kom jaja, pakiranje 6/1 (`unit=kom`) | `price=1.99 packages=1 exact=false` | 2 pakiranja = 3,98 € |
| 1,3 kg brašna, proizvod 1 kg ali `unit=null` | `price=0.98 packages=1 exact=false` | 2 × 1 kg = 1,96 € |
| isti proizvod s `unit="kg"` (kako bi trebalo biti) | `price=1.96 packages=2 exact=true` | ✔ mehanizam radi kad je jedinica postavljena |
| 200 ml mlijeka vs losion 400 ml (`unit=l`) | `price=12.39 packages=1 exact=true` | pogrešan proizvod (N1) |
| 1,5 l mlijeka, pakiranje 1 l | `price=1.98 packages=2 exact=true` | ✔ |
| 500 g pilećih prsa vs pakiranje 100 g | `price=9.95 packages=5 exact=true` | mehanizam ✔, ali 5 × 100 g delikatesnih prsa umjesto jedne od 500 g |

**Odgovor na izričito pitanje iz briefa ("sadrži li cjenik uopće podatak o veličini pakiranja"):** sadrži, ali nepotpuno i s krivim značenjem — `neto količina(KG)` je **uvijek masa** (čak i za tekućine i za KOM pakete), `jed.mj.` je često prazan, a broj komada treba vaditi iz naziva.

---

### N3 — 0 pronađenih proizvoda tiho umanjuje ukupni iznos **[KRITIČNO]**

`src/app/kosarica/page.tsx`:

```ts
// :31-33  (grana kad matchProduct vrati null)
calculatedPrice: null,
...
exact: true,          // <-- pogrešna semantika flaga na "nema cijene" retku
// :51
const total = rows.reduce((sum, row) => sum + (row.calculatedPrice ?? 0), 0);
```

- Neprepoznata stavka doprinosi **0 €** ukupnom zbroju koji se prikazuje kao "Ukupno za tjedan" (`StoreTabs.tsx:60-66`) — **bez ijedne riječi upozorenja da zbroj nije potpun**. Redak ima "—" i "nije pronađeno" (`StoreTabs.tsx:39`), ali zbroj na vrhu izgleda potpun.
- Ako je cijela tablica cjenika prazna (npr. Lidl prije prvog uspješnog crona), rezultat je **"Ukupno za tjedan 0,00 €"** — laž koja izgleda kao podatak.
- `packages: 1` se postavlja i u ovoj grani, iako se cijena ne koristi.

Ovo je isti scenarij koji brief zahtijeva da bude "cijena nedostupna, nikako 0 € i nikako tiho izostavljanje iz zbroja" — trenutno je upravo suprotno.

---

### N4 — Lidl dohvat je mrtav, cijene stoje 7 dana, UI ne upozorava **[KRITIČNO]**

Vidi 5.2 za dokaze. Sažetak:

- `lidl.ts:35-40` traži `.zip` link koji na stranici **više ne postoji** (0 pojavljivanja `.zip`/`fileupload`/`content/download` u sirovom HTML-u i u DOM-u nakon JS-a).
- Live košarica: posljednji uspješan Lidl dohvat **22.09.2026. 09:23**, danas 29.09.2026.
- `StoreTabs.tsx:63-65` prikazuje taj datum sitnim tekstom, **bez oznake "podaci su stari"**, bez crvene boje, bez blokade. Korisnik u dućanu misli da gleda današnje cijene Lidla.

---

### N5 — Složeni nazivi sastojaka: pola sastojka tiho ispadne iz cijene **[VISOKO]**

`matching.ts:63` uzima **samo zadnju riječ** naziva kao nositelja (`headWord`). Za sastojak "krastavci i čeri rajčica" to je "rajčica", za "mrkva i celer" to je "celer", za "kiselo vrhnje ili grčki jogurt" to je "jogurt". Prvi dio naziva **nikada se ne cijeni i nigdje se ne prijavljuje**. Na live košarici su ta tri slučaja vidljiva doslovno tako.

**Zašto je važno:** kupac u trgovini neće kupiti krastavce, a u košarici ih nema ni u iznosu ni u popisu.

---

### N6 — Agregacija ne spaja različite jedinice istog sastojka **[VISOKO]**

`tjedni-plan/actions.ts:41` — ključ je `normalize(naziv)|unit`. Recept A s "200 ml" i recept B s "0,2 l" istog sastojka → **dva retka u popisu i u košarici**, svaki se cijeni zasebno. Istu stvar vidim u live košarici gdje se `maslinovo ulje 27,5 ml` i `suncokretovo ulje 5 ml` vode odvojeno. Nema nikakve normalizacije g/kg i ml/l **prije** uparivanja s cjenikom, pa se i cijena po pakiranju računa dva puta (dva puta "kupi jedno pakiranje" za isti proizvod).

---

### N7 — `replaceStoreProducts` briše pa upisuje bez transakcije **[VISOKO]**

`src/lib/price-fetch/db.ts:13-28`: prvo `delete().eq("store", store)` (16-19), pa insert u batch-evima od 1000 (21-27). Ako drugi batch padne (mreža, 60 s limit), **tablica ostaje s djelomičnim katalogom**, a `logFetch` zapiše `status='error'`. Pošto UI prikazuje zadnji *uspješan* dohvat, djelomičan katalog je **nevidljiv**. Zbroj u košarici tada tiho pada (N3).

---

### N8 — Značenje `net_quantity` je pogrešno protumačeno (masa ≠ količina, KOM ≠ komadi) **[VISOKO]**

Dokazano na stvarnom CSV-u:
- `Vileda spužvasta krpa 10kom` → `net_quantity = 0.300`, a 10 komada je u nazivu.
- `Libresse Ulošci dnevni extra normal 58/1` → `net_quantity = 0.134` (58 komada!).
- `KLC.NMNP Jaja ... 10/1` → `net_quantity = 0.65` (masa), dok je stvarna cijena po komadu u `unit_price = 0.289`.
- Tekućine: kolona je u KG, a `unit` može biti "L" – za mlijeko je razlika zanemariva, za ulje ~8 % (0,92 kg/l).

`kaufland.ts:48-49` sprema `net_quantity` i `unit` **kao da su ista osnova**. `lidl.ts:84-85` radi isto, a `classifyUnitBasis` (`lidl.ts:9-22`) uz to ima i drugi problem: za polje poput `"500 ml"` vraća `"l"` (`:17`), dok `net_quantity` iz `row[2]` može ostati `500` — **kombinacija koja znači 500 litara**. Točno značenje `row[2]`/`row[3]` u Lidlovom CSV-u **nisam mogao potvrditi** (izvor je nedostupan), pa je ovo rizik, ne potvrđen bug. Ostatak: `classifyUnitBasis` vraća `null` ako polje sadrži 0 ili 2+ broja (`:14`), tj. za svaku varijantu tipa "2 x 500 ml".

---

### N9 — Performanse: košarica dohvaća ~30.000 redova i matcha u petlji **[VISOKO]**

- `src/lib/products.ts:15-52`: `getAllProducts` = 1 count upit + 15 paralelnih stranica (`Promise.all`) **po trgovini**; košarica to zove **dvaput** (`kosarica/page.tsx:70-71`) → ~32 paralelna PostgREST zahtjeva i ~30.000 redova pri **svakom** otvaranju košarice. Nema `unstable_cache`, nema `revalidate`, nema filtriranja kolona (`select("*")`).
- `matchProduct` za svaki sastojak prolazi **cijeli indeks** (11.000-15.000 proizvoda) i u `wordScore` gradi **novi `RegExp` po proizvodu po riječi** (`matching.ts:33-35,46-51`) → za 30 sastojaka ~450.000 izvršavanja regexa po zahtjevu. Na mobitelu u dućanu to je osjetno čekanje, a `kosarica/loading.tsx` je jedini loading ekran u aplikaciji.
- Zadatak bi se prirodno rješavao SQL-om (indeks `products_store_name_idx` već postoji) ili predračunatim indeksom u cacheu.

---

### N10 — Nema `error.tsx` nigdje; greške baze završe na generičkom Next ekranu **[SREDNJE]**

`find src -name "error.tsx"` → ništa. `/recepti` i `/tjedni-plan` sami hvataju grešku upita i prikazuju poruku (`recepti/page.tsx:18-25`, `tjedni-plan/page.tsx:32-41`), ali `/kosarica` baca iz `getAllProducts` (`products.ts:22,46`) i iz `generateShoppingList` (`actions.ts:31`) → korisnik u dućanu vidi generički Next error screen. Nema poruke tipa "cjenik trenutno nije dostupan".

---

### N11 — Gumb "Generiraj popis za kupovinu" ne radi ništa trajno **[SREDNJE]**

`src/app/tjedni-plan/ShoppingListGenerator.tsx` poziva `generateShoppingList()` i drži rezultat u lokalnom stanju komponente; ništa se ne sprema, a `/kosarica` ionako sam poziva istu funkciju. Gumb je zavaravajuća afordancija: korisnik pomisli da je time "poslao" popis u košaricu.

---

### N12 — Brisanje recepta: greška se gubi, potvrda nije stilizirana **[SREDNJE]**

`src/app/recepti/DeleteRecipeButton.tsx:13-19` — `window.confirm()` pa `startTransition(() => deleteRecipe(id))`. `deleteRecipe` (`actions.ts:129-135`) **baca** iznimku na grešku baze; poziv unutar `startTransition` nema `catch`, pa se odbijeni promise ne prikazuje korisniku — gumb se samo vrati u normalno stanje i recept ostane. Nema potvrde nakon uspješnog brisanja.

---

### N13 — `updateRecipe` briše i ponovno upisuje sastojke bez transakcije **[SREDNJE]**

`recepti/actions.ts:110-116` (delete) i `:118-123` (insert). Pad između njih ostavlja recept **bez ijednog sastojka**, a korisnik dobije poruku o grešci bez mogućnosti povrata.

---

### N14 — Nema stanja "cjenik nije dostupan danas" **[SREDNJE]**

Postoje: prazno stanje recepata (`recepti/page.tsx:39-41`), prazno stanje košarice (`kosarica/page.tsx:59-67`), loading samo za košaricu. Ne postoje: stanje "cjenik nije dostupan / podaci su stari N dana", skeleton za `/recepti` i `/tjedni-plan`, i stanje "nema pouzdanog matcha" na razini cijelog ekrana (postoji samo po retku, i to bez utjecaja na zbroj — N3).

---

### N15 — Kontrast: dva mjesta padaju ispod 4,5:1 **[SREDNJE]**

Izračunato iz vrijednosti u `globals.css` (WCAG 2.1 formula, relativna luminancija):

| Par | Omjer | Ocjena |
|---|---|---|
| `accent-green-ink/80` na `accent-green` (#4b6b2f/80 ≈ #6f8a57 na #e4efc9) — **tekst "Zadnje osvježeno" 12px** | **3,21** | pada za mali tekst |
| `ink-muted` (#6b7280) na `gray-100` (#f3f4f6) — **neaktivni tab Lidl/Kaufland 14px** | **4,39** | tik ispod granice |
| `accent-peach-ink` na `accent-peach` | 3,83 | pada za mali tekst |
| `accent-red-ink` na `accent-red` | 4,49 | tik ispod granice |
| `ink` na `cream`, `brand` na bijelom, `white` na `brand-dark`, `accent-green-ink` na `accent-green` | 5,08 – 17,40 | OK |

### N16 — Dodirne površine ispod 44px **[SREDNJE]**

- `RecipeCard.tsx:17-20`: "Uredi" i "Obriši" su **goli tekst** (`text-sm`, bez paddinga) → visina ~20px.
- `TabNav.tsx:26`: tabovi `py-2.5 text-sm` → ~40px, ispod preporučenih 44px za mobilni.
- `DeleteRecipeButton.tsx:20` nema nikakvu površinu oko teksta, samo boju.

### N17 — Dizajn tokeni ne postoje; tri različita zaobljenja i dvije proizvoljne sjene **[SREDNJE]**

- `globals.css` definira **samo boje i fontove**. Nema tokena za `--radius-*`, `--shadow-*`, `--space-*`, nema tipografske skale (koriste se `text-2xl/lg/sm/xs` ad hoc).
- Zaobljenja su ručno razbacana: `rounded-3xl` (kartica recepta `RecipeCard.tsx:13`, ukupni iznos `StoreTabs.tsx:60`), `rounded-2xl` (redak košarice), `rounded-full` (**svi gumbi i CTA** `recepti/page.tsx:33`, `TabNav.tsx:17,26`). Tri različite vrijednosti bez sustava.
- Sjene: `shadow-sm shadow-black/5` na karticama, `shadow-lg shadow-black/10` na navigaciji — bez skale.
- `Geist_Mono` se učitava (`layout.tsx:11-14`) a ne koristi se nigdje.

### N18 — README tvrdi stvar koje nema u kodu **[NISKO]**

`README.md:77`: "Fuzzy pretraga (`fuse.js`) uz prednost cijeloj riječi i kraćem, doslovnijem..." — `fuse.js` **nije** u `package.json` (provjereno), a stvarni matcher je ručni `wordScore`. Dokumentacija opisuje algoritam koji ne postoji; svatko tko bude čitao README prije koda dobit će pogrešnu sliku (i, vjerojatno, pogrešan popravak).

### N19 — Krhke pretpostavke o izvorima **[NISKO]**

- `config/stores.ts:4-5` `LIDL_STORE_MATCH = "Slavonski Brod"` matcha se protiv **imena datoteke unutar ZIP-a** (`lidl.ts:55`); svaka promjena naziva (npr. `Slavonski_Brod`) ruši cijeli dohvat.
- `config/stores.ts:6-10` Kaufland poslovnica i `_7-30.csv` sufiks hardkodirani; `buildKauflandCsvUrl` nema nikakav fallback (npr. jučerašnji dan, drugi sufiks) iako je URL nedokumentiran.
- Lidlov regex zahtijeva da `.zip` link bude **na stranici**; danas ga tamo nema (N4).

### N20 — Ostalo (sitnije) **[NISKO]**

- `formatQuantity` (`format.ts:1-3`) samo zamijeni točku zarezom; ne zaokružuje, pa količina tipa 0.3333333 ispisuje 7 decimala.
- Prikaz naziva proizvoda je sirov iz cjenika, s internim prefiksima (`"KLC.NMNP ..."`, `StoreTabs.tsx:35`).
- Prikaz kupovne količine u košarici je samo `× N` (`StoreTabs.tsx:36`); **nigdje se ne vidi "Treba: 200 ml · Kupuješ: 1 l"** kako brief traži.
- `price_fetch_log` raste neograničeno (nema retencije), a `error_message` zadnjeg neuspjeha nigdje se ne prikazuje u UI-u.
- Aplikacija je javno dostupna bez autentifikacije i **bez `robots` meta oznake** (provjereno u live `<head>`), s upisnim pravima preko server akcija — svatko tko nađe URL može dodavati i brisati recepte i mijenjati tjedni plan (za osobnu aplikaciju svakako vrijedi dodati barem noindex).
- Nema Open Graph/Twitter meta oznaka; `metadata` postoji samo u `layout.tsx:16-22`, a stranice imaju samo `title`.
- `kosarica/page.tsx:53`: `lastUpdated: null` u povratnoj vrijednosti `buildBasket` je mrtva inicijalizacija (prepisuje se na `:80`).

---

## 7. Gdje brief ne odgovara stvarnom stanju koda

1. **"Tri glavna dijela (Recepti / Popis / Košarica)"** — u kodu su tabovi **Recepti / Tjedni plan / Košarica** (`src/components/TabNav.tsx:6-10`). "Popis" **nije tab**: agregirani popis se prikazuje unutar stranice *Tjedni plan* preko gumba `ShoppingListGenerator`. Plan ispravaka je pisan prema stvarnoj strukturi (3 taba, ali drugi je "Tjedni plan").
2. **Zadatak pretpostavlja da aplikacija ne zaokružuje uopće ("vjerojatno računa cijenu za točno 200 ml").** Stvarno: `Math.ceil` postoji (`matching.ts:139`), ali se primjenjuje samo na podskup proizvoda i samo za jednu veličinu pakiranja. Bug je drugačiji (i lukaviji) od opisanog — vidi N2.
3. **Zadatak traži prosjek "iznad praga pouzdanosti sličnosti".** Prag ne postoji u kodu (N1); prije uvođenja prosjeka treba ga uvesti, inače bi se prosjek računao preko smeća (npr. 260 kandidata za "mlijeko" uključuje šampone).
4. **Zadatak spominje "dnevno objavljene cjenike (CSV/XML)".** XML ne postoji nigdje u kodu; Lidl je ZIP s CSV-om u windows-1250, Kaufland je jedan CSV.
5. **Zadatak kaže "podigni projekt lokalno i prođi kao korisnik".** Nisam mogao — dva konkretna blokatora (poglavlje 1). Uživo sam prošao kroz **produkcijski deploy** i kroz **stvarne funkcije s pravim podacima**, što daje iste dokaze o logici cijena, ali nisam mogao reproducirati pisanje u bazu na svom testnom skupu.

---

## 8. Plan implementacije

Redoslijed je namjeran: najprije točnost cijene (Fix 1 → Fix 2), pa dizajn, pa testovi. Bez Fix 1 i 2 dizajnerski rad uljepšava pogrešan broj.

### (a) FIX 1 — prosječna jedinična cijena preko svih kandidata iznad praga

**Korak 0 (novo, prije prosjeka — bez ovoga prosjek nema smisla).** Uvesti *prag pouzdanosti* i zaštitu od pogrešne vrste proizvoda:
- Novi `matchProductCandidates(index, name): Candidate[]` u `src/lib/matching.ts` koji vraća **sve** kandidate, a `matchProduct` postane tanki wrapper (zadrži postojeći potpis radi kompatibilnosti `kosarica/page.tsx:23`).
- Zamijeniti binarni `wordScore > 0` **numeričkom mjerom sličnosti** (npr. Dice/Jaccard koeficijent nad bigramima tokena, 0–1) s eksplicitnom konstantom `MIN_MATCH_SIMILARITY = 0.6` (vrijednost za kalibraciju na stvarnim podacima, dokumentirano uz konstantu).
- **Iskoristiti `products.category`** koji već postoji i puni se iz cjenika (`kaufland.ts:52`, `lidl.ts:88`): pri uparivanju namirnica dozvoliti samo kategorije hrane (npr. `HRANA`, `VOĆE I POVRĆE`, `MESO...`; točan popis izvesti iz stvarnog CSV-a). Time "Nivea mlijeko Q10" (kategorija kozmetike) ispadne iz kandidata prije nego dođe do prosjeka. Ovo je najjeftinija i najučinkovitija pojedinačna popravka.
- Ukloniti "najkraći naziv" kao kriterij odabira (`matching.ts:78-84`) — on ne smije birati *pobjednika*, smije samo razriješiti prikaz.

**Korak 1 — jedinična cijena po kandidatu.** Za svakog kandidata izračunati **jediničnu** cijenu u zajedničkoj osnovi (`kg` / `l` / `kom`):
- prvo `unit_price` iz cjenika kad je prisutan i u istoj osnovi;
- inače `price / net_quantity` nakon pretvorbe `net_quantity` u osnovu (i nakon popravka iz N8: KOM → broj komada iz naziva);
- kandidati bez pouzdane osnove **ne ulaze u prosjek** (broje se i prijavljuju u UI-u kao "N proizvoda bez poznate jedinične cijene").

**Korak 2 — odabrana mjera i obrazloženje (obavezno kao komentar u kodu).** Preporuka: **trimmed mean (odrezano 10 % s oba kraja, najviše 20 % uzorka); za n ≤ 4 → aritmetička sredina; za n = 1 → ta cijena direktno; za n = 0 → nedostupno.**
Obrazloženje za komentar u kodu (utemeljeno na izmjerenom): vlasnik je izričito tražio **prosjek**, pa je aritmetička sredina osnovno ponašanje; ali izmjereni kandidati pokazuju da jedan pogrešno uparen proizvod može biti **30× skuplji** od stvarne namirnice (losion 30,98 €/l među pravim mlijekom ~1 €/l), a median bi za mali broj kandidata odbacio i stvarni raspon marki. Trimmed mean zadržava "prosjek" kakav je tražen, a odbacuje najgore krajeve; uz prag i kategorijski filter iz Koraka 0 ostatak pogrešnih uparivanja je malen.

**Korak 3 — rubni slučajevi:**
- **0 kandidata** → `priceUnavailable: true`, `calculatedPrice: null`. U `kosarica/page.tsx` **prestati zbrajati nulu tiho**: ukupni iznos mora nositi oznaku da nije potpun ("23,10 € · 2 stavke bez cijene") i ponuditi sekundarni broj "samo poznate cijene". Nikad "0,00 €" kao konačna istina.
- **1 kandidat** → njegova jedinična cijena direktno, **bez prosjeka** (brief to traži), i UI ne prikazuje oznaku "prosjek".
- **Više kandidata** → oznaka na retku: "prosjek N proizvoda" (ikona + tooltip s rasponom min–max i brojem izbačenih), kako brief traži.

### (b) FIX 2 — najmanja kombinacija stvarnih pakiranja koja PREKRIVA tjednu količinu

Redoslijed je obavezan: **prvo Fix 1 (jedinična cijena) → zatim Fix 2 (pakiranja) → pa množenje.**

**Korak 1 — izvor veličina pakiranja (hijerarhija):**
1. **Iz cjenika** gdje je osnova pouzdana: `net_quantity` + `unit` (nakon popravka N8: `net_quantity` normalizirati u deklariranu osnovu — ako je `unit === 'l'` i broj > 50, tumačiti kao ml; isto za kg/g — uz asert/komentar).
2. **Za `kom` proizvode** broj komada vaditi iz **naziva** (`/(\d+)\s*\/\s*1/`, `/(\d+)\s*kom/i`), npr. "10/1" → 10, "6/1" → 6.
3. **Ako ni jedno ni drugo ne postoji** — zadane standardne veličine po kategoriji, kao **implicitna, komentirana i lako zamjenjiva konstanta** (`DEFAULT_PACKAGE_SIZES`), npr.:
   - mlijeko / sok / ulje: `0.5, 1, 2` l
   - brašno / šećer / riža: `0.5, 1, 2, 5` kg
   - jaja: `6, 10` kom
   - voda/ostalo: `1` (jedno pakiranje), uz oznaku "pretpostavljena veličina" u UI-u.
   Komentar u kodu mora izričito reći: *ovo je pretpostavka, zamijeniti stvarnim podacima iz cjenika gdje postoje*.

**Korak 2 — algoritam kombinacije (jednostavan, ali korektan i nikad podcijenjen):**
- Kandidati za kombinaciju su samo veličine pakiranja **u istoj osnovi** kao odabrana jedinična cijena (nikad miješati kg i l).
- Za broj pakiranja k = 1, 2, 3 … (gornja granica npr. 12) pronaći kombinaciju koja **pokriva ≥ potrebno** (`sum(sizes) >= needed`); među valjanima odabrati onu s **najnižom ukupnom cijenom**, pa s najmanje pakiranja. Ovo nije bin-packing optimizator, ali **garantira da nikad ne kupiš manje od potrebnog** — što je i jedini zahtjev iz briefa.
- Rezultat: `{ neededQuantity, purchaseQuantity, packages: [{size, count}], price }`.
- Cijena = prosječna jedinična cijena (Fix 1) × `purchaseQuantity`. **Napomena koju treba zapisati i u kodu i u PR opisu:** kod velikih pakiranja (2 l je po litri jeftinije od 1 l) ovo može malo precijeniti; alternativa je zbrajati stvarne cijene odabranih pakiranja kad ta pakiranja postoje među kandidatima. Preporuka: krenuti s jediničnom cijenom × kupovna količina (kako brief traži), a alternativu ostaviti kao `TODO` s obrazloženjem.
- **Prikaz (brief to izričito traži):** u retku košarice "Treba: 200 ml · Kupuješ: 1 l" — trenutno postoji samo `× N`.

### (c) DIZAJN / UX / UI — jedinstven sustav, mobile-first

**Blokada koju moram otvoreno reći:** za ovaj projekt **nije postavljena dizajn-direkcija** (`design/direction.md` ne postoji). Bez nje ne smijem izmišljati paletu, tipografiju ni "distinktivni potez" i ne smijem krenuti u vizualni prepravak po vlastitim defaultima. Zato je ovdje **plan rada i objektivno izmjereni nedostaci**, a sam izvedbeni dio čeka da direkcija bude zapisana (tada je implementiram doslovno prema njoj, kroz sve ekrane).

Objektivni dio koji ne ovisi o direkciji (i koji se može raditi odmah jer je mjerljiv):
1. **Uvesti slojeve tokena u `globals.css`** i primijeniti ih posvuda: `--radius-{sm,md,lg,pill}`, `--shadow-{sm,md,lg}`, spacing skala (4/8/12/16/24/32/48/64/96) i tipografska skala s `clamp()`. Trenutno: 3 različita zaobljenja, 2 ad hoc sjene, nula spacing tokena (N17).
2. **Paleta, tipografija i "distinktivni potez" iz `design/direction.md`** (kad postoji). Obavezno provjeriti kontrast na stvarnim parovima nakon uvođenja; trenutno padaju `accent-green-ink/80` na `accent-green` (3,21) i `ink-muted` na `gray-100` (4,39) — N15.
3. **Mobile-first 360–390 px, košarica kao ključni ekran:** ukupni iznos po trgovini je **najistaknutiji element** ekrana (trenutno je u kartici iznad liste, ali bez hijerarhije prema ostatku), svaka stavka čitljiva bez horizontalnog rezanja, tab bar s dodirnim površinama ≥ 44 px (N16), "Uredi"/"Obriši" kao prave tipke, ne goli tekst.
4. **Stanja koja sada ne postoje:** skeleton za `/recepti` i `/tjedni-plan` (postoji samo za košaricu), `error.tsx` po ruti s porukom na hrvatskom, **stanje "cjenik nije dostupan / podaci su stari N dana"** s datumom zadnjeg uspješnog dohvata i akcijom "pokušaj ponovno", stanje "nema pouzdanog matcha" na razini ekrana (ne samo po retku), prazna stanja s jasnim pozivom na akciju.
5. **Mikro-interakcije i potvrde:** hover/active na tabovima, gumbima i karticama (150–250 ms, `cubic-bezier(0.16, 1, 0.3, 1)`), glatki prijelaz između tri ekrana, **potvrda nakon brisanja recepta** (trenutno nedostaje, N12) i hvatanje greške brisanja, bez `window.confirm`.
6. **Dosljednost i čistoća:** ukloniti neiskorišteni Geist Mono, ukloniti emoji kao ikonu u `kosarica/loading.tsx:4`, uvesti jednu ikonsku biblioteku (Lucide/Heroicons) za oznake "prosjek", "nema cijene", "staro".
7. **Usporedba Lidl vs Kaufland** je svrha aplikacije (i u `metadata.description`), a danas je skrivena iza dva taba — dodati sažetak "Lidl 41,58 € · Kaufland X € · jeftinije za Y €" iznad liste (to je i mjesto gdje zbroj treba biti najistaknutiji).

### (d) TESTNI PLAN

**Alati (danas ih nema — ovo treba dodati):** projekt nema testni okvir ni `test` script. Predlažem **Vitest** (bez konfiguracije za čisti TS) i `"test": "vitest run"` u `package.json`.

1. **Build / lint / type-check kao kapija:**
   - `npx eslint src` — danas prolazi bez greške i upozorenja (potvrđeno) → mora ostati 0.
   - `npm run build` — mora proći **bez grešaka i upozorenja**; u mom sandboxu nisam mogao dovršiti build (OOM na 1 GB), pa ovo mora netko potvrditi u okolini s više memorije.
   - **Popraviti krhkost type-checka:** na svježem klonu `npx tsc --noEmit` pada s `TS2304: Cannot find name 'LayoutProps'` (`layout.tsx:24`), jer `next-env.d.ts` je u `.gitignore:42`, a `.next/types/**/*.ts` postoji tek nakon builda. Rješenje: u CI-ju pokretati type-check **nakon** `next build`, ili dodati `next typegen`/`next-env.d.ts` u repo.
2. **Automatski testovi za matematiku (najvažnije — to je logika koja se lako pokvari):**
   - **Fix 1:** 0 kandidata → `priceUnavailable`, nema cijene i **ukupni zbroj to prijavljuje**; 1 kandidat → njegova cijena, bez oznake prosjeka; 5 kandidata s jednim ekstremnim outlierom (npr. 1,00 / 1,10 / 1,20 / 1,30 / 30,00) → provjeriti da trimmed mean ne "pojede" stvarni raspon i da aritmetička sredina bila bi očito kriva; kandidati s različitim osnovama (kg vs l vs kom) → isključeni iz prosjeka, ne pomiješani.
   - **Fix 2:** količina manja od najmanjeg pakiranja (200 ml vs najmanje 0,5 l) → kupuje 1 pakiranje; količina koja zahtijeva više pakiranja (1,3 kg brašna, dostupno 0,5/1/2/5 kg) → **pokriveno ≥ 1,3 kg** i to najjeftinijom kombinacijom; 10 kom jaja s pakiranjima 6 i 10 → 10 (ili 2×6), **nikad 1×6**; količina bez poznate veličine pakiranja → zadana veličina iz `DEFAULT_PACKAGE_SIZES` + oznaka pretpostavke; invarijanta koja se testira u svakom slučaju: **`purchaseQuantity >= neededQuantity`**.
   - **Agregacija:** "200 ml" + "0,2 l" → jedan redak (N6); "500 g" + "0,5 kg" → jedan redak; isto ime, različite jedinice koje se ne mogu spojiti → **eksplicitno prijavljeno**, ne tiho.
   - **Regresijski test s pravim podacima:** učitati sačuvani primjerak Kaufland CSV-a (ili mock s 30-ak stvarnih redaka) i provjeriti `mlijeko` / `jaja` / `brašno` / `maslinovo ulje` da ne uparuju kozmetiku i tjesteninu (današnje ponašanje, N1).
3. **Ručni end-to-end (obavezno, minimum 3 recepta s više kandidata):** recepti koji sadrže **maslinovo ulje** (116 kandidata), **mlijeko** (260) i **jaja** (32) → složiti tjedni plan → generirati popis → otvoriti košaricu za **Lidl i Kaufland** → provjeriti: prikazana je prosječna jedinična cijena s oznakom "prosjek N proizvoda", količina je zaokružena na stvarna pakiranja uz prikaz "Treba / Kupuješ", i nijedna stavka nije tiho pala iz zbroja.
4. **Rubni slučajevi okoline:** prazna `products` tablica (mora dati jasnu poruku, ne 0,00 €), prekinut dohvat cjenika (mora dati "podaci su stari N dana"), pad Supabase upita (mora dati `error.tsx`, ne generički ekran).
5. **Mobilno:** proći cijeli tok na širini **360 i 390 px** (košarica prvenstveno), provjeriti dodirne površine ≥ 44 px i da nijedan redak nije odrezan.
6. **Vizualna regresija:** nakon dizajnerskog prolaza ponoviti iste snimke (desktop 1440 × 900 i mobilni 375 × 812) i usporediti s onima u `screenshots/` — svaki ekran mora biti vidljivo bolji, ne samo funkcionalno isti.

---

## 9. Što nisam mogao provjeriti (otvorene neizvjesnosti)

1. **Lidlov CSV: točno značenje stupaca 2 i 3.** Izvor danas ne nudi nijedan `.zip` (N4), a arhiva je nedostupna (Wayback CDX → HTTP 503). Zato je kombinacija `net_quantity: parseNumber(row[2])` + `unit: classifyUnitBasis(row[3])` **rizik, ne potvrđen bug**. Prvi korak nakon popravka dohvata mora biti ispisivanje headera i prvih 20 redaka stvarnog ZIP-a i provjera ovoga.
2. **Je li Lidl stranica trajno promijenila strukturu ili je to privremeno.** Zabilježeno stanje na 29.09.2026: nula `.zip` linkova, najnoviji datum 18.09.2026, dva `href`-a koja vode na 404. Ne tvrdim ništa o uzroku.
3. **Stanje Supabase baze izvan onoga što se vidi na live ekranu.** Nisam imao pristup bazi (vidi poglavlje 1), pa ne znam koliko `price_fetch_log` redaka ima, ni je li Lidl tablica potpuna — zaključak o "7 dana bez uspjeha" temeljim na live prikazu "Zadnje osvježeno: 22. ruj 2026. 09:23".
4. **Produkcijski build** (Vercel) prolazi, ali **lokalni `npm run build` nisam mogao dovršiti** (1 GB RAM). Ne tvrdim da build ima grešku — tvrdim da je u mom sandboxu ubijen.
5. **Stvarne boje i mjere s mobile snimke:** vizualna provjera snimke dala je strukturna zapažanja (fiksni donji tab bar, kartica ukupnog iznosa na vrhu), ali se dva čitanja nisu stopostotno slagala u sitnim detaljima; sve brojke i tekstovi u ovom dokumentu citirani su iz **DOM-a live stranice**, ne iz slike.

---

## 10. Prilozi

**Snimke stanja "prije" (`screenshots/`, snimljeno s https://tjedni-planer.vercel.app, jer lokalno pokretanje nije bilo moguće):**

| Datoteka | Sadržaj |
|---|---|
| `pret-desktop-recepti-1440.png` | Desktop 1440×900 — lista recepata |
| `pret-desktop-tjedni-plan-1440.png` | Desktop 1440×900 — tjedni plan |
| `pret-desktop-kosarica-1440.png` | Desktop 1440×900 — košarica (Lidl tab) |
| `pret-mobile-recepti-375.png` | Mobilni 375×812 — lista recepata |
| `pret-mobile-tjedni-plan-375.png` | Mobilni 375×812 — tjedni plan |
| `pret-mobile-kosarica-375.png` | Mobilni 375×812 — košarica (Lidl tab) |

**Pomoćne skripte (scratch, u `.qa/`, ne idu u commit):**
- `.qa/behaviour_probe.ts` — dohvaća **stvarni** Kaufland cjenik i propušta ga kroz stvarne `fetchKauflandProducts` → `buildProductIndex` → `matchProduct` → `calculateItemPrice`.
- `.qa/csv_probe.mjs` — analiza stupaca stvarnog Kaufland CSV-a.
- `.qa/lidl_probe.mjs` — provjera postoji li danas `.zip` link na Lidl stranici cjenika.

**Stanje repozitorija nakon audita:** aplikacijski kod nepromijenjen; `package-lock.json` koji je `npm install` bio prepisao vraćen je na stanje iz commita. Ništa nije commitano ni pushano.
