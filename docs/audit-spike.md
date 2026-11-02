# Spike: actor garantizado en cada escritura (MIC-I7-1)

**Decisión: GO**, con la variante D (proxy de delegates en el cliente raíz) en lugar de la marca "dentro de transacción" en AsyncLocalStorage que proponía el PRD. Detalle abajo.

Código: [`scripts/spikes/audit-spike.ts`](../scripts/spikes/audit-spike.ts) (investigación, no lo importa la app). Corrido el 2026-10-23 con Prisma 7.10.0, `@prisma/adapter-pg` 7.10.0, `@prisma/adapter-neon` 7.10.0 (`@neondatabase/serverless` 1.1.0), Node 26.

| Objetivo | Conexión |
|---|---|
| `pg` | Postgres 14 local (`micasa_audit_spike`, todas las migraciones aplicadas), `adapter-pg`, pool `pg` por defecto (max 10) |
| `neon` | Branch de Neon `mic-i7-1-audit-spike` (copia de producción), endpoint **pooler** (PgBouncer, modo transacción), `adapter-neon` sobre WebSocket, pool por defecto (max 10) |

El trigger de prueba (`audit_spike.row_change()`, en un schema aparte) es un sustituto mínimo de `audit.row_change()`: `to_jsonb(OLD/NEW)`, denylist por regex `password|hash|secret|token`, `changed_fields`, omite UPDATE sin cambios, lee `current_setting('micasa.audit_actor', true)` y marca `missing_actor`. Instalado en `Expense`, `Wallet` y `User`. Las filas de prueba (usuario, quincena, 20 billeteras, gasto) las crea y borra el script; no toca filas reales.

## Las dos variantes probadas

**A — como en el PRD.** La extensión `$allOperations` re-emite una escritura auditada como `prisma.$transaction(tx => tx[model][op](args))`, salvo que AsyncLocalStorage diga "dentro de transacción". Un `Proxy` sobre `$transaction` ejecuta `set_config(…, true)` primero y pone la marca.

**D — alternativa.** El mismo `Proxy` sobre `$transaction` (sin marca). Además, un `Proxy` sobre los delegates de modelo **del cliente raíz** (`prisma.wallet`, `prisma.expense`, …) convierte cada escritura suelta en `$transaction(tx => tx.model.op(args))`. El cliente `tx` nunca se envuelve, así que sus escrituras pasan intactas. El objeto devuelto conserva `requestTransaction` y `Symbol.toStringTag = 'PrismaPromise'` del PrismaPromise original, así que sigue sirviendo dentro de `$transaction([...])`.

La diferencia importa en un caso: código que usa el cliente raíz `prisma` **dentro** del callback de una transacción (por ejemplo, un service que importa `prisma` llamado desde otro que abrió la transacción). En A, la marca de ALS hace que esa escritura pase sin envolver, por otra conexión y sin actor. En D recibe su propia transacción con el actor.

## Resultados

| # | Prueba | pg | neon |
|---|---|---|---|
| 1 | `Proxy` sobre `$transaction` interactivo: `set_config` primero; el trigger ve el JSON del actor | ✅ 2 filas, actor correcto, mismo `txid` | ✅ igual |
| 2 | 20 escrituras auto-envueltas concurrentes (filas distintas), pool por defecto | ✅ A y D: 20/20 con actor, 36 ms–1.2 s según la carga de la máquina | ✅ A y D: 20/20 con actor, 1.3–1.6 s |
| 2 | 20 `increment` concurrentes **sobre la misma fila**, pool max=2 | ✅ A y D: 20/20 (< 2 s) | ⚠️ A y D: `Unable to start a transaction in the given time` (maxWait 2 s por defecto) |
| 2 | Lo mismo con `transactionOptions.maxWait = 20 s` | ✅ A y D: 20/20 | ✅ A y D: 20/20 en 5.5–5.9 s: cola, no deadlock |
| 3 | La extensión aplica a `tx` y no hay doble wrap (3 escrituras dentro de una transacción) | ✅ 1 transacción abierta, 0 re-envueltas | ✅ igual |
| 3 | Cliente raíz usado **dentro** de un callback | ❌ A: fila sin actor (`raw = ''`) · ✅ D: actor correcto | ❌ A · ✅ D |
| 4 | `$transaction([...])` con `set_config` antepuesto | ✅ A y D: 2 filas, mismo `txid`, resultados sin el elemento extra | ✅ igual |
| 5 | Sin fuga: tras una transacción con `set_config(…, true)`, la siguiente en la misma conexión (pool max=1) lo lee | ✅ ve `''` ×5 | ✅ ve `''` ×5 |
| 5 | 30 transacciones concurrentes con `set_config`, luego 30 lecturas sin él (pool max=10) | ✅ 0 fugas, 10 backends | ✅ 0 fugas, 10 backends tras el pooler |
| 5 | Control: `set_config(…, false)` (nivel sesión) | fuga (esperado) | **fuga** (esperado) |
| 6 | Latencia por escritura simple (mediana de 25) | dos corridas: `select 1` 0.2–1.3 ms · plain 2.3–4.4 ms · envuelta +0.1 a +6.9 ms | `select 1` 123 ms · plain 125 ms · envuelta 494 ms (**+370 ms ≈ 3 RTT**) |
| 7 | `Expense` update: `changed_fields`, before/after | ✅ `amount,is_paid`, 102 → 250.5 | ✅ igual |
| 7 | `Wallet` `increment`: before/after exactos; UPDATE sin cambios no escribe | ✅ 2 → 14.34, 1 fila | ✅ igual |
| 7 | `User` update: denylist quita `password` | ✅ `changed_fields = name`, sin `password` | ✅ igual |
| 7 | `deleteMany` de 2 filas | ✅ 2 filas DELETE con `before` | ✅ igual |
| 7 | Escritura sin actor (cliente sin capa) | ✅ `missing_actor`, `raw = NULL` | ✅ `missing_actor`, `raw = ''` |
| 7 | `UPDATE "Wallet" …` crudo desde el MCP de Neon (`run_sql`) | — | ✅ fila `Wallet` 20, `missing_actor = true`, `raw = ''`, `changed_fields = description` |

