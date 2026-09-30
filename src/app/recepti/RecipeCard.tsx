import Link from "next/link";
import { formatQuantity } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { iconButtonClasses } from "@/components/ui/Button";
import { PencilIcon } from "@/components/ui/icons";
import { DeleteRecipeButton } from "./DeleteRecipeButton";

// Prvih nekoliko sastojaka je uvijek vidljivo, ostali su iza "+N više".
const VISIBLE_INGREDIENTS = 4;

type Ingredient = { name: string; quantity: number; unit: string };

function IngredientList({ items }: { items: Ingredient[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((ing, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-label">
          <span className="min-w-0 text-ink">{ing.name}</span>
          <span className="shrink-0 tabular-nums text-ink-muted">
            {formatQuantity(ing.quantity)} {ing.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

type RecipeCardProps = {
  id: string;
  name: string;
  ingredients: Ingredient[];
};

export function RecipeCard({ id, name, ingredients }: RecipeCardProps) {
  const visible = ingredients.slice(0, VISIBLE_INGREDIENTS);
  const hidden = ingredients.slice(VISIBLE_INGREDIENTS);

  return (
    <article className="rounded-surface border border-border bg-surface-1 shadow-raised transition-colors duration-150 hover:border-border-strong focus-within:border-border-strong">
      <div className="flex items-start justify-between gap-3 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="min-w-0">
          <h2 className="text-heading font-semibold text-ink [overflow-wrap:anywhere]">{name}</h2>
          <div className="mt-1.5">
            <Badge>
              {ingredients.length} {ingredients.length === 1 ? "sastojak" : "sastojaka"}
            </Badge>
          </div>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center">
          <Link
            href={`/recepti/${id}/uredi`}
            aria-label={`Uredi recept ${name}`}
            title="Uredi"
            className={iconButtonClasses()}
          >
            <PencilIcon className="h-[1.125rem] w-[1.125rem]" />
          </Link>
          <DeleteRecipeButton id={id} name={name} />
        </div>
      </div>

      {ingredients.length > 0 && (
        <div className="px-4 pb-3 sm:px-5">
          <IngredientList items={visible} />
          {hidden.length > 0 && (
            <details className="group/more">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-label font-semibold text-accent-fg marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="group-open/more:hidden">+{hidden.length} više</span>
                <span className="hidden group-open/more:inline">Prikaži manje</span>
              </summary>
              <IngredientList items={hidden} />
            </details>
          )}
        </div>
      )}
    </article>
  );
}
