ALTER TABLE "Category" ADD COLUMN "icon" TEXT;

UPDATE "Category"
SET "icon" = CASE
  WHEN lower("name") IN ('comida', 'super', 'carne') THEN '🍽️'
  WHEN lower("name") IN ('transporte', 'trnasporte') THEN '🚗'
  WHEN lower("name") IN ('vivienda', 'casa', 'renta') THEN '🏠'
  WHEN lower("name") LIKE '%suscrip%' THEN '🔁'
  WHEN lower("name") LIKE '%tarjeta%' THEN '💳'
  WHEN lower("name") IN ('salidas', 'entretenimiento') THEN '🎬'
  WHEN lower("name") IN ('medicamentos', 'salud') THEN '💊'
  WHEN lower("name") LIKE '%inversion%' THEN '📈'
  WHEN lower("name") LIKE '%apoyo%' THEN '🤝'
  WHEN lower("name") LIKE '%prestamo%' THEN '🏦'
  ELSE NULL
END
WHERE "icon" IS NULL;
