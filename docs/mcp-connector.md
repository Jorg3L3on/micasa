# MCP connector (Grok Bot / Cursor / Claude / ChatGPT)

MiCasa expone un servidor [MCP](https://modelcontextprotocol.io) HTTP en `POST /api/mcp` para conectar agentes externos (Grok Bot, Cursor, Claude, ChatGPT en modo desarrollador u otro cliente MCP con soporte de Streamable HTTP + Bearer auth). Las tools llaman directamente a los services del dominio (`credit-card.service`, `loan.service`, …) — la UI y las rutas `/api/*` no cambian.

## URL del conector

| Entorno | URL |
|---|---|
| Producción | `https://micasa-three.vercel.app/api/mcp` |
| Local | `http://localhost:3000/api/mcp` |

El endpoint responde `OPTIONS` con CORS abierto (`Authorization`, `Content-Type`, `mcp-protocol-version`, `mcp-session-id`), así que también funcionan clientes MCP que corren en el navegador (Claude web, MCP Inspector). Sin un token válido ninguna tool devuelve datos.

## Autenticación

La cookie de NextAuth no sirve para conectores; se usa un **token de agente** (`micasa_…`) enviado como `Authorization: Bearer`. El token identifica a un usuario de MiCasa; solo se guarda su hash SHA-256 (tabla `ApiKey`) — el token tiene 256 bits de entropía, así que la verificación es sub-milisegundo en cada tool call sin sacrificar seguridad. Las llaves creadas antes del cambio (hash bcrypt) siguen funcionando y se migran solas al nuevo formato en su siguiente uso.

### Crear un token (UI — recomendado)

1. Inicia sesión y ve a **Ajustes → Conexiones** (`/settings/connections`).
2. Pulsa **Nueva conexión**, ponle nombre (p. ej. "Grok Bot"), activa **Permitir escritura** solo si el agente debe registrar compras/pagos/ajustes y elige una **expiración** opcional (30/90/365 días); al vencer, el token deja de funcionar solo.
3. Copia el token que se muestra — **solo se muestra una vez**.

Desde la misma página puedes **renombrar** y **revocar** conexiones (la revocación es inmediata: el Bearer deja de funcionar en la siguiente llamada) y ver el último uso de cada llave.

### Crear un token (script — ops/emergencia)

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

## Tools v1

Lectura (scope `read`):

| Tool | Qué hace |
|---|---|
| `list_houses` | Descubrimiento: userId del token + casas con rol |
| `list_wallets` | Billeteras con saldo, límite y crédito disponible |
| `list_cards` | Tarjetas: deuda, límite, corte, día de pago |
| `get_card` | Detalle: estado de cuenta, movimientos, MSI, cuotas programadas |
| `list_loans` | Préstamos con calendario; `year` + `month` filtra cuotas del mes |

Escritura (scope `write`):

| Tool | Qué hace | Nota |
|---|---|---|
| `adjust_card_debt` | Fija la deuda en libros (alineación con el banco) | Requiere `confirm: true`; `destructiveHint` |
| `update_card` | Corte, día de pago, límite, límite temporal | Idempotente |
| `add_card_purchase` | Compra en tarjeta; `already_in_balance` para ledger-only | Resuelve quincena desde la fecha; categoría por id o nombre |
| `add_card_payment` | Pago **externo** (no descuenta billeteras de MiCasa); `adjusts_debt: false` si la deuda ya lo refleja | |
| `create_installment_plan` / `update_installment_plan` | Planes MSI | |
| `delete_scheduled_payment` | Elimina cuota programada no cubierta | Requiere `confirm: true`; `destructiveHint` |

Las tools declaran anotaciones MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`): los clientes que las respetan (Claude, Cursor) muestran confirmaciones nativas antes de operaciones destructivas.

Fuera de v1: pago de tarjeta que descuenta una billetera (modo `wallet`), import de estados de cuenta PDF/CSV y administración.

## Límites de uso

Cada llave tiene un límite de **120 llamadas de tool por minuto** (policy `mcp:tool`). Al excederlo, la tool responde con un error que indica en cuántos segundos reintentar. Crear llaves también está limitado (10 por hora por usuario).

## Conectar el cliente

Todos los clientes usan la misma URL y el token como Bearer. La página **Ajustes → Conexiones** muestra estos snippets con botón de copiar.

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

**ChatGPT (modo desarrollador)**: activa *Developer Mode* en Settings → Connectors y crea un conector MCP con la URL y el token como access token. Nota: los conectores estándar de ChatGPT (sin developer mode) requieren OAuth 2.1, que está fuera de alcance de v1/v2 (ver abajo).

## Fuera de alcance (v3, documentado)

- **OAuth 2.1 + `/.well-known/oauth-protected-resource`** — para clientes que no aceptan Bearer manual (p. ej. conectores ChatGPT estándar).
- Tools de gastos/presupuestos, MCP resources/prompts.

## Costos

El endpoint es una función normal de Vercel dentro del mismo proyecto (handler stateless, sin Redis ni sesiones); no agrega servicios ni costos al plan gratuito. El rate limit usa memoria del proceso (o Upstash si ya está configurado por env vars, opcional).
