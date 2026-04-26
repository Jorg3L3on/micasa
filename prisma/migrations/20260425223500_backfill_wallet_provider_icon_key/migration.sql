UPDATE "Wallet"
SET "provider_icon_key" = CASE
  WHEN lower(name) LIKE '%banamex%' THEN 'BANAMEX'
  WHEN lower(name) LIKE '%bbva%' THEN 'BBVA'
  WHEN lower(name) LIKE '%santander%' THEN 'SANTANDER'
  WHEN lower(name) LIKE '%c&a%' OR lower(name) LIKE '%ca %' OR lower(name) = 'ca' THEN 'CA'
  WHEN lower(name) LIKE '%didi%' THEN 'DIDI'
  WHEN lower(name) LIKE '%liverpool%' THEN 'LIVERPOOL'
  WHEN lower(name) LIKE '%mercado pago%' THEN 'MERCADO_PAGO'
  WHEN lower(name) LIKE '%mercado libre%' THEN 'MERCADO_LIBRE'
  WHEN lower(name) LIKE '%paypal%' THEN 'PAYPAL'
  WHEN lower(name) LIKE '%sears%' THEN 'SEARS'
  WHEN type = 'CASH' THEN 'CASH_GENERIC'
  ELSE 'GENERIC_BANK'
END
WHERE "provider_icon_key" IS NULL;
