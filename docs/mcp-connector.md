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

Ambos identifican al **mismo usuario** de MiCasa y respetan scopes `read` / `write`.

### OAuth (ChatGPT y clientes sin campo Token)

MiCasa implementa OAuth 2.1 + PKCE para el recurso MCP:

- **Protected Resource Metadata (RFC 9728):** `GET /.well-known/oauth-protected-resource` (también `…/api/mcp`).
- **Authorization Server Metadata (RFC 8414):** `GET /.well-known/oauth-authorization-server`.
- **Dynamic Client Registration (RFC 7591):** `POST /api/oauth/register` — ChatGPT **no** necesita un client id preconfigurado.
- **Client ID Metadata Documents (CIMD):** soportado cuando `client_id` es una URL HTTPS con metadata JSON.
- **Flujo:** authorization code + PKCE (`S256`) + parámetro `resource` (RFC 8707) apuntando a la URL del MCP.
- **Access token:** prefijo `micasa_oauth_…`, enviado como `Authorization: Bearer` en `/api/mcp`.
- **Revocación:** Ajustes → Conexiones → sección **Conexiones OAuth**.

#### Conectar ChatGPT (OAuth)

1. En ChatGPT: **Settings → Connectors → Developer Mode** (activar).
2. **Add connector** → URL del servidor MCP (`https://…/api/mcp`).
3. **Autenticación: OAuth** — deja client id / secret vacíos; ChatGPT usa DCR contra `/api/oauth/register`.
4. Al conectar, inicia sesión en MiCasa y aprueba en la pantalla de consentimiento.
5. Prueba con la tool `list_houses`.

### Bearer token (Grok / Cursor / Claude)

Se usa un **token de agente** (`micasa_…`) enviado como `Authorization: Bearer`. El token identifica a un usuario de MiCasa; solo se guarda su hash SHA-256 (tabla `ApiKey`) — el token tiene 256 bits de entropía, así que la verificación es sub-milisegundo en cada tool call sin sacrificar seguridad. Las llaves creadas antes del cambio (hash bcrypt) siguen funcionando y se migran solas al nuevo formato en su siguiente uso.

#### Crear un token (UI — recomendado)

1. Inicia sesión y ve a **Ajustes → Conexiones** (`/settings/connections`).
2. Pulsa **Nueva conexión**, ponle nombre (p. ej. "Grok Bot"), activa **Permitir escritura** solo si el agente debe registrar compras/pagos/ajustes y elige una **expiración** opcional (30/90/365 días); al vencer, el token deja de funcionar solo.
3. Copia el token que se muestra — **solo se muestra una vez**.

Desde la misma página puedes **renombrar** y **revocar** conexiones Bearer (la revocación es inmediata) y **revocar conexiones OAuth** en la sección dedicada.

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

El token es **tu usuario**; cada tool elige el contexto financiero con `ownerType` + `ownerId`:

1. Llama `list_houses` primero — devuelve tu `userId` y las casas donde eres miembro.
2. Pasa `ownerType: "house", ownerId: <id>` (casa compartida) o `ownerType: "user", ownerId: <tu userId>` (finanzas personales) en todas las demás tools.

La pertenencia a la casa se valida en cada llamada (mismas reglas que `getOwnerContext` en la app).

## Tools v2

Todas las tools (excepto `list_houses`) requieren `ownerType` + `ownerId`. Resuelven billeteras y categorías por **id o nombre** (nombre ambiguo → error con ids para desambiguar).

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
| `list_upcoming` | Pagos del mes: tarjetas, MSI y préstamos unificados |
| `list_goals` | Metas con progreso hacia el objetivo |
| `list_budgets` | Presupuestos activos: tope, gastado, restante |
| `get_liquidity` | “Me alcanza hasta…” (misma lógica que Liquidez en la app) |

### Reglas de lectura (v1.3.0)

Estas reglas alinean las tools de lectura con Panel financiero y Liquidez:

**`list_upcoming(year, month)`**

- **Por tarjeta y fecha:** `period_total` = suma de cuotas MSI del mes + resto revolving al corte (no el doble del estado de cuenta completo).
- **Cuotas MSI (`CreditCardInstallmentPlan`):** **siempre** aparecen como renglones `msi` cuando su `dueDate` cae en el mes.
- **Resto revolving:** renglón `revolving` aparte cuando hay pago programado/calendario (`scheduled_calendar`) o cuando el monto del corte (`ledger`/`import`/`projection`) excede la suma de MSI del plan en esa misma fecha. Ej.: corte \$1 500 con MSI \$500 → `msi` \$500 + `revolving` \$1 000; resto PIF \$180 + MSI \$650 → ambos renglones.
- **No duplicar:** no apilar el `next_due_payment` íntegro del estado de cuenta **y** las cuotas MSI que ya están dentro de ese total.
- **Préstamos:** toda cuota `SCHEDULED` con `dueDate` en el mes (vía `listLoanPaymentsForPlannerMonth`).
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

- `serverInfo.version` **1.3.0** (OAuth 2.1 + DCR) y `tools.listChanged: true` para que clientes que cachearon v1 vuelvan a pedir `tools/list`.

### Escritura (scope `write`)

| Tool | Qué hace | Nota |
|---|---|---|
| `add_expense` | Gasto en cualquier billetera | `already_in_balance` para bitácora sin mover saldo |
| `update_expense` / `delete_expense` | Corregir o borrar gasto | `delete_expense` requiere `confirm: true` |
| `add_income` | Ingreso en billetera de activo | Sube saldo |
| `adjust_wallet_balance` | Fija saldo efectivo/débito/meta | `confirm: true` |
| `transfer` | Entre billeteras de activo/metas | No es pago de tarjeta |
| `contribute_goal` / `withdraw_goal` | Aportar o retirar de una meta | Transfer interna |
| `create_loan` / `update_loan` / `add_loan_payment` | Préstamos personales | Cuotas externas con `paid_payments_count` / `MARK_PAID_EXTERNAL` |
| `delete_loan` | Elimina préstamo | `confirm: true` |
| `upsert_budget` / `delete_budget` | Crear/actualizar o desactivar presupuesto | Presupuesto simple (1 billetera + categoría) |
| `adjust_card_debt` | Fija deuda de tarjeta | `confirm: true` |
| `update_card` | Corte, pago, límites | Idempotente |
| `add_card_purchase` | Compra en tarjeta | `already_in_balance` opcional |
| `add_card_payment` | Pago externo de tarjeta | No descuenta billeteras MiCasa |
| `create_installment_plan` / `update_installment_plan` | Planes MSI | |
| `delete_scheduled_payment` | Elimina cuota programada | `confirm: true` |

Las tools declaran anotaciones MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`).

Fuera de v2: pago de tarjeta descontando billetera MiCasa (modo `wallet`), import PDF/CSV vía MCP, administración.

## Límites de uso

Cada llave Bearer o grant OAuth tiene un límite de **120 llamadas de tool por minuto** (policy `mcp:tool`). Al excederlo, la tool responde con un error que indica en cuántos segundos reintentar. Crear llaves también está limitado (10 por hora por usuario).

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
