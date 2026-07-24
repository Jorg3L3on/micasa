#!/usr/bin/env bash
# Create MiCasa error-rate spike alert (Sentry workflow engine).
# Requires a Sentry user/org token with alerts:write (or org:write).
#
#   SENTRY_USER_TOKEN='sntryu_…' ./scripts/create-sentry-error-spike-alert.sh
#
# Defaults: ≥10 events in 5 minutes → email Jorge (user 4814957)

set -euo pipefail

ORG="${SENTRY_ORG:-ziglabs}"
REGION="${SENTRY_REGION:-us}"
TOKEN="${SENTRY_USER_TOKEN:-${SENTRY_AUTH_TOKEN:-}}"
USER_ID="${SENTRY_ALERT_USER_ID:-4814957}"
THRESHOLD="${SENTRY_SPIKE_COUNT:-10}"
# Workflow API intervals: 1m | 5m | 15m | 1h | 1d | 1w | 30d
INTERVAL="${SENTRY_SPIKE_INTERVAL:-5m}"

if [[ -z "$TOKEN" ]]; then
  echo "Set SENTRY_USER_TOKEN (org token with alerts:write)." >&2
  exit 1
fi

API="https://${REGION}.sentry.io/api/0/organizations/${ORG}"

PAYLOAD="$(THRESHOLD="$THRESHOLD" INTERVAL="$INTERVAL" USER_ID="$USER_ID" python3 - <<'PY'
import json, os
print(json.dumps({
  "name": "MiCasa error rate spike",
  "enabled": True,
  "environment": None,
  "config": {"frequency": 30},
  "triggers": {
    "logicType": "any-short",
    "conditions": [
      {"type": "first_seen_event", "comparison": True, "conditionResult": True},
      {"type": "regression_event", "comparison": True, "conditionResult": True},
      {"type": "reappeared_event", "comparison": True, "conditionResult": True},
    ],
    "actions": [],
  },
  "actionFilters": [{
    "logicType": "all",
    "conditions": [{
      "type": "event_frequency_count",
      "comparison": {
        "value": int(os.environ["THRESHOLD"]),
        "interval": os.environ["INTERVAL"],
      },
      "conditionResult": True,
    }],
    "actions": [{
      "type": "email",
      "integrationId": None,
      "data": {},
      "config": {
        "targetType": "user",
        "targetIdentifier": os.environ["USER_ID"],
        "targetDisplay": None,
      },
      "status": "active",
    }],
  }],
}))
PY
)"

RESP="$(curl -sS -w '\n%{http_code}' -X POST \
  "${API}/workflows/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")"

HTTP="$(printf '%s' "$RESP" | tail -n1)"
BODY="$(printf '%s' "$RESP" | sed '$d')"

echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo "HTTP $HTTP"

if [[ "$HTTP" != "201" ]]; then
  echo "Failed (HTTP $HTTP)." >&2
  echo "Need a token with alerts:write (or org:write): https://ziglabs.sentry.io/settings/auth-tokens/" >&2
  echo "Interval must be one of: 1m, 5m, 15m, 1h, 1d, 1w, 30d" >&2
  exit 1
fi

ID="$(echo "$BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')"
echo "Created: https://${ORG}.sentry.io/monitors/alerts/${ID}/"
echo "(If that 404s: https://${ORG}.sentry.io/alerts/rules/)"
