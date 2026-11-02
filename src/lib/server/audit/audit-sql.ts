/**
 * SQL for the audit log, generated from `audited-models.ts`.
 *
 * `scripts/generate-audit-triggers.ts` writes it into a migration; the DB-gated
 * tests compare the triggers installed in Postgres with `triggerArgs()`.
 */
import {
  AUDITED_MODELS,
  OUTSIDE_APP_LABEL,
  SECRET_COLUMN_PATTERN,
  triggerArgs,
  type AuditedModel,
} from './audited-models'

export const AUDIT_TRIGGER_NAME = 'AuditRowChange'
export const AUDIT_ACTOR_SETTING = 'micasa.audit_actor'

const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`
const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`

/**
 * `audit.row_change()`: AFTER INSERT/UPDATE/DELETE FOR EACH ROW.
 * Args: entity_type, owner_mode, label_column, column_allowlist, column_denylist.
 *
 * - Actor: `current_setting('micasa.audit_actor', true)`. NULL, '' and 'null'
 *   mean no actor (behind the Neon pooler a previous transaction leaves '').
 *   No actor → SYSTEM + metadata.missing_actor + label "Fuera de la app".
 * - UPDATE with no changed column (ignoring `updated_at`) writes nothing.
 * - Parent owner: looked up through the FK; when the parent is already gone
 *   (cascade delete) the parent's latest audit row supplies it.
 * - Never raises on bad actor JSON: the change is recorded, not rejected.
 */
