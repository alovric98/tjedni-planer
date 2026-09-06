import { RecipeForm } from "../RecipeForm";

export default function NoviReceptPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Novi recept</h1>
      <div className="mt-4">
        <RecipeForm mode="create" />
      </div>
    </div>
  );
}
