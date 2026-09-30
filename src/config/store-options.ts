export type StoreKey = "lidl" | "kaufland" | "tommy" | "studenac" | "konzum";

export type StoreOption = {
  key: StoreKey;
  label: string;
  /** Ima li trgovina live cijene danas - vidi src/config/stores.ts, src/lib/price-fetch/*. */
  available: boolean;
};

// Generički popis trgovina za onboarding - nova trgovina (kad dobije live
// cjenik) postaje "available: true", bez promjene onboarding UI-a ili
// filtriranja u Košarici.
export const STORE_OPTIONS: StoreOption[] = [
  { key: "lidl", label: "Lidl", available: true },
  { key: "kaufland", label: "Kaufland", available: true },
  { key: "tommy", label: "Tommy", available: false },
  { key: "studenac", label: "Studenac", available: false },
  { key: "konzum", label: "Konzum", available: false },
];
