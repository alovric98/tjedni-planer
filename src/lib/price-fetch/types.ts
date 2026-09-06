export type UnitBasis = "kg" | "l" | "kom";

export type ParsedProduct = {
  code: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  net_quantity: number | null;
  unit: UnitBasis | null;
  price: number;
  unit_price: number | null;
  category: string | null;
};
