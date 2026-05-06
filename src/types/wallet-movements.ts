export type WalletMovementKind = 'expense' | 'income';

export type WalletMovement = {
  id: number;
  kind: WalletMovementKind;
  date: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
  category: string | null;
  fortnightYear: number | null;
  fortnightMonth: number | null;
  fortnightPeriod: 'FIRST' | 'SECOND' | null;
};

export type WalletDetail = {
  id: number;
  name: string;
  provider_icon_key: string | null;
  type: string;
  amount: number;
  credit_limit: number | null;
  temporary_credit_limit: number | null;
  active: boolean;
};

export type WalletMovementsResponse = {
  wallet: WalletDetail;
  range: { from: string; to: string };
  movements: WalletMovement[];
  totals: { inflow: number; outflow: number; net: number };
};

export type WalletImportRow = {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: WalletMovementKind;
};

export type WalletImportResult = {
  imported: number;
  skipped: number;
  errors: { line: number; message: string }[];
};
