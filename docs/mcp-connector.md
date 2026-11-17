# MCP connector (Grok Bot / Cursor / Claude / ChatGPT)

MiCasa expone un servidor [MCP](https://modelcontextprotocol.io) HTTP en `POST /api/mcp` para conectar agentes externos (Grok Bot, Cursor, Claude, ChatGPT u otro cliente MCP con soporte de Streamable HTTP). Las tools llaman directamente a los services del dominio (`credit-card.service`, `loan.service`, …) — la UI y las rutas `/api/*` no cambian.

## URL del conector

| Entorno | URL |
|---|---|
| Producción | `https://micasa-three.vercel.app/api/mcp` |
| Local | `http://localhost:3000/api/mcp` |

El endpoint responde `OPTIONS` con CORS abierto (`Authorization`, `Content-Type`, `mcp-protocol-version`, `mcp-session-id`), así que también funcionan clientes MCP que corren en el navegador (Claude web, MCP Inspector). Sin un token válido ninguna tool devuelve datos.

## Autenticación

La cookie de NextAuth **no** sirve para conectores MCP. Hay **dos caminos** compatibles:

| Camino | Clientes típicos | Cómo se obtiene |
|---|---|---|
| **Bearer `micasa_…`** | Grok Bot, Cursor, Claude (header manual) | Ajustes → Conexiones → Nueva conexión |
| **OAuth 2.1** | ChatGPT (conector estándar / Developer Mode con OAuth) | Login MiCasa en pantalla de consentimiento; DCR automático |

Ambos identifican al **mismo usuario** de MiCasa y respetan scopes `read` / `write`. Desde **v1.3.9**, cada llave o grant OAuth lleva además una **allow-list de contextos** (cuenta personal y/o casas). El enforcer se aplica en **cada tool** — no es un filtro del chat.

### Contextos visibles (v1.3.9)

Al conectar (OAuth o llave Bearer) eliges qué contextos ve el cliente:

- **Cuenta personal** (`owner_type: "user"`, `owner_id` = tu user_id)
- **Cada casa** donde eres miembro (`owner_type: "house"`, `owner_id` = id de la casa)

Reglas:

1. **Mínimo uno** al autorizar OAuth o crear una llave en Ajustes → Conexiones.
2. La allow-list se guarda en la base (tabla `AgentConnectionAllowedContext`), editable después en Conexiones sin re-login del cliente.
3. **`list_houses`** solo devuelve contextos permitidos (y `personalContext: null` si la personal no está autorizada).
4. Cualquier otra tool con un `owner_id` fuera de la lista → error explícito (`FORBIDDEN`), nunca éxito vacío silencioso.
5. Sigue exigiéndose **membresía** a la casa; si te sacan de una casa, desaparece aunque siga en el grant.
6. **Llaves/grants existentes sin filas** en la allow-list → **fail closed** (no ven nada). Re-conecta o edita en Conexiones.

### OAuth (ChatGPT y clientes sin campo Token)

MiCasa implementa OAuth 2.1 + PKCE para el recurso MCP:

- **Protected Resource Metadata (RFC 9728):** `GET /.well-known/oauth-protected-resource` (también `…/api/mcp`).
- **Authorization Server Metadata (RFC 8414):** `GET /.well-known/oauth-authorization-server`.
- **Dynamic Client Registration (RFC 7591):** `POST /api/oauth/register` — ChatGPT **no** necesita un client id preconfigurado.
- **Client ID Metadata Documents (CIMD):** soportado cuando `client_id` es una URL HTTPS con metadata JSON.
- **Flujo:** authorization code + PKCE (`S256`) + parámetro `resource` (RFC 8707) apuntando a la URL del MCP.
- **PKCE obligatorio en todo canje (v2.2.1):** `/api/oauth/token` exige un `code_verifier` válido para cada código, sin excepción. El `client_id` del canje debe ser el mismo del código (única excepción: dos CIMD en hosts de OpenAI, `chatgpt.com` / `chat.openai.com`). Un código es de un solo uso: si se presenta otra vez, se revocan los grants emitidos con él.
- **Token endpoint auth (metadata):** el authorization server anuncia solo `none` y `client_secret_post` en `token_endpoint_auth_methods_supported`, para que clientes como ChatGPT usen PKCE (`none`). `private_key_jwt` no se ofrece: si un cliente CIMD envía `client_assertion`, se ignora y nunca sustituye al `code_verifier`.
- **Audience (RFC 8707):** solo se emiten tokens para este servidor MCP. `resource` ausente equivale a la URL del MCP; uno distinto responde `invalid_target`. `/api/mcp` rechaza (401) un token cuyo grant se emitió para otro `resource`.
- **Access token:** prefijo `micasa_oauth_…`, enviado como `Authorization: Bearer` en `/api/mcp`.
- **Revocación:** Ajustes → Conexiones → sección **Conexiones OAuth**.

#### Vida de los tokens

| Credencial | Vida | Notas |
|---|---|---|
| Código de autorización | 10 min | Un solo uso; reusarlo revoca los grants emitidos con él |
| Access token OAuth | 24 h | El cliente lo renueva con el refresh token sin volver a pedir login |
| Refresh token | 365 días | Rota en cada uso y la vida se renueva; presentar uno ya rotado revoca el grant completo |
| Llave Bearer `micasa_…` | Hasta revocarla | Sin cambios |

Las conexiones OAuth creadas antes de v2.2.1 conservan su access token actual (90 días) hasta el siguiente refresh; su refresh token vence 365 días después de creada la conexión.

#### Registro dinámico (DCR): reglas de URIs

`POST /api/oauth/register` valida la metadata antes de crear el cliente:

- `redirect_uris`: `https://` en cualquier host; `http://` solo en loopback (`localhost`, `127.0.0.1`, `[::1]`); o un esquema privado reverse-DNS (`com.ejemplo.app:/cb`, RFC 8252). Sin fragmento (`#`) ni usuario/contraseña. Cualquier otra (`javascript:`, `data:`, `http://otro-host`) → `400 invalid_redirect_uri`.
- `client_uri` y `logo_uri`: solo `https://` → si no, `400 invalid_client_metadata`.
- `client_name` se recorta a 60 caracteres. La pantalla de consentimiento muestra junto al nombre el **origen** del cliente (host del CIMD, o "Registro dinámico · host de la redirección"), porque el nombre lo declara el propio cliente.
- El POST de consentimiento solo se acepta desde la propia app (`Origin` same-origin); cualquier otro origen → 403.

#### Conectar ChatGPT (OAuth)

1. En ChatGPT: **Settings → Connectors → Developer Mode** (activar).
2. **Add connector** → URL del servidor MCP (`https://…/api/mcp`).
3. **Autenticación: OAuth** — deja client id / secret vacíos; ChatGPT usa DCR contra `/api/oauth/register`.
4. Al conectar, inicia sesión en MiCasa y aprueba en la pantalla de consentimiento (**marca al menos un contexto**).
5. Prueba con la tool `list_houses`.

### Bearer token (Grok / Cursor / Claude)

Se usa un **token de agente** (`micasa_…`) enviado como `Authorization: Bearer`. El token identifica a un usuario de MiCasa; solo se guarda su hash SHA-256 (tabla `ApiKey`) — el token tiene 256 bits de entropía, así que la verificación es sub-milisegundo en cada tool call sin sacrificar seguridad. Las llaves creadas antes del cambio (hash bcrypt) siguen funcionando y se migran solas al nuevo formato en su siguiente uso.

#### Crear un token (UI — recomendado)

1. Inicia sesión y ve a **Ajustes → Conexiones** (`/settings/connections`).
2. Pulsa **Nueva conexión**, ponle nombre (p. ej. "Grok Bot"), **elige contextos visibles**, activa **Permitir escritura** solo si el agente debe registrar compras/pagos/ajustes y elige una **expiración** opcional (30/90/365 días); al vencer, el token deja de funcionar solo.
3. Copia el token que se muestra — **solo se muestra una vez**.

Desde la misma página puedes **renombrar**, **editar contextos** y **revocar** conexiones Bearer (la revocación es inmediata) y **editar contextos / revocar conexiones OAuth** en la sección dedicada.

#### Crear un token (script — ops/emergencia)

```bash
node scripts/mint-agent-token.mjs --email tu@correo.com --name "Grok Bot" --scopes read,write
```

- `--scopes read` — solo lectura (list/get).
- `--scopes read,write` — también writes (compras, pagos externos, MSI, ajustes).

Revocar por script:

```bash
node scripts/mint-agent-token.mjs --revoke micasa_XXXXXXXX
```

## Modelo de contexto

El token es **tu usuario**; cada tool elige el contexto financiero con `owner_type` + `owner_id`. Solo los contextos en la **allow-list** del token/grant son válidos:

1. Llama `list_houses` primero — devuelve tu `user_id`, `personal_context` (si está permitida) y las casas autorizadas, cada una con `owner_type` / `owner_id`.
2. Pasa `owner_type: "house", owner_id: <id>` (casa compartida) o `owner_type: "user", owner_id: <tu userId>` (finanzas personales) en todas las demás tools.

La pertenencia a la casa se valida en cada llamada (mismas reglas que `getOwnerContext` en la app).

## Tools v3

`serverInfo.version` **3.0.0**: 41 tools (antes 70). Convenciones comunes:

- **Contexto.** Todas las tools (excepto `list_houses`) requieren `owner_type` + `owner_id`, tal como los devuelve `list_houses`. Durante v3 se aceptan también `ownerType` / `ownerId` como alias de entrada (si llegan ambos, gana la clave snake_case); el alias no aparece en `tools/list` y **se retira en v4.0.0, no antes del 31 de enero de 2027**.
- **Referencias.** Billeteras y categorías se indican por **id o nombre** (`wallet_id` / `wallet_name`, `category_id` / `category_name`). Nombre ambiguo → `AMBIGUOUS_REF` con `candidates` (`id`, `name`).
- **Entrada estricta.** Cada campo de entrada tiene descripción en `tools/list`. Una clave que no está en el schema (p. ej. `wallet_nmae`) devuelve `VALIDATION` con el nombre de la clave; no se descarta en silencio. Las fechas `YYYY-MM-DD` deben existir en el calendario (`2025-02-30` se rechaza). Los campos que no aplican al tipo (p. ej. `credit_limit` en una billetera CASH, `source` en una plantilla de gasto) devuelven `VALIDATION`.
- **Anotaciones.** Todas declaran `openWorldHint: false`; las de lectura `readOnlyHint: true`. `delete`, `adjust_balance` y `regenerate_from_templates` llevan `destructiveHint: true` y piden `confirm: true`; `create_month`, `update_*`, `upsert_*` y `adjust_balance` llevan `idempotentHint: true`. `delete` no es idempotente (el segundo borrado responde `NOT_FOUND`).

#### Respuestas

- **Forma.** JSON compacto con claves **snake_case** en todas las tools; montos como `number`; fechas como `YYYY-MM-DD` (día civil de Ciudad de México). Los mapas por nombre se publican como arreglos (`list_expenses.totals.by_wallet: [{name, amount}]`).
- **`outputSchema`.** Las 16 tools de lectura publican `outputSchema` y devuelven el mismo objeto en `structuredContent` y como texto. El schema lista los campos principales; la respuesta puede traer campos adicionales (p. ej. las secciones de `get_card`).

#### Paginación

Toda tool `list_*` acepta `limit` (1-200, default 50) y `offset` (default 0) y responde `{ <lista>, total_count, limit, offset }`: `list_houses.houses`, `list_wallets.wallets`, `list_movements.movements`, `list_expenses.expenses`, `list_incomes.incomes`, `list_categories.categories`, `list_budgets.budgets`, `list_templates.templates`, `list_loans.loans`, `list_lenders.lenders`, `list_upcoming.items`. `total_count` cuenta todas las filas; los totales de `list_expenses` y `list_movements` cubren el rango completo, no solo la página.

#### Errores

Toda tool responde los errores como `{"error": "…", "code": "…", "hint"?: "…", "candidates"?: [{"id", "name"}]}` con `isError: true`.

| `code` | Cuándo | Qué hacer |
|---|---|---|
| `VALIDATION` | Entrada inválida (clave desconocida, fecha inexistente, campo que no aplica al tipo) o regla de negocio (saldo insuficiente, asignaciones que no suman) | Corregir la entrada; el mensaje dice qué |
| `NOT_FOUND` | El id o nombre no existe en el contexto | Listar con la tool `list_*`; `hint` sugiere cuál |
| `AMBIGUOUS_REF` | Un nombre coincide con varias billeteras | Repetir con el id de `candidates` |
| `CONFIRM_REQUIRED` | Falta `confirm: true` en `delete`, `adjust_balance` o `regenerate_from_templates` | Confirmar con el usuario y repetir con `confirm: true` |
| `FORBIDDEN` | Contexto fuera de la allow-list de la conexión, no eres miembro, o el token no tiene el scope | Usar un contexto de `list_houses` o reconectar con el scope `write` |
| `RATE_LIMITED` | Más de 120 llamadas por minuto en la conexión | Reintentar tras los segundos del `hint` |
| `INTERNAL` | Error inesperado (base de datos, bug) | Reintentar más tarde; el texto real solo queda en el log `mcp.tool.failed` |

### Flujo típico del agente

1. `list_houses` → elige contexto personal o casa.
2. `list_categories` / `list_wallets` → catálogo para gastos e ingresos.
3. `add_expense` / `add_income` / `transfer` según la intención del usuario.

### Lectura (scope `read`)

| Tool | Qué hace |
|---|---|
| `list_houses` | Descubrimiento: userId del token, contexto personal y casas con rol. `include_members: true` agrega los miembros de cada casa. |
| `list_wallets` | Billeteras: efectivo/débito (saldo), tarjetas (deuda, límite, crédito disponible, corte, pago) y metas (objetivo, progreso). `type: all\|funding\|credit\|goal`. |
| `list_movements` | Movimientos de una billetera. Efectivo/débito/meta: gastos, ingresos, transferencias y pagos a tarjeta con totales. Tarjeta: compras, pagos, cuotas programadas y MSI (default ciclo vigente, `use_current_cycle`). |
| `get_card` | Deuda, límite y corte de una tarjeta + secciones de `include`: `statement` (default), `movements`, `installments`, `reconciliation`, `cycle_reconciliation`. |
| `list_expenses` | Gastos por rango (`from`/`to`, `last_n_days`, `last_n_months`, filtros), paginados con `limit`/`offset`/`total_count`. |
| `list_incomes` | Ingresos de una quincena (`fortnight_id` o `year`+`month`+`period`). |
| `list_categories` | Catálogo de categorías (`kind: expense\|income\|all`). |
| `list_budgets` | Presupuestos activos: tope, gastado, restante, asignaciones. |
| `list_templates` | Plantillas recurrentes en un solo arreglo `templates` (cada una con `kind`); filtro `kind: expense\|income\|all`. |
| `list_loans` | Préstamos; `year` + `month` agrega las cuotas del mes y su total; `include_schedule` agrega el calendario completo; `include_inactive` incluye pagados, pausados y cancelados. |
| `list_lenders` | Prestamistas con capital pendiente y ventana de pago. |
| `get_loan` | Detalle + calendario de un préstamo. |
| `list_upcoming` | Pagos unificados: tarjetas (revolving + MSI) y préstamos. Filtros: `year`/`month`, `period`, `from`/`to`. |
| `get_liquidity` | “Me alcanza hasta…” (misma lógica que Liquidez en la app). |
| `get_period_summary` | Totales de una quincena (con `period`) o del mes. `include_movements: true` (requiere `period`) agrega la quincena y sus gastos. |
| `get_alerts` | Alertas del periodo (ingreso faltante, compromiso alto, vencidos). |

### Escritura (scope `write`)

| Tool | Qué hace | Nota |
|---|---|---|
| `create_wallet` | Alta de billetera, tarjeta o meta | `type`: CASH, DEBIT_CARD, CREDIT_CARD, DEPARTMENT_STORE_CARD (requiere `credit_limit`, `cutoff_day`, `due_day`) o GOAL (requiere `goal_amount`, `goal_due_date`). |
| `update_wallet` | Edita nombre, estado, liquidez, límites, corte/pago o meta | Solo los campos del tipo de la billetera. |
| `adjust_balance` | Fija saldo (efectivo/débito/meta) o deuda (tarjeta) al del banco | `confirm: true`. |
| `transfer` | Entre billeteras de activo y metas | Aportar a / retirar de una meta. No es pago de tarjeta. |
| `transfer_to_house` | Aporte personal → casa (`USER_TO_HOUSE`) | Crea gasto personal + ingreso en la casa. |
| `add_expense` | Gasto en cualquier billetera | En tarjeta es compra (sube deuda); `installment_current` / `installment_total` para MSI. `is_paid`, `already_in_balance`. |
| `update_expense` | Corrige un gasto o lo marca pagado/pendiente | Con solo `is_paid` usa el mismo camino que el toggle de la app. |
| `add_income` / `update_income` | Ingreso en billetera de activo | |
| `create_category` / `update_category` | Categorías | `kind` EXPENSE\|INCOME. |
| `upsert_budget` | Crea o actualiza presupuesto | Sin `budget_id` siempre crea (requiere `name` y `amount`); con `budget_id` actualiza: `name`/`amount` opcionales y `allocations[]` reemplaza las asignaciones. La suma debe igualar `amount`. |
| `create_template` / `update_template` | Plantillas | `kind: expense\|income`. Billetera opcional en ambas (en ingresos, solo efectivo/débito). |
| `create_month` | Crear mes / expandir plantillas | Idempotente. |
| `regenerate_from_templates` | Regenerar quincena desde plantillas | `fortnight_id` o calendario. `confirm: true`. |
| `add_card_payment` | Pago de tarjeta | `mode`: `external` (default) o `wallet` (descuenta billetera MiCasa). Si el monto supera la deuda, `bank_charge.reason`: `INTEREST`, `LATE_FEE` u `OTHER`. |
| `upsert_installment_plan` | Crea (sin `plan_id`) o actualiza un plan MSI | Al actualizar, `paid_installments` es obligatorio. |
| `create_scheduled_payment` | Cuota programada suelta en calendario de tarjeta | |
| `upsert_card_payment_plan` | Monto planeado de pago de tarjeta en quincena | |
| `create_loan` / `update_loan` | Préstamos | |
| `add_loan_payment` | Marca cuotas | `MARK_PAID` (descuenta wallet), `MARK_PAID_EXTERNAL`, `SKIP`; lote con `payment_ids`. |
| `pay_lender` | Paga la ventana de un prestamista | Pago parcial o abono a capital según `amount`. |
| `delete` | Elimina un registro | `kind`: expense, income, category, budget, expense_template, income_template, loan, scheduled_payment. `confirm: true`. |

### Tools retiradas en v3 (reemplazo)

Los clientes que cachearon `tools/list` de v2 (ChatGPT, Claude, Cursor) deben **reconectar** el conector una vez para ver la lista nueva; v3 no anuncia `tools.listChanged` (el handler es stateless y nunca emitía la notificación).

| Tool v2 | Reemplazo v3 |
|---|---|
| `pay_card` | `add_card_payment` con `mode: "wallet"` |
| `add_card_purchase` | `add_expense` con una billetera de crédito (`installment_current` / `installment_total` para MSI) |
| `contribute_goal` | `transfer` con la meta como destino |
| `withdraw_goal` | `transfer` con la meta como origen |
| `create_goal` | `create_wallet` con `type: "GOAL"` |
| `update_goal` | `update_wallet` |
| `list_goals` | `list_wallets` con `type: "goal"` |
| `list_cards` | `list_wallets` con `type: "credit"` |
| `create_card` | `create_wallet` con `type: "CREDIT_CARD"` o `"DEPARTMENT_STORE_CARD"` |
| `update_card` | `update_wallet` |
| `adjust_card_debt` | `adjust_balance` (en tarjetas fija la deuda) |
| `adjust_wallet_balance` | `adjust_balance` |
| `list_wallet_movements` | `list_movements` |
| `list_card_movements` | `list_movements` (tarjeta) |
| `get_card_reconciliation` | `get_card` con `include: ["reconciliation"]` (por tarjeta) |
| `get_card_cycle_reconciliation` | `get_card` con `include: ["cycle_reconciliation"]` |
| `get_installment_portfolio` | `get_card` con `include: ["installments"]` (`installment_portfolio`) |
| `create_installment_plan` | `upsert_installment_plan` sin `plan_id` |
| `update_installment_plan` | `upsert_installment_plan` con `plan_id` |
| `set_expense_paid` | `update_expense` con solo `is_paid` |
| `update_budget_allocations` | `upsert_budget` con `budget_id` + `allocations` |
| `list_expense_templates` / `list_income_templates` | `list_templates` con `kind` |
| `create_expense_template` / `create_income_template` | `create_template` con `kind` |
| `update_expense_template` / `update_income_template` | `update_template` con `kind` |
| `delete_expense_template` / `delete_income_template` | `delete` con `kind: "expense_template"` / `"income_template"` |
| `delete_expense` / `delete_income` / `delete_category` / `delete_budget` / `delete_loan` / `delete_scheduled_payment` | `delete` con `kind` = `expense` / `income` / `category` / `budget` / `loan` / `scheduled_payment` |
| `list_house_members` | `list_houses` con `include_members: true` |
| `get_fortnight` | `get_period_summary` con `period` + `include_movements: true` |

### Reglas de lectura

**v1.3.1:** el transporte HTTP exige Bearer válido antes de `initialize` / `tools/list`; sin token responde **401** + `WWW-Authenticate` con `resource_metadata` (RFC 9728, requerido por ChatGPT OAuth).

Estas reglas alinean las tools de lectura con Panel financiero y Liquidez:

**`list_upcoming(year, month)`** — también acepta `period`, `from`/`to`

- **Por tarjeta y fecha:** `period_total` = suma de cuotas MSI del mes + resto revolving al corte (no el doble del estado de cuenta completo).
- **Cuotas MSI (`CreditCardInstallmentPlan`):** **siempre** aparecen como renglones `msi` cuando su `dueDate` cae en el mes o rango.
- **Resto revolving:** renglón `revolving` aparte cuando hay pago programado/calendario (`scheduled_calendar`) o cuando el monto del corte (`ledger`/`import`/`projection`) excede la suma de MSI del plan en esa misma fecha. Ej.: corte \$1 500 con MSI \$500 → `msi` \$500 + `revolving` \$1 000; resto PIF \$180 + MSI \$650 → ambos renglones.
- **Revolving más allá de la quincena actual/siguiente:** si el planner no tiene fila (sin estado de cuenta ni scheduled), se complementa con obligaciones `credit_card_statement` de `getLiquidityProjection` (mismo horizonte ~180 días que Liquidez).
- **No duplicar:** no apilar el `next_due_payment` íntegro del estado de cuenta **y** las cuotas MSI que ya están dentro de ese total.
- **Préstamos:** toda cuota `SCHEDULED` con `dueDate` en el mes (vía `listLoanPaymentsForPlannerMonth`).
- **`period` FIRST\|SECOND:** filtra ítems cuya fecha cae en esa quincena del mes.
- **`period_total`:** suma de ítems no pagados en la lista deduplicada.

**`get_liquidity`**

- Usa `getLiquidityProjection` (mismo servicio que `/api/wallets/liquidity-projection` y la página Liquidez).
- **`committed_obligations_total` / `net_liquidity`:** solo obligaciones con fecha **≥ `as_of`** dentro del horizonte `until` (no se arrastra deuda vencida como si fuera pagadero mañana).
- **`lasts_until` / `lasts_until_including_income`:** primera fecha de quiebre **futura** (≥ `as_of`), o `null` si el efectivo alcanza en el horizonte.
- **`next_gap`:** primer hueco futuro usando liquidez acumulada **desde `as_of`** (no arrastra deuda vencida en el headroom del milestone).

**`list_expenses`**

- **`totals`:** suma por billetera y categoría en **todo** el rango filtrado (todas las páginas), como arreglos `[{name, amount}]`. Se calcula con una sola agregación en la base.

**`list_movements` (tarjeta)**

- Incluye **`purchase`**, **`payment`**, **`scheduled_payment`** (cuota programada suelta) e **`installment`** (cuota de plan MSI) cuya fecha cae en `from`/`to` o en el ciclo actual (`use_current_cycle`).

### Import de estados de cuenta (fuera de MCP)

La UI importa PDF/CSV vía **multipart/form-data** (`POST /api/credit-cards/:id/statement-imports` y `/preview`). No hay API JSON limpia (URL, filas parseadas o asset id) reutilizable por agentes sin subir el archivo. **No hay tool MCP de import** — sigue en la app web. Si en el futuro se expone un endpoint JSON, se podrá añadir una tool.

## Límites de uso

Cada llave Bearer o grant OAuth tiene un límite de **120 llamadas de tool por minuto** (policy `mcp:tool`). Al excederlo, la tool responde `code: "RATE_LIMITED"` con un `hint` que indica en cuántos segundos reintentar; el límite se evalúa antes de cualquier consulta a la base. Crear llaves también está limitado (10 por hora por usuario).

Los endpoints OAuth públicos tienen límites por IP:

| Policy | Endpoint | Límite |
|---|---|---|
| `oauth:token` | `POST /api/oauth/token` (y alias `/token`, `/oauth/token`) | 30 por minuto |
| `oauth:register` | `POST /api/oauth/register` | 10 por hora |
| `oauth:cimd-resolve` | `client_id` CIMD nuevo (URL que aún no está registrada) | 20 por hora |

Al excederlos la respuesta es `429` con `Retry-After` y cuerpo OAuth `{"error":"temporarily_unavailable"}`; la petición no escribe nada en la base. `OPTIONS` / `GET` del token endpoint no se registran y cada `POST` deja una sola fila en `McpOAuthTokenAttempt`.

> **Alcance del límite:** sin Upstash (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) el contador vive en memoria de cada instancia de Vercel, así que el límite efectivo es por instancia, no global. Para un límite global configura Upstash.

## Conectar el cliente

Todos los clientes usan la misma URL del servidor MCP. La página **Ajustes → Conexiones** muestra snippets con botón de copiar.

**Grok Bot / conector MCP remoto**: agrega un conector tipo Streamable HTTP con la URL de producción y pega el token como Bearer (una sola vez).

**Cursor** (`.cursor/mcp.json` del usuario):

```json
{
  "mcpServers": {
    "micasa": {
      "url": "https://micasa-three.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer micasa_..." }
    }
  }
}
```

**Claude (web o Desktop)**: Settings → Connectors → *Add custom connector*, URL del servidor + header `Authorization: Bearer micasa_...`.

**ChatGPT (OAuth — recomendado)**: Settings → Connectors → Developer Mode → Add connector → URL `https://…/api/mcp` → Autenticación **OAuth**. No hace falta client id: el registro dinámico (DCR) crea el cliente al conectar. Tras login MiCasa, prueba `list_houses`.

**ChatGPT (token manual)**: alternativa en Developer Mode con access token Bearer `micasa_…` de Ajustes → Conexiones.

## Endpoints OAuth (referencia)

| Endpoint | Método | Uso |
|---|---|---|
| `/.well-known/oauth-protected-resource` | GET | Descubrimiento del recurso MCP |
| `/.well-known/oauth-authorization-server` | GET | Metadata del authorization server |
| `/api/oauth/register` | POST | Dynamic Client Registration (RFC 7591) |
| `/api/oauth/authorize` | GET | Inicio authorization code + PKCE |
| `/api/oauth/token` | POST | Intercambio code → access token |
| `/api/oauth/revoke` | POST | Revocación de token |
| `/oauth/consent` | GET | Pantalla de consentimiento (NextAuth) |

## Fuera de alcance (documentado)

- MCP resources/prompts.

## Costos

El endpoint es una función normal de Vercel dentro del mismo proyecto (handler stateless, sin Redis ni sesiones OAuth persistentes en memoria); no agrega servicios ni costos al plan gratuito. El rate limit usa memoria del proceso (o Upstash si ya está configurado por env vars, opcional).
