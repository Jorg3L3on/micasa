export type ShoppingStore =
  | 'BODEGA_AURRERA'
  | 'SORIANA'
  | 'CHEDRAUI'
  | 'WALMART'
  | 'SAMS_CLUB';

export type ShoppingStoreOption = {
  value: ShoppingStore;
  label: string;
  shortLabel: string;
  brandClassName: string;
  logoPath?: string;
};

export const SHOPPING_STORE_OPTIONS: ShoppingStoreOption[] = [
  {
    value: 'BODEGA_AURRERA',
    label: 'Bodega Aurrera',
    shortLabel: 'BA',
    brandClassName: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
  {
    value: 'SORIANA',
    label: 'Soriana',
    shortLabel: 'SO',
    brandClassName: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  {
    value: 'CHEDRAUI',
    label: 'Chedraui',
    shortLabel: 'CH',
    brandClassName: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  {
    value: 'WALMART',
    label: 'Walmart',
    shortLabel: 'WM',
    brandClassName: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  {
    value: 'SAMS_CLUB',
    label: "Sam's Club",
    shortLabel: 'SC',
    brandClassName: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
];

export const SHOPPING_STORE_LABELS: Record<ShoppingStore, string> =
  Object.fromEntries(
    SHOPPING_STORE_OPTIONS.map((o) => [o.value, o.label]),
  ) as Record<ShoppingStore, string>;

export const SHOPPING_STORE_MAP = new Map(
  SHOPPING_STORE_OPTIONS.map((store) => [store.value, store]),
);

export const getShoppingStoreOption = (store?: ShoppingStore | null) => {
  if (!store) return null;
  return SHOPPING_STORE_MAP.get(store) ?? null;
};
