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

- **Cuenta personal** (`ownerType: "user"`, `ownerId` = tu userId)
- **Cada casa** donde eres miembro (`ownerType: "house"`, `ownerId` = id de la casa)

Reglas:

1. **Mínimo uno** al autorizar OAuth o crear una llave en Ajustes → Conexiones.
2. La allow-list se guarda en la base (tabla `AgentConnectionAllowedContext`), editable después en Conexiones sin re-login del cliente.
3. **`list_houses`** solo devuelve contextos permitidos (y `personalContext: null` si la personal no está autorizada).
4. Cualquier otra tool con un `ownerId` fuera de la lista → error explícito (`403`), nunca éxito vacío silencioso.
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

El token es **tu usuario**; cada tool elige el contexto financiero con `ownerType` + `ownerId`. Solo los contextos en la **allow-list** del token/grant son válidos:

1. Llama `list_houses` primero — devuelve tu `userId`, `personalContext` (si está permitida) y las casas autorizadas.
2. Pasa `ownerType: "house", ownerId: <id>` (casa compartida) o `ownerType: "user", ownerId: <tu userId>` (finanzas personales) en todas las demás tools.

La pertenencia a la casa se valida en cada llamada (mismas reglas que `getOwnerContext` en la app).

## Tools v2

Todas las tools (excepto `list_houses`) requieren `ownerType` + `ownerId`. Resuelven billeteras y categorías por **id o nombre** (nombre ambiguo → error con ids para desambiguar).

### Transición a v3 (rama `feat/mcp-tools-v3`)

- **Owner args.** Las tools migradas (`list_houses`, `list_wallets`, `create_wallet`, `list_wallet_movements`) publican `owner_type` + `owner_id`. Durante una versión siguen aceptando `ownerType` / `ownerId` como alias (si llegan ambos, gana la clave snake_case); el alias no aparece en `tools/list`. Las demás tools pasan a snake_case en MIC-I6-2/4.
- **Entrada estricta.** En las tools migradas una clave que no está en el schema (p. ej. `wallet_nmae`) es error de validación, no se descarta en silencio. Las fechas `YYYY-MM-DD` deben existir en el calendario (`2025-02-30` se rechaza).
- **Errores.** Toda tool responde los errores como `{"error": "…", "code": "…", "hint"?: "…", "candidates"?: [{"id", "name"}]}` con `isError: true`. Códigos: `NOT_FOUND`, `AMBIGUOUS_REF` (con `candidates`), `CONFIRM_REQUIRED`, `FORBIDDEN`, `VALIDATION`, `RATE_LIMITED` (con `hint` de reintento), `INTERNAL`. Los errores internos (base de datos, bugs) nunca exponen su texto: llegan como `INTERNAL` y el detalle queda en el log `mcp.tool.failed`.
- **Respuestas** en JSON compacto (sin sangría).

### Flujo típico del agente

1. `list_houses` → elige contexto personal o casa.
2. `list_categories` / `list_wallets` → catálogo para gastos e ingresos.
3. `add_expense` / `add_income` / `transfer` según la intención del usuario.

### Lectura (scope `read`)

| Tool | Qué hace |
|---|---|
| `list_houses` | Descubrimiento: userId del token + casas con rol |
| `list_wallets` | Billeteras con saldo, límite y crédito disponible |
| `list_cards` | Tarjetas: deuda, límite, corte, día de pago |
| `get_card` | Detalle: estado de cuenta, movimientos recientes, MSI |
| `list_card_movements` | Movimientos de una tarjeta por rango o ciclo actual |
| `list_loans` | Préstamos; `year` + `month` filtra cuotas del mes |
| `get_loan` | Detalle + calendario de un préstamo |
| `list_categories` | Catálogo de categorías (gasto e ingreso comparten árbol) |
| `list_expenses` | Gastos por rango (`from`/`to`, `last_n_days`, filtros). Incluye `totals` del rango completo y `totals_in_page` de la página actual. |
| `list_incomes` | Ingresos de una quincena (`fortnight_id` o `year`+`month`+`period`) |
| `list_wallet_movements` | Movimientos de billetera efectivo/débito/meta: gastos, ingresos, transferencias y pagos a tarjeta |
| `list_expense_templates` / `list_income_templates` | Plantillas recurrentes con flags 1ª/2ª quincena |
| `list_upcoming` | Pagos unificados: tarjetas (revolving + MSI), préstamos. Filtros: `year`/`month`, `period` FIRST\|SECOND, `from`/`to`. Revolving futuro vía proyección de liquidez (~180 días). |
| `list_goals` | Metas con progreso hacia el objetivo |
| `list_budgets` | Presupuestos activos: tope, gastado, restante |
| `get_liquidity` | “Me alcanza hasta…” (misma lógica que Liquidez en la app) |
| `get_fortnight` | Resumen y gastos de una quincena (`year`, `month`, `period`) |

### Reglas de lectura (v1.3.x)

**v1.3.1:** el transporte HTTP exige Bearer válido antes de `initialize` / `tools/list`; sin token responde **401** + `WWW-Authenticate` con `resource_metadata` (RFC 9728, requerido por ChatGPT OAuth).

**v1.3.0:** OAuth 2.1 + DCR.

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

- **`totals`:** suma por billetera y categoría en **todo** el rango filtrado (todas las páginas).
- **`totals_in_page`:** suma solo de la página actual (`limit`/`offset`).

**`list_card_movements`**

- Incluye **`purchase`**, **`payment`**, **`scheduled_payment`** (cuota programada suelta) e **`installment`** (cuota de plan MSI) cuya fecha cae en `from`/`to` o en el ciclo actual (`use_current_cycle`).

**Redescubrimiento de tools**

