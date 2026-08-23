# MCP connector (Grok Bot / Cursor)

MiCasa expone un servidor [MCP](https://modelcontextprotocol.io) HTTP en `POST /api/mcp` para conectar agentes externos (Grok Bot, Cursor u otro cliente MCP con soporte de Streamable HTTP + Bearer auth). Las tools llaman directamente a los services del dominio (`credit-card.service`, `loan.service`, …) — la UI y las rutas `/api/*` no cambian.

## URL del conector

| Entorno | URL |
|---|---|
| Producción | `https://micasa-three.vercel.app/api/mcp` |
| Local | `http://localhost:3000/api/mcp` |

## Autenticación

La cookie de NextAuth no sirve para conectores; se usa un **token de agente** (`micasa_…`) enviado como `Authorization: Bearer`. El token identifica a un usuario de MiCasa; solo se guarda su hash (tabla `ApiKey`).

Emitir un token (una vez, desde el repo con `DATABASE_URL` apuntando a la base correcta):

```bash
node scripts/mint-agent-token.mjs --email tu@correo.com --name "Grok Bot" --scopes read,write
```

- `--scopes read` — solo lectura (list/get).
- `--scopes read,write` — también writes (compras, pagos externos, MSI, ajustes).

Revocar:

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
| `adjust_card_debt` | Fija la deuda en libros (alineación con el banco) | Requiere `confirm: true` |
| `update_card` | Corte, día de pago, límite, límite temporal | |
| `add_card_purchase` | Compra en tarjeta; `already_in_balance` para ledger-only | Resuelve quincena desde la fecha; categoría por id o nombre |
| `add_card_payment` | Pago **externo** (no descuenta billeteras de MiCasa); `adjusts_debt: false` si la deuda ya lo refleja | |
| `create_installment_plan` / `update_installment_plan` | Planes MSI | |
| `delete_scheduled_payment` | Elimina cuota programada no cubierta | Requiere `confirm: true` |

Fuera de v1: pago de tarjeta que descuenta una billetera (modo `wallet`), import de estados de cuenta PDF/CSV y administración.

## Conectar el cliente

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

## Costos

El endpoint es una función normal de Vercel dentro del mismo proyecto (handler stateless, sin Redis ni sesiones); no agrega servicios ni costos al plan gratuito.
