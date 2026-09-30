"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/normalize";
import { generateShoppingList } from "./actions";

// Najviše arhiviranih popisa po korisniku - kad se arhivira 11., najstariji
// se tiho briše (vidi toggleListItem).
const MAX_ARCHIVED_LISTS = 10;

export type PersistedListItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
};

export type PersistedList = {
  id: string;
  createdAt: string;
  archivedAt: string | null;
  items: PersistedListItem[];
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Nisi prijavljen.");
  }
  return { supabase, user };
}

type ItemRow = { id: string; name: string; quantity: number; unit: string; checked: boolean };

function mapItems(rows: ItemRow[]): PersistedListItem[] {
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name, "hr"))
    .map((r) => ({ id: r.id, name: r.name, quantity: r.quantity, unit: r.unit, checked: r.checked }));
}

export async function getActiveList(): Promise<PersistedList | null> {
  const { supabase, user } = await requireUser();

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id, created_at, archived_at, shopping_list_items(id, name, quantity, unit, checked)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!list) return null;

  return {
    id: list.id,
    createdAt: list.created_at,
    archivedAt: list.archived_at,
    items: mapItems(list.shopping_list_items),
  };
}

export async function getArchivedLists(): Promise<PersistedList[]> {
  const { supabase, user } = await requireUser();

  const { data: lists } = await supabase
    .from("shopping_lists")
    .select("id, created_at, archived_at, shopping_list_items(id, name, quantity, unit, checked)")
    .eq("user_id", user.id)
    .eq("status", "archived")
    .order("archived_at", { ascending: false })
    .limit(MAX_ARCHIVED_LISTS);

  return (lists ?? []).map((list) => ({
    id: list.id,
    createdAt: list.created_at,
    archivedAt: list.archived_at,
    items: mapItems(list.shopping_list_items),
  }));
}

/**
 * (Re)generira aktivan popis iz trenutnog tjednog plana. Zadržava "checked"
 * stanje za stavke koje i dalje postoje (isti item_key kao prije), dodaje
 * nove stavke kao neoznačene, i briše stavke koje više nisu dio plana.
 */
export async function regenerateActiveList(): Promise<PersistedList> {
  const { supabase, user } = await requireUser();

  const ingredients = await generateShoppingList();

  const { data: existingList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  let listId = existingList?.id;

  if (!listId) {
    const { data: created, error: createError } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, status: "active" })
      .select("id")
      .single();
    if (createError || !created) {
      throw new Error(`Greška kod kreiranja popisa: ${createError?.message ?? "nepoznata greška"}`);
    }
    listId = created.id;
  }

  const { data: existingItems } = await supabase
    .from("shopping_list_items")
    .select("id, item_key")
    .eq("list_id", listId);

  const existingByKey = new Map((existingItems ?? []).map((i) => [i.item_key, i.id]));
  const nextKeys = new Set<string>();

  for (const ingredient of ingredients) {
    const key = `${normalize(ingredient.name)}|${ingredient.unit}`;
    nextKeys.add(key);
    const existingId = existingByKey.get(key);

    if (existingId) {
      await supabase
        .from("shopping_list_items")
        .update({ name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit })
        .eq("id", existingId);
    } else {
      await supabase.from("shopping_list_items").insert({
        list_id: listId,
        item_key: key,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        checked: false,
      });
    }
  }

  const staleIds = (existingItems ?? []).filter((i) => !nextKeys.has(i.item_key)).map((i) => i.id);
  if (staleIds.length > 0) {
    await supabase.from("shopping_list_items").delete().in("id", staleIds);
  }

  revalidatePath("/tjedni-plan");

  const refreshed = await getActiveList();
  if (!refreshed) {
    throw new Error("Popis nije pronađen nakon generiranja.");
  }
  return refreshed;
}

export type ToggleResult = {
  list: PersistedList | null;
  archived: boolean;
  prunedOld: boolean;
};

/**
 * Označava/odznačava stavku. Kad su SVE stavke popisa označene, cijeli
 * popis prelazi u "archived" (pada u "Prijašnje liste"). Nakon arhiviranja
 * se čuva max MAX_ARCHIVED_LISTS arhiviranih popisa po korisniku - ako ih
 * ima više, najstariji se tiho briše (prunedOld=true javlja pozivatelju da
 * prikaže toast).
 */
export async function toggleListItem(itemId: string): Promise<ToggleResult> {
  const { supabase, user } = await requireUser();

  const { data: item, error: itemError } = await supabase
    .from("shopping_list_items")
    .select("id, checked, list_id")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    throw new Error("Stavka nije pronađena.");
  }

  const nextChecked = !item.checked;
  await supabase
    .from("shopping_list_items")
    .update({ checked: nextChecked, checked_at: nextChecked ? new Date().toISOString() : null })
    .eq("id", item.id);

  const { data: siblings } = await supabase
    .from("shopping_list_items")
    .select("checked")
    .eq("list_id", item.list_id);

  const allChecked = (siblings ?? []).length > 0 && (siblings ?? []).every((s) => s.checked);

  let archived = false;
  let prunedOld = false;

  if (allChecked) {
    await supabase
      .from("shopping_lists")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", item.list_id);
    archived = true;

    const { data: archivedLists } = await supabase
      .from("shopping_lists")
      .select("id, archived_at")
      .eq("user_id", user.id)
      .eq("status", "archived")
      .order("archived_at", { ascending: false });

    const excess = (archivedLists ?? []).slice(MAX_ARCHIVED_LISTS);
    if (excess.length > 0) {
      await supabase
        .from("shopping_lists")
        .delete()
        .in("id", excess.map((l) => l.id));
      prunedOld = true;
    }
  }

  revalidatePath("/tjedni-plan");

  const list = archived ? null : await getActiveList();
  return { list, archived, prunedOld };
}