- `serverInfo.version` **2.2.1** (hardening OAuth, ver arriba; antes 2.2.0 — P2: reportes/alertas, casa, categorías CRUD, presupuesto multi-asignación, reconciliación/MSI; import PDF/CSV documentado fuera de v2) y `tools.listChanged: true` para que clientes que cachearon v1 vuelvan a pedir `tools/list`.

### Lectura P2 (scope `read`)

| Tool | Qué hace |
|---|---|
| `get_period_summary` | Totales del periodo (ingresos, gastos, pagado/pendiente, saldos de fondo, resto de presupuesto). Misma lógica que `GET /api/reports?type=summary`. |
| `get_alerts` | Alertas del periodo (ingreso faltante, compromiso alto, vencidos). Misma lógica que `GET /api/alerts`. |
| `list_house_members` | Miembros de la casa (`ownerType=house`). Solo casas en allow-list + membresía. |
| `get_card_reconciliation` | Inconsistencias en tarjetas del contexto. Misma lógica que `GET /api/credit-cards/reconciliation`. |
| `get_card_cycle_reconciliation` | Saldo registrado vs esperado en el ciclo vigente de una tarjeta. |
| `get_installment_portfolio` | Cuotas MSI activas y exposición restante en una tarjeta. |

`list_categories` ahora incluye `kind` (`EXPENSE`/`INCOME`) y acepta filtro `kind: expense|income|all`.

### Escritura P2 (scope `write`)

| Tool | Qué hace | Nota |
|---|---|---|
| `transfer_to_house` | Aporte personal → casa (`USER_TO_HOUSE`) | Mismo POST `/api/transfers`. No es `transfer` wallet↔wallet. |
| `create_category` / `update_category` / `delete_category` | CRUD categorías | `kind` EXPENSE\|INCOME; `delete_category` requiere `confirm: true`. |
| `update_budget_allocations` | Reemplaza asignaciones de un presupuesto | Mismo PUT `/api/budgets/[id]/allocations`. |
| `upsert_budget` | Acepta `allocations[]` multi-billetera/categoría | La suma debe igualar `amount`. |

### Import de estados de cuenta (fuera de MCP v2)

La UI importa PDF/CSV vía **multipart/form-data** (`POST /api/credit-cards/:id/statement-imports` y `/preview`). No hay API JSON limpia (URL, filas parseadas o asset id) reutilizable por agentes sin subir el archivo. **No hay tool MCP de import en v2** — sigue en la app web. Si en el futuro se expone un endpoint JSON, se podrá añadir una tool.

### Escritura (scope `write`)

| Tool | Qué hace | Nota |
|---|---|---|
| `add_expense` | Gasto en cualquier billetera | `is_paid` (default true); `already_in_balance` para bitácora sin mover saldo |
| `update_expense` / `delete_expense` | Corregir o borrar gasto | `update_expense` acepta `is_paid`; `delete_expense` requiere `confirm: true` |
| `set_expense_paid` | Marcar gasto pagado o pendiente | Mismo PATCH paid de la app; mueve saldo/deuda |
| `add_income` | Ingreso en billetera de activo | Sube saldo |
| `update_income` / `delete_income` | Corregir o borrar ingreso | `delete_income` requiere `confirm: true` |
| `create_expense_template` / `update_expense_template` / `delete_expense_template` | CRUD plantillas de gasto | Flags `applies_first_fortnight` / `applies_second_fortnight` |
| `create_income_template` / `update_income_template` / `delete_income_template` | CRUD plantillas de ingreso | Misma expansión que la UI al crear mes |
| `create_month` | Crear mes / expandir plantillas | Misma regla que UI: año en curso, mes actual o futuro |
| `regenerate_from_templates` | Regenerar quincena desde plantillas | `fortnight_id` o calendario |
| `create_wallet` | Alta billetera CASH/DEBIT | Mismo POST /api/wallets |
| `create_card` | Alta tarjeta de crédito | Mismo POST /api/credit-cards |
| `create_goal` / `update_goal` | Alta o edición de meta | Billetera GOAL |
| `adjust_wallet_balance` | Fija saldo efectivo/débito/meta | `confirm: true` |
| `transfer` | Entre billeteras de activo/metas | No es pago de tarjeta |
| `contribute_goal` / `withdraw_goal` | Aportar o retirar de una meta | Transfer interna |
| `create_loan` / `update_loan` / `add_loan_payment` | Préstamos personales | `add_loan_payment`: `MARK_PAID` (descuenta wallet), `MARK_PAID_EXTERNAL`, `SKIP`; batch con `payment_ids` |
| `delete_loan` | Elimina préstamo | `confirm: true` |
| `upsert_budget` / `delete_budget` | Crear/actualizar o desactivar presupuesto | Soporta `allocations[]`; ver también `update_budget_allocations` |
| `adjust_card_debt` | Fija deuda de tarjeta | `confirm: true` |
| `update_card` | Corte, pago, límites | Idempotente |
| `add_card_purchase` | Compra en tarjeta | `already_in_balance` opcional |
| `add_card_payment` | Pago de tarjeta | `mode`: `external` (default) o `wallet` (descuenta billetera MiCasa) |
| `pay_card` | Pagar tarjeta desde billetera | Alias de `add_card_payment` con `mode: wallet` |
| `create_installment_plan` / `update_installment_plan` | Planes MSI | |
| `create_scheduled_payment` | Cuota programada suelta en calendario de tarjeta | Mismo POST scheduled-payments |
| `upsert_card_payment_plan` | Monto planeado de pago de tarjeta en quincena | Mismo PUT card-payment-plans del panel |
| `delete_scheduled_payment` | Elimina cuota programada | `confirm: true` |

Las tools declaran anotaciones MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`).

Fuera de v2: **import PDF/CSV** vía MCP (solo multipart en la app), administración.

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
