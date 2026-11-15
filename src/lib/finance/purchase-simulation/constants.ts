/** Client-safe constants for the purchase simulation (no server imports). */
export const MSI_MONTH_OPTIONS = [3, 6, 9, 12, 18, 24] as const;
export const CREDIT_MAX_MONTHS = 360;
export const DEFAULT_CREDIT_PAYMENT_DAY = 5;
/** Days assumed when a card has no cutoff or due day (shown as a data gap). */
export const ASSUMED_CUTOFF_DAY = 1;
export const ASSUMED_DUE_DAY = 20;
