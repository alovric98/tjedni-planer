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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium text-gray-900">{name}</h2>
        <div className="flex shrink-0 gap-3 text-sm">
          <Link href={`/recepti/${id}/uredi`} className="text-emerald-700">
            Uredi
          </Link>
          <DeleteRecipeButton id={id} />
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-gray-500">
        {ingredients.map((ing, i) => (
          <li key={i}>
            {ing.name} — {formatQuantity(ing.quantity)} {ing.unit}
          </li>
        ))}
      </ul>
    </div>
  );
}
