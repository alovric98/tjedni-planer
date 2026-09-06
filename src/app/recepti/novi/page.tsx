import type { Metadata } from "next";
import { RecipeForm } from "../RecipeForm";

export const metadata: Metadata = { title: "Novi recept" };

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
