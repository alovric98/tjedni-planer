-- Prelazak s upsert-a na dnevni delete+insert (Faza 4) - unique constraint
-- više nije potreban za ispravnost, a stvarni cjenici sadrže prave duplikate
-- (code, barcode) redaka koje ne bi trebalo odbaciti.
alter table products drop constraint if exists products_store_code_barcode_key;
