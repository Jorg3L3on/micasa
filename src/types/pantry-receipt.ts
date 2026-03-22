export type PantryReceiptLineDto = {
  id: number;
  receipt_id: number;
  sort_order: number;
  description: string;
  quantity: number;
  unit_label: string | null;
  unit_price: number | null;
  line_total: number;
};

export type PantryReceiptListItemDto = {
  id: number;
  title: string | null;
  currency: string;
  purchased_at: string | null;
  grand_total: number | null;
  line_count: number;
  lines_sum: number;
  file_name: string | null;
  parse_warnings: string[];
  created_at: string;
  created_by_user_id: number;
};

export type PantryReceiptDetailDto = {
  id: number;
  title: string | null;
  merchant_ref: string | null;
  currency: string;
  purchased_at: string | null;
  subtotal: number | null;
  discount_total: number | null;
  delivery_fee: number | null;
  grand_total: number | null;
  file_name: string | null;
  file_mime: string | null;
  has_file: boolean;
  parse_warnings: string[];
  created_at: string;
  updated_at: string;
  created_by_user_id: number;
  lines: PantryReceiptLineDto[];
};
