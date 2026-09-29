import Link from "next/link";
import { formatQuantity } from "@/lib/format";
import { DeleteRecipeButton } from "./DeleteRecipeButton";

type RecipeCardProps = {
  id: string;
  name: string;
  ingredients: { name: string; quantity: number; unit: string }[];
};

export function RecipeCard({ id, name, ingredients }: RecipeCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{name}</h2>
        <div className="flex shrink-0 gap-3 pt-0.5 text-sm font-semibold">
          <Link href={`/recepti/${id}/uredi`} className="text-ink">
            Uredi
          </Link>
          <DeleteRecipeButton id={id} />
        </div>
      </div>
      <span className="mt-1 inline-block rounded-lg bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
        {ingredients.length} {ingredients.length === 1 ? "sastojak" : "sastojaka"}
      </span>
      <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
        {ingredients.map((ing, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
            {ing.name} — {formatQuantity(ing.quantity)} {ing.unit}
          </li>
        ))}
      </ul>
    </div>
  );
}