Resumen: `pg` 20/21 y `neon` 18/21. Las únicas fallas son A con el cliente raíz dentro de un callback (las dos) y el pool de 2 con `maxWait` de 2 s en Neon (que se resuelve con `maxWait`).

## Hallazgos

1. **Un setting vacío también es "sin actor".** Después de una transacción con `set_config(…, true)`, Postgres deja la variable definida en esa sesión con valor `''`, no `NULL`. Tras el pooler de Neon el mismo backend lo comparte otra conexión (el `run_sql` del MCP vio `''`). `audit.row_change()` debe tratar `NULL`, `''` y `'null'` como faltantes. No hay fuga del valor en sí: ninguna transacción vio el JSON de otra.
2. **`set_config(…, false)` sí se fuga** a través del pooler (control del punto 5). El validador de la fase 2 debe prohibirlo fuera de migraciones, como ya dice el ticket.
3. **No hay deadlock.** Ningún camino toma una segunda conexión mientras retiene la primera: el auto-wrap usa una conexión por escritura, igual que hoy. El límite real es `maxWait` (2 s por defecto en Prisma): a 123 ms de RTT, una transacción envuelta dura ~500 ms y una ráfaga de más de ~40 escrituras sueltas (`Promise.all`) por instancia haría cola por encima de 2 s con pool 10. Desde Vercel `iad1` (región por defecto; el proyecto no fija región) a Neon `us-east-1` el RTT es de 1–2 ms, así que en producción el margen es enorme. Aun así, conviene fijar `transactionOptions: { maxWait: 10_000 }` en `src/lib/prisma.ts` como colchón.
4. **Costo: +3 round trips por escritura suelta** (`BEGIN`, `set_config`, `COMMIT`), igual en A, D y D con forma array. Medido desde esta Mac (RTT 123 ms a us-east-1): +370 ms. En producción (Vercel `iad1` ↔ Neon `us-east-1`, RTT ~1–2 ms) se estima **+3–6 ms por escritura**. Las escrituras que ya están dentro de una transacción pagan solo +1 RTT (el `set_config`). No pude medir desde una función de Vercel en este spike: la cifra de producción es una estimación por RTT, no una medición.
5. **Las 44 transacciones con callback del código** (26 archivos) no usan `prisma.<modelo>.<escritura>` léxicamente dentro del callback (escaneo AST), pero un service llamado desde un callback puede usar el `prisma` del módulo y eso no es visible al escaneo. D lo cubre sin depender de disciplina. Hay 2 sitios con `$transaction([...])` y 19 con `$executeRaw`/`$queryRaw`.
6. **Prisma 7 admite `tx.$transaction(...)` anidado** (`kind: "nested"` en el runtime): comparte la transacción de afuera, así que hereda el setting. D no envuelve `tx`, así que no se ve afectado.

## Recomendación para la fase 2 (MIC-I7-3)

- Implementar **D**: `Proxy` sobre `$transaction` (forma callback: `tx.$executeRaw` con `set_config` antes del callback; forma array: `$executeRaw` antepuesto y quitar su resultado) + `Proxy` sobre los delegates de modelos auditados del cliente raíz. AsyncLocalStorage queda solo para el actor (`runWithAuditActor`), no para marcar transacciones.
- D depende de dos detalles internos de `PrismaPromise` para la forma array: `requestTransaction` y `Symbol.toStringTag`. Un test DB-gated debe fijar ese comportamiento para que una actualización de Prisma que lo rompa falle en CI y no en producción.
- `transactionOptions.maxWait = 10_000` en el cliente.
- `audit.row_change()`: `NULL`, `''` y `'null'` = sin actor.
- Validador: prohibir `set_config('micasa.audit_actor', …, false)` y `SET` sin `LOCAL` fuera de `prisma/migrations/**`.

## Fallback (no hace falta)

Si D o A hubieran fallado en pool o fuga: envolver solo los ~47 `$transaction` existentes con el `Proxy` y un codemod que convierta las escrituras sueltas a modelos auditados en transacciones. No se necesita: las dos condiciones de no-go (deadlock de pool sin salida, fuga del setting) no ocurrieron.
