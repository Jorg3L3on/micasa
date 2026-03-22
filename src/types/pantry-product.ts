export type PantryProductDto = {
  id: number;
  name: string;
  description: string | null;
  barcode: string | null;
  brand: string | null;
  unit_label: string | null;
  default_unit_price: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};