export const AUDIT_FUNCTIONS_SQL = `
CREATE SCHEMA IF NOT EXISTS audit;

CREATE OR REPLACE FUNCTION audit.redact(p_row jsonb, p_allow text[], p_deny text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(p_row) AS e
  WHERE (p_allow IS NULL OR e.key = ANY (p_allow))
    AND NOT (e.key = ANY (p_deny))
    AND e.key !~* ${quoteLiteral(SECRET_COLUMN_PATTERN)}
$fn$;

CREATE OR REPLACE FUNCTION audit.row_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_owner_mode  text := TG_ARGV[1];
  v_label_col   text := nullif(TG_ARGV[2], '');
  v_allow       text[] := CASE WHEN TG_ARGV[3] = '' THEN NULL ELSE string_to_array(TG_ARGV[3], ',') END;
  v_deny        text[] := CASE WHEN TG_ARGV[4] = '' THEN '{}'::text[] ELSE string_to_array(TG_ARGV[4], ',') END;
  v_raw         text := current_setting(${quoteLiteral(AUDIT_ACTOR_SETTING)}, true);
  v_actor       jsonb;
  v_meta        jsonb := '{}'::jsonb;
  v_row         jsonb;
  v_old         jsonb;
  v_new         jsonb;
  v_before      jsonb;
  v_after       jsonb;
  v_changed     text[] := '{}'::text[];
  v_owner_type  text;
  v_owner_id    integer;
  v_parent      text;
  v_fk          text;
  v_parent_id   text;
  v_source      text := 'SYSTEM';
  v_label       text;
  v_user_id     integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    v_old := audit.redact(to_jsonb(OLD), v_allow, v_deny);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new := audit.redact(to_jsonb(NEW), v_allow, v_deny);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(array_agg(n.key ORDER BY n.key), '{}'::text[]) INTO v_changed
    FROM jsonb_each(v_new) AS n
    WHERE n.key <> 'updated_at' AND (v_old -> n.key) IS DISTINCT FROM n.value;
    IF cardinality(v_changed) = 0 THEN
      RETURN NULL;
    END IF;
    SELECT jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      INTO v_before, v_after
    FROM unnest(v_changed) AS k;
  ELSIF TG_OP = 'INSERT' THEN
    v_after := v_new;
  ELSE
    v_before := v_old;
  END IF;

  -- Actor
  IF v_raw IS NOT NULL AND v_raw NOT IN ('', 'null') THEN
    BEGIN
      v_actor := v_raw::jsonb;
    EXCEPTION WHEN others THEN
      v_actor := NULL;
      v_meta := v_meta || '{"invalid_actor": true}'::jsonb;
    END;
  END IF;
  IF v_actor IS NULL OR jsonb_typeof(v_actor) <> 'object' THEN
    v_actor := NULL;
    v_meta := v_meta || '{"missing_actor": true}'::jsonb;
    v_label := ${quoteLiteral(OUTSIDE_APP_LABEL)};
  ELSE
    IF v_actor ->> 'source' IN ('WEB', 'AGENT', 'ADMIN', 'SYSTEM') THEN
      v_source := v_actor ->> 'source';
    END IF;
    v_label := nullif(v_actor ->> 'label', '');
    IF jsonb_typeof(v_actor -> 'metadata') = 'object' THEN
      v_meta := v_meta || (v_actor -> 'metadata');
    END IF;
    IF (v_actor ->> 'user_id') ~ '^[0-9]{1,9}$' THEN
      v_user_id := (v_actor ->> 'user_id')::integer;
      -- A deleted user (or the user being deleted) must not break the write.
      IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = v_user_id) THEN
        v_user_id := NULL;
      END IF;
    END IF;
  END IF;

  -- Owner
  IF v_owner_mode = 'self' THEN
    IF v_row ->> 'house_id' IS NOT NULL THEN
      v_owner_type := 'HOUSE';
      v_owner_id := (v_row ->> 'house_id')::integer;
    ELSIF v_row ->> 'user_id' IS NOT NULL THEN
      v_owner_type := 'USER';
      v_owner_id := (v_row ->> 'user_id')::integer;
    END IF;
  ELSIF v_owner_mode = 'house:id' THEN
    v_owner_type := 'HOUSE';
    v_owner_id := (v_row ->> 'id')::integer;
  ELSIF v_owner_mode = 'user:id' THEN
    v_owner_type := 'USER';
    v_owner_id := (v_row ->> 'id')::integer;
  ELSIF v_owner_mode LIKE 'parent:%' THEN
    v_parent := split_part(v_owner_mode, ':', 2);
    v_fk := split_part(v_owner_mode, ':', 3);
    v_parent_id := v_row ->> v_fk;
    IF v_parent_id IS NOT NULL THEN
      EXECUTE format(
        'SELECT CASE WHEN house_id IS NOT NULL THEN ''HOUSE'' WHEN user_id IS NOT NULL THEN ''USER'' END,
                coalesce(house_id, user_id)
           FROM %I WHERE id = $1',
        v_parent
      ) INTO v_owner_type, v_owner_id USING v_parent_id::integer;
      IF v_owner_type IS NULL THEN
        SELECT a.owner_type::text, a.owner_id INTO v_owner_type, v_owner_id
        FROM "AuditLog" a
        WHERE a.entity_type = v_parent AND a.entity_id = v_parent_id AND a.owner_type IS NOT NULL
        ORDER BY a.id DESC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  INSERT INTO "AuditLog" (
    txid, batch_id, label, request_id, session_id, source,
    actor_user_id, actor_name, api_key_id, oauth_grant_id,
    owner_type, owner_id, entity_type, entity_id, entity_label,
    action, changed_fields, before, after, metadata
  ) VALUES (
    pg_current_xact_id()::text::bigint,
    nullif(v_actor ->> 'batch_id', ''),
    v_label,
    nullif(v_actor ->> 'request_id', ''),
    nullif(v_actor ->> 'session_id', ''),
    v_source::"AuditSource",
    v_user_id,
    nullif(v_actor ->> 'actor_name', ''),
    CASE WHEN (v_actor ->> 'api_key_id') ~ '^[0-9]{1,9}$' THEN (v_actor ->> 'api_key_id')::integer END,
    CASE WHEN (v_actor ->> 'oauth_grant_id') ~ '^[0-9]{1,9}$' THEN (v_actor ->> 'oauth_grant_id')::integer END,
    v_owner_type::"AuditOwnerType",
    v_owner_id,
    v_entity_type,
    v_row ->> 'id',
    CASE WHEN v_label_col IS NOT NULL THEN left(v_row ->> v_label_col, 200) END,
    (CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'UPDATE' THEN 'UPDATE' ELSE 'DELETE' END)::"AuditAction",
    v_changed,
    v_before,
    v_after,
    CASE WHEN v_meta = '{}'::jsonb THEN NULL ELSE v_meta END
  );
  RETURN NULL;
END
$fn$;

-- Append-only: UPDATE / DELETE / TRUNCATE raise. The only UPDATE allowed is the
-- FK ON DELETE SET NULL of the user columns passed as trigger arguments.
CREATE OR REPLACE FUNCTION audit.reject_change()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_col text;
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - TG_ARGV) = (to_jsonb(OLD) - TG_ARGV) THEN
    FOREACH v_col IN ARRAY TG_ARGV LOOP
      IF (to_jsonb(NEW) -> v_col) IS DISTINCT FROM (to_jsonb(OLD) -> v_col)
         AND jsonb_typeof(to_jsonb(NEW) -> v_col) <> 'null' THEN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END
$fn$;

DROP TRIGGER IF EXISTS "AuditAppendOnly" ON "AuditLog";
CREATE TRIGGER "AuditAppendOnly" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit.reject_change('actor_user_id');
DROP TRIGGER IF EXISTS "AuditAppendOnlyTruncate" ON "AuditLog";
CREATE TRIGGER "AuditAppendOnlyTruncate" BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();

DROP TRIGGER IF EXISTS "AuditAppendOnly" ON "AuthEvent";
CREATE TRIGGER "AuditAppendOnly" BEFORE UPDATE OR DELETE ON "AuthEvent"
  FOR EACH ROW EXECUTE FUNCTION audit.reject_change('user_id', 'actor_user_id');
DROP TRIGGER IF EXISTS "AuditAppendOnlyTruncate" ON "AuthEvent";
CREATE TRIGGER "AuditAppendOnlyTruncate" BEFORE TRUNCATE ON "AuthEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();
`.trim()

/**
 * One trigger per audited table. The name sorts before Postgres' `RI_…`
 * triggers, so a parent's audit row exists before a cascade deletes its
 * children (their owner lookup falls back to it).
 */
export const auditTriggerSql = (m: AuditedModel): string => {
  const args = triggerArgs(m).map(quoteLiteral).join(', ')
  const table = quoteIdent(m.model)
  return [
    `DROP TRIGGER IF EXISTS ${quoteIdent(AUDIT_TRIGGER_NAME)} ON ${table};`,
    `CREATE TRIGGER ${quoteIdent(AUDIT_TRIGGER_NAME)} AFTER INSERT OR UPDATE OR DELETE ON ${table}`,
    `  FOR EACH ROW EXECUTE FUNCTION audit.row_change(${args});`,
  ].join('\n')
}

export const auditTriggersSql = (models: readonly AuditedModel[] = AUDITED_MODELS): string =>
  models.map(auditTriggerSql).join('\n\n')

/** Drops triggers of tables that left `AUDITED_MODELS` (pass their names). */
export const dropAuditTriggerSql = (model: string): string =>
  `DROP TRIGGER IF EXISTS ${quoteIdent(AUDIT_TRIGGER_NAME)} ON ${quoteIdent(model)};`
