-- Optional captured issuer minimum and annual rates on a card wallet.
-- Nullable, no defaults: missing data stays unknown (null is not 0 and not 36%).
ALTER TABLE "Wallet" ADD COLUMN "minimum_payment" DECIMAL(10,2);
ALTER TABLE "Wallet" ADD COLUMN "apr_annual" DECIMAL(8,6);
ALTER TABLE "Wallet" ADD COLUMN "cat_annual" DECIMAL(8,6);
