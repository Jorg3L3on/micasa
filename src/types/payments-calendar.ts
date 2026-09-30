export type PaymentsCalendarItemType =
  | 'revolving'
  | 'msi'
  | 'loan'
  | 'expense'
  | 'template';

/** Pending payment row for the Panel financiero calendar (read-only). */
export type PaymentsCalendarItem = {
  date: string;
  type: PaymentsCalendarItemType;
  name: string;
  /** Null when the period payment is unknown. Not the same as 0. */
  amount: number | null;
  sourceId: number;
  /** Spanish short label for the type chip. */
  typeLabel: string;
};

export type PaymentsCalendarResult = {
  year: number;
  month: number;
  items: PaymentsCalendarItem[];
};
