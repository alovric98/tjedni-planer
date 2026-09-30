import type { Metadata } from "next";
import { RecipeForm } from "../RecipeForm";

export const metadata: Metadata = { title: "Novi recept" };

export default function NoviReceptPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-title text-ink">Novi recept</h1>
      <div className="mt-4">
        <RecipeForm mode="create" />
      </div>
    </div>
  );
}
