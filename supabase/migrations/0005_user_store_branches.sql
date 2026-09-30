-- Poslovnica (točna lokacija) po odabranoj trgovini. Cijene se razlikuju po
-- poslovnici, pa uz lanac (store_key) pamtimo i koju poslovnicu korisnik koristi.
-- branch_key je stabilan identifikator iz javnog cjenika lanca (Lidl: broj
-- poslovnice, Kaufland: šifra poslovnice), branch_label je tekst za prikaz.
-- Oba su nullable: postojeći korisnici još nemaju odabranu poslovnicu, a
-- onboarding se ne smije blokirati ako javni popis poslovnica nije dostupan.
-- RLS politika iz 0003 već pokriva nove stupce.
alter table user_stores
  add column if not exists branch_key text,
  add column if not exists branch_label text;
