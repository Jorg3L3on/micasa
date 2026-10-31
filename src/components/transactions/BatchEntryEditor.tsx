'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { toast } from 'sonner';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ClipboardPaste,
  Copy,
  History,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import {
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OverlayErrorBanner,
  OverlayHint,
} from '@/components/overlay/overlay-form';
import { useOverlaySelectOpenChange } from '@/components/overlay/responsive-overlay';
import { useFinanceContext } from '@/context/finance-context';
import { useTransactionCatalogs } from '@/hooks/use-transaction-catalogs';
import {
  listRecentExpenses,
  saveTransactionBatch,
  type RecentExpenseItem,
} from '@/lib/api/transaction-batch';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { isCreditOrStoreCardWalletType, isGoalWalletType } from '@/domain/payment-method';
import {
  BATCH_SOFT_LIMIT,
  applyBatchResults,
  batchTotals,
  duplicateBatchRow,
  effectiveIsPaid,
  isBlankRow,
  newBatchRow,
  rowExceedsBalance,
  rowIssues,
  toBatchItems,
  type BatchRow,
  type BatchRowIssues,
  type BatchRowKind,
} from '@/lib/transactions/batch-entry';
import {
  buildCategoryByName,
  parseQuickLines,
} from '@/lib/transactions/parse-quick-lines';
import { cn, formatCurrency } from '@/lib/utils';
import type { PaymentMethodOption } from '@/types/catalog';

type BatchEntryEditorProps = {
  /** `sheet` stacks cards; `page` shows the table from md up. Both share the same rows. */
  layout: 'sheet' | 'page';
  defaultDate?: string;
  /** Called after each save request with the number of rows created. */
  onSaved?: (created: number) => void;
  /** Called once no rows are left (everything saved). */
  onAllSaved?: () => void;
};

const DRAFT_KEY_PREFIX = 'micasa:batch-entry-draft:';

const readDraft = (key: string): BatchRow[] | null => {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BatchRow[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map((r) => ({ ...r, status: 'draft' as const, error: undefined }))
      : null;
  } catch {
    return null;
  }
};

const writeDraft = (key: string, rows: BatchRow[] | null) => {
  try {
    if (rows && rows.length > 0) {
      window.sessionStorage.setItem(key, JSON.stringify(rows));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable: the draft is a convenience only */
  }
};

const COLUMNS =
  'md:grid-cols-[6.5rem_minmax(8rem,1.4fr)_7.5rem_9.5rem_minmax(9rem,1fr)_minmax(9rem,1fr)_8.5rem]';

export function BatchEntryEditor({
  layout,
  defaultDate,
  onSaved,
  onAllSaved,
}: BatchEntryEditorProps) {
  const { context } = useFinanceContext();
  const handleSelectOpenChange = useOverlaySelectOpenChange();
  const catalogs = useTransactionCatalogs();
  const today = defaultDate ?? todayCalendarDate();
  const draftKey = `${DRAFT_KEY_PREFIX}${context.type}-${context.id}`;

  const [rows, setRows] = useState<BatchRow[]>(() => [
    newBatchRow(null, { date: today }),
  ]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<RecentExpenseItem[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const attemptKeyRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  const wallets = catalogs.wallets;
  const expenseWallets = useMemo(
    () => wallets.filter((w) => !isGoalWalletType(w.type)),
    [wallets],
  );
  const incomeWallets = useMemo(
    () => expenseWallets.filter((w) => w.type === 'CASH' || w.type === 'DEBIT_CARD'),
    [expenseWallets],
  );

  // Restore a draft once (a reload or accidental close must not lose the rows).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = readDraft(draftKey);
    if (draft) {
      setRows(draft);
      setExpandedId(draft[0].clientId);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const meaningful = rows.some((r) => !isBlankRow(r));
    writeDraft(draftKey, meaningful ? rows : null);
  }, [rows, draftKey]);

  // The wallet is only preselected when there is a single sensible choice.
  useEffect(() => {
    if (catalogs.loading || expenseWallets.length !== 1) return;
    setRows((prev) =>
      prev.map((r) => (r.walletId === 0 ? { ...r, walletId: expenseWallets[0].id } : r)),
    );
  }, [catalogs.loading, expenseWallets]);

  useEffect(() => {
    if (!focusId) return;
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-row="${focusId}"] [data-field="name"]`,
    );
    el?.focus();
    setFocusId(null);
  }, [focusId, rows]);

  const updateRow = useCallback((id: string, patch: Partial<BatchRow>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.clientId === id
          ? { ...r, ...patch, status: 'draft', error: undefined }
          : r,
      ),
    );
    setFormError(null);
  }, []);

  const addRow = useCallback(
    (after?: string) => {
      const current = rowsRef.current;
      const anchorIndex = after
        ? current.findIndex((r) => r.clientId === after)
        : current.length - 1;
      const row = newBatchRow(current[anchorIndex] ?? null, { date: today });
      const index = after ? anchorIndex + 1 : current.length;
      setRows((prev) => {
        const copy = [...prev];
        copy.splice(index, 0, row);
        return copy;
      });
      setExpandedId(row.clientId);
      setFocusId(row.clientId);
    },
    [today],
  );

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.clientId !== id);
      return next.length > 0 ? next : [newBatchRow(null, { date: today })];
    });
  }, [today]);

  const duplicateRow = useCallback((id: string) => {
    const current = rowsRef.current;
    const index = current.findIndex((r) => r.clientId === id);
    if (index < 0) return;
    const copy = duplicateBatchRow(current[index]);
    setRows((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setExpandedId(copy.clientId);
    setFocusId(copy.clientId);
  }, []);

  const appendRows = useCallback((incoming: BatchRow[]) => {
    if (incoming.length === 0) return;
    setRows((prev) => {
      const kept = prev.filter((r) => !isBlankRow(r));
      return [...kept, ...incoming];
    });
    setExpandedId(incoming[0].clientId);
  }, []);

  const toggleRecent = async () => {
    const next = !recentOpen;
    setRecentOpen(next);
    if (next && recent == null) {
      try {
        setRecent(await listRecentExpenses(8, context));
      } catch {
        setRecent([]);
      }
    }
  };

  const addFromRecent = (item: RecentExpenseItem) => {
    const base = newBatchRow(rows[rows.length - 1] ?? null, { date: today });
    appendRows([
      {
        ...base,
        kind: 'expense',
        name: item.description,
        amount: item.amount,
        categoryId: item.categoryId ?? 0,
        walletId: item.walletId ?? base.walletId,
        date: today,
      },
    ]);
  };

  const applyPaste = async () => {
    let recentForNames = recent;
    if (recentForNames == null) {
      try {
        recentForNames = await listRecentExpenses(100, context);
        setRecent(recentForNames.slice(0, 8));
      } catch {
        recentForNames = [];
      }
    }
    const parsed = parseQuickLines(pasteText, {
      today,
      wallets: expenseWallets,
      defaultWalletId: rows[rows.length - 1]?.walletId || undefined,
      categoryByName: buildCategoryByName(
        recentForNames.map((r) => ({
          description: r.description,
          categoryId: r.categoryId,
        })),
      ),
    });
    if (parsed.length === 0) {
      toast.info('No encontré movimientos en el texto');
      return;
    }
    appendRows(
      parsed.map((p) => ({
        ...newBatchRow(null, { date: today }),
        ...p,
        amount: p.amount,
      })),
    );
    setPasteText('');
    setPasteOpen(false);
  };

  const issuesByRow = useMemo(() => {
    const map = new Map<string, BatchRowIssues>();
    rows.forEach((row, index) => {
      if (isBlankRow(row)) return;
      const issues = rowIssues(row, wallets);
      if (!issues.walletId && rowExceedsBalance(rows, index, wallets) && !row.skipWalletDelta) {
        issues.walletId = 'Supera el saldo. Confirma para guardar sin afectarlo.';
      }
      if (Object.keys(issues).length > 0) map.set(row.clientId, issues);
    });
    return map;
  }, [rows, wallets]);

  const filledRows = rows.filter((r) => !isBlankRow(r));
  const validRows = filledRows.filter((r) => !issuesByRow.has(r.clientId));
  const totals = batchTotals(filledRows);

  const save = async () => {
    setFormError(null);
    if (filledRows.length === 0) {
      setFormError('Agrega al menos un movimiento.');
      return;
    }
    setShowIssues(true);
    if (validRows.length === 0) {
      setFormError('Revisa los campos marcados en cada movimiento.');
      return;
    }
    setSubmitting(true);
    setRows((prev) =>
      prev.map((r) =>
        validRows.some((v) => v.clientId === r.clientId)
          ? { ...r, status: 'saving' }
          : r,
      ),
    );
    if (!attemptKeyRef.current) attemptKeyRef.current = crypto.randomUUID();
    try {
      const response = await saveTransactionBatch(
        toBatchItems(validRows, wallets),
        attemptKeyRef.current,
        context,
      );
      attemptKeyRef.current = null;
      const sentIds = new Set(validRows.map((r) => r.clientId));
      const current = rowsRef.current;
      const sent = current.filter((r) => sentIds.has(r.clientId));
      const notSent = current.filter(
        (r) => !sentIds.has(r.clientId) && !isBlankRow(r),
      );
      const remaining = [...applyBatchResults(sent, response), ...notSent];
      setRows(
        remaining.length > 0 ? remaining : [newBatchRow(null, { date: today })],
      );
      const { created, failed } = response.summary;
      if (created > 0) {
        void catalogs.refresh();
        onSaved?.(created);
      }
      if (failed === 0 && remaining.length === 0) {
        toast.success(
          created === 1 ? '1 movimiento guardado' : `${created} movimientos guardados`,
        );
        setShowIssues(false);
        onAllSaved?.();
      } else {
        toast.warning(
          `${created} de ${response.summary.total} movimientos guardados`,
          { description: 'Corrige los que quedaron en pantalla.' },
        );
        const firstLeft = remaining[0];
        if (firstLeft) setExpandedId(firstLeft.clientId);
      }
    } catch (err) {
      // No response: keep the key so a retry cannot double-create.
      setRows((prev) => prev.map((r) => (r.status === 'saving' ? { ...r, status: 'draft' } : r)));
      setFormError(
        err instanceof Error ? err.message : 'No se pudo guardar el lote. Intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key === 'Enter') {
      event.preventDefault();
      void save();
      return;
    }
    const rowEl = (event.target as HTMLElement).closest<HTMLElement>('[data-row]');
    const rowId = rowEl?.dataset.row;
    if (!rowId) return;
    if (meta && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateRow(rowId);
      return;
    }
    const target = event.target as HTMLElement;
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      target.tagName === 'INPUT' &&
      target.dataset.field === 'amount'
    ) {
      event.preventDefault();
      if (rows[rows.length - 1]?.clientId === rowId) addRow();
      else
        containerRef.current
          ?.querySelector<HTMLElement>(
            `[data-row="${rows[rows.findIndex((r) => r.clientId === rowId) + 1]?.clientId}"] [data-field="name"]`,
          )
          ?.focus();
    }
  };

  const saveLabel = submitting
    ? 'Guardando…'
    : filledRows.length > 1
      ? `Guardar ${filledRows.length} movimientos`
      : 'Guardar';

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3"
    >
      {catalogs.error ? <OverlayErrorBanner>{catalogs.error}</OverlayErrorBanner> : null}
      {formError ? <OverlayErrorBanner>{formError}</OverlayErrorBanner> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => setPasteOpen((v) => !v)}
          aria-expanded={pasteOpen}
        >
          <ClipboardPaste className="h-4 w-4" aria-hidden />
          Pegar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => void toggleRecent()}
          aria-expanded={recentOpen}
        >
          <History className="h-4 w-4" aria-hidden />
          Recientes
        </Button>
        {layout === 'page' ? (
          <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
            Enter agrega fila · Ctrl/Cmd+D duplica · Ctrl/Cmd+Enter guarda
          </span>
        ) : null}
      </div>

      {pasteOpen ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={'café 45\nsúper 820 BBVA\n+sueldo 12000\nayer taxi 80'}
            aria-label="Pegar movimientos, uno por línea"
            className="resize-none"
          />
          <OverlayHint>
            Uno por línea. «+» marca un ingreso. Revisa los borradores antes de guardar.
          </OverlayHint>
          <Button
            type="button"
            variant="secondary"
            className="h-9 rounded-xl"
            disabled={pasteText.trim() === ''}
            onClick={() => void applyPaste()}
          >
            Agregar filas
          </Button>
        </div>
      ) : null}

      {recentOpen ? (
        <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {recent == null ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Cargando…</p>
          ) : recent.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Sin gastos recientes.</p>
          ) : (
            recent.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addFromRecent(item)}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 truncate font-medium">{item.description}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCurrency(item.amount)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <div
        role="group"
        aria-label="Movimientos"
        className={cn('flex flex-col gap-3', layout === 'page' && 'md:gap-0 md:overflow-hidden md:rounded-xl md:border md:border-border/60 md:bg-card')}
      >
        {layout === 'page' ? (
          <div
            aria-hidden
            className={cn(
              'hidden gap-3 border-b border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground md:grid',
              COLUMNS,
            )}
          >
            <span>Tipo</span>
            <span>Nombre</span>
            <span>Monto</span>
            <span>Fecha</span>
            <span>Billetera</span>
            <span>Categoría</span>
            <span>Opciones</span>
          </div>
        ) : null}
        {rows.map((row, index) => (
          <BatchRowView
            key={row.clientId}
            layout={layout}
            row={row}
            index={index}
            expanded={expandedId === row.clientId || layout === 'page'}
            onExpand={() => setExpandedId(row.clientId)}
            wallets={wallets}
            expenseWallets={expenseWallets}
            incomeWallets={incomeWallets}
            expenseCategories={catalogs.expenseCategories}
            incomeCategories={catalogs.incomeCategories}
            loading={catalogs.loading}
            issues={showIssues || row.status === 'failed' ? issuesByRow.get(row.clientId) : undefined}
            exceeds={rowExceedsBalance(rows, index, wallets)}
            onChange={(patch) => updateRow(row.clientId, patch)}
            onDuplicate={() => duplicateRow(row.clientId)}
            onRemove={() => removeRow(row.clientId)}
            onSelectOpenChange={handleSelectOpenChange}
            disabled={submitting}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl border-dashed"
        onClick={() => addRow()}
        disabled={submitting}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Agregar otro
      </Button>
      {rows.length > BATCH_SOFT_LIMIT ? (
        <OverlayHint role="status">
          Son muchos movimientos. Para volúmenes grandes conviene importar un estado de cuenta.
        </OverlayHint>
      ) : null}

      <div
        className={cn(
          'sticky bottom-0 -mx-1 flex flex-col gap-2 bg-background/95 px-1 pt-2 backdrop-blur',
          layout === 'sheet' && 'pb-1',
        )}
      >
        {filledRows.length > 0 ? (
          <p
            role="status"
            className="flex items-center justify-between px-1 text-xs text-muted-foreground"
          >
            <span>
              {validRows.length} de {filledRows.length} listos
            </span>
            <span className="tabular-nums">
              {totals.incomes > 0 ? `+${formatCurrency(totals.incomes)} ` : ''}
              {totals.expenses > 0 ? `−${formatCurrency(totals.expenses)}` : ''}
            </span>
          </p>
        ) : null}
        <Button
          type="button"
          onClick={() => void save()}
          disabled={submitting || catalogs.loading}
          className={cn(
            OVERLAY_PRIMARY_BUTTON_CLASS,
            layout === 'page' && 'md:ml-auto md:w-auto md:min-w-56 md:px-6',
          )}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

type BatchRowViewProps = {
  layout: 'sheet' | 'page';
  row: BatchRow;
  index: number;
  expanded: boolean;
  onExpand: () => void;
  wallets: PaymentMethodOption[];
  expenseWallets: PaymentMethodOption[];
  incomeWallets: PaymentMethodOption[];
  expenseCategories: Parameters<typeof CategoryGroupedSelect>[0]['categories'];
  incomeCategories: Parameters<typeof CategoryGroupedSelect>[0]['categories'];
  loading: boolean;
  issues?: BatchRowIssues;
  exceeds: boolean;
  onChange: (patch: Partial<BatchRow>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSelectOpenChange: (open: boolean) => void;
  disabled: boolean;
};

const fieldErrorClass = (message?: string) =>
  message ? 'border-destructive ring-1 ring-destructive/40' : '';

function BatchRowView({
  layout,
  row,
  index,
  expanded,
  onExpand,
  wallets,
  expenseWallets,
  incomeWallets,
  expenseCategories,
  incomeCategories,
  loading,
  issues,
  exceeds,
  onChange,
  onDuplicate,
  onRemove,
  onSelectOpenChange,
  disabled,
}: BatchRowViewProps) {
  const isIncome = row.kind === 'income';
  const walletOptions = isIncome ? incomeWallets : expenseWallets;
  const categories = isIncome ? incomeCategories : expenseCategories;
  const selectedWallet = wallets.find((w) => w.id === row.walletId);
  const selectedCategory = categories.find((c) => c.id === row.categoryId);
  const isCredit = isCreditOrStoreCardWalletType(selectedWallet?.type);
  const paid = effectiveIsPaid(row, wallets);
  const label = `Movimiento ${index + 1}`;
  const serverError = row.status === 'failed' ? row.error : undefined;
  const hasProblem = Boolean(serverError) || (issues != null && Object.keys(issues).length > 0);

  const setKind = (kind: BatchRowKind) => {
    if (kind === row.kind) return;
    const nextWallets = kind === 'income' ? incomeWallets : expenseWallets;
    onChange({
      kind,
      categoryId: 0,
      isPaid: false,
      isRecurring: false,
      applyToBothFortnights: false,
      skipWalletDelta: false,
      walletId: nextWallets.some((w) => w.id === row.walletId) ? row.walletId : 0,
    });
  };

  const summary = (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 text-left',
        layout === 'page' ? 'md:hidden' : '',
        expanded && 'hidden',
      )}
      aria-label={`${label}: editar`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {isIncome ? (
          <ArrowUpCircle className="h-4 w-4 shrink-0 text-primary-text" aria-hidden />
        ) : (
          <ArrowDownCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {row.name || 'Sin nombre'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {selectedCategory?.name ?? 'Sin categoría'}
            {hasProblem ? ' · revisar' : ''}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
        {row.amount === '' ? '—' : `${isIncome ? '+' : '−'}${formatCurrency(Number(row.amount))}`}
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
      </span>
    </button>
  );

  return (
    <div
      data-row={row.clientId}
      aria-label={label}
      aria-busy={row.status === 'saving'}
      className={cn(
        'rounded-xl border border-border/60 bg-card p-3',
        layout === 'page' &&
          'md:rounded-none md:border-0 md:border-b md:border-border/60 md:bg-transparent md:px-3 md:py-2 md:last:border-b-0',
        hasProblem && 'border-destructive/50 md:border-destructive/50',
        row.status === 'saving' && 'opacity-70',
      )}
    >
      {summary}

      <div className={cn(expanded ? 'block' : 'hidden', layout === 'page' && 'md:block')}>
        <div className={cn('grid grid-cols-2 gap-2', layout === 'page' && cn('md:items-start md:gap-3', COLUMNS))}>
          <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-start">
            <KindToggle value={row.kind} onChange={setKind} disabled={disabled} label={label} />
            <div className="flex items-center md:hidden">
              <RowActions onDuplicate={onDuplicate} onRemove={onRemove} label={label} disabled={disabled} />
            </div>
          </div>

          <div className="col-span-2 md:col-span-1">
            <Input
              data-field="name"
              value={row.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={isIncome ? 'Ej. sueldo, reembolso' : 'Ej. café, súper'}
              aria-label={`${label}: nombre`}
              aria-invalid={Boolean(issues?.name)}
              autoComplete="off"
              enterKeyHint="next"
              disabled={disabled}
              className={cn('h-11 md:h-10', fieldErrorClass(issues?.name))}
            />
          </div>

          <AmountCell
            value={row.amount}
            onChange={(amount) => onChange({ amount })}
            invalid={Boolean(issues?.amount)}
            disabled={disabled}
            label={`${label}: monto`}
          />

          <Input
            type="date"
            value={row.date}
            onChange={(e) => e.target.value && onChange({ date: e.target.value })}
            aria-label={`${label}: fecha`}
            aria-invalid={Boolean(issues?.date)}
            disabled={disabled}
            className={cn('h-11 md:h-10', fieldErrorClass(issues?.date))}
          />

          <Select
            value={row.walletId ? String(row.walletId) : undefined}
            onOpenChange={onSelectOpenChange}
            onValueChange={(v) => onChange({ walletId: parseInt(v, 10) })}
            disabled={disabled || loading}
          >
            <SelectTrigger
              aria-label={`${label}: billetera`}
              aria-invalid={Boolean(issues?.walletId)}
              className={cn('h-11 w-full md:h-10', fieldErrorClass(issues?.walletId))}
            >
              <SelectValue placeholder="Billetera">
                {selectedWallet ? (
                  <WalletIdentity
                    name={selectedWallet.name}
                    providerIconKey={selectedWallet.provider_icon_key}
                    iconClassName="h-5 w-5 rounded-md"
                  />
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {walletOptions.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  <span className="flex items-center justify-between gap-3">
                    <WalletIdentity
                      name={w.name}
                      providerIconKey={w.provider_icon_key}
                      iconClassName="h-5 w-5 rounded-md"
                    />
                    <span className="font-sans text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(w.amount ?? 0)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className={fieldErrorClass(issues?.categoryId) ? 'rounded-md ' + fieldErrorClass(issues?.categoryId) : undefined}>
            <CategoryGroupedSelect
              categories={categories}
              value={row.categoryId ? row.categoryId : undefined}
              onValueChange={(id) => onChange({ categoryId: id })}
              onOpenChange={onSelectOpenChange}
              disabled={disabled || loading}
              includeCategoryId={row.categoryId || null}
              placeholder="Categoría"
              ariaLabel={`${label}: categoría`}
              triggerClassName="h-11 w-full md:h-10"
            />
          </div>

          <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 md:col-span-1 md:flex-col md:items-start md:gap-y-0.5">
            {!isIncome ? (
              <>
                <OptionCheck
                  label={isCredit ? 'Pagado (tarjeta)' : 'Pagado'}
                  checked={paid}
                  disabled={disabled || isCredit}
                  onChange={(v) => onChange({ isPaid: v })}
                />
                <OptionCheck
                  label="Recurrente"
                  checked={row.isRecurring}
                  disabled={disabled}
                  onChange={(v) =>
                    onChange({ isRecurring: v, applyToBothFortnights: v ? row.applyToBothFortnights : false })
                  }
                />
                {row.isRecurring ? (
                  <OptionCheck
                    label="Ambas quincenas"
                    checked={row.applyToBothFortnights}
                    disabled={disabled}
                    onChange={(v) => onChange({ applyToBothFortnights: v })}
                  />
                ) : null}
              </>
            ) : null}
            <div className="hidden md:block">
              <RowActions onDuplicate={onDuplicate} onRemove={onRemove} label={label} disabled={disabled} />
            </div>
          </div>
        </div>

        <RowMessages
          issues={issues}
          serverError={serverError?.message}
          exceeds={exceeds}
          skip={row.skipWalletDelta}
          walletName={selectedWallet?.name}
          onConfirmSkip={() => onChange({ skipWalletDelta: true })}
        />
      </div>
      {!expanded && layout === 'sheet' ? (
        <RowMessages
          issues={undefined}
          serverError={serverError?.message}
          exceeds={false}
          skip={false}
          onConfirmSkip={() => {}}
        />
      ) : null}
    </div>
  );
}

function RowMessages({
  issues,
  serverError,
  exceeds,
  skip,
  walletName,
  onConfirmSkip,
}: {
  issues?: BatchRowIssues;
  serverError?: string;
  exceeds: boolean;
  skip: boolean;
  walletName?: string;
  onConfirmSkip: () => void;
}) {
  const messages = issues ? Object.values(issues).filter(Boolean) : [];
  const showExceeds = exceeds && !skip;
  if (!serverError && messages.length === 0 && !showExceeds) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5" role="alert">
      {serverError ? <p className="text-xs text-destructive">{serverError}</p> : null}
      {messages
        .filter((m) => !(showExceeds && m?.startsWith('Supera el saldo')))
        .map((m) => (
          <p key={m} className="text-xs text-destructive">
            {m}
          </p>
        ))}
      {showExceeds ? (
        <div className="rounded-lg border border-status-pending/30 bg-status-pending/10 px-3 py-2 text-xs leading-snug text-status-pending">
          {walletName ?? 'La billetera'} no alcanza para este gasto con los movimientos anteriores del lote.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-8 w-full justify-start px-0 text-status-pending underline"
            onClick={onConfirmSkip}
          >
            Guardar sin afectar saldo
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function KindToggle({
  value,
  onChange,
  disabled,
  label,
}: {
  value: BatchRowKind;
  onChange: (kind: BatchRowKind) => void;
  disabled: boolean;
  label: string;
}) {
  const options: { id: BatchRowKind; text: string; Icon: typeof ArrowDownCircle }[] = [
    { id: 'expense', text: 'Gasto', Icon: ArrowDownCircle },
    { id: 'income', text: 'Ingreso', Icon: ArrowUpCircle },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={`${label}: tipo`}
      className="inline-flex rounded-full border border-border/60 bg-muted/40 p-0.5"
    >
      {options.map(({ id, text, Icon }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              'flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
              selected
                ? 'bg-background text-primary-text shadow-sm dark:bg-white/15'
                : 'text-muted-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="md:sr-only">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

function RowActions({
  onDuplicate,
  onRemove,
  label,
  disabled,
}: {
  onDuplicate: () => void;
  onRemove: () => void;
  label: string;
  disabled: boolean;
}) {
  return (
    <span className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${label}: duplicar`}
        disabled={disabled}
        onClick={onDuplicate}
        className="h-9 w-9"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${label}: eliminar`}
        disabled={disabled}
        onClick={onRemove}
        className="h-9 w-9 text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </span>
  );
}

function OptionCheck({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      {label}
    </label>
  );
}

/** Keeps what the user is typing ("12.") while storing a number. */
function AmountCell({
  value,
  onChange,
  invalid,
  disabled,
  label,
}: {
  value: number | '';
  onChange: (amount: number | '') => void;
  invalid: boolean;
  disabled: boolean;
  label: string;
}) {
  const [text, setText] = useState(value === '' ? '' : String(value));
  // The number the current text stands for; differs from `value` only when
  // the row changed from outside (duplicate, paste, restored draft).
  const [synced, setSynced] = useState<number | ''>(value);
  if (value !== synced) {
    setSynced(value);
    setText(value === '' ? '' : String(value));
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
      >
        $
      </span>
      <Input
        data-field="amount"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9.]/g, '');
          if ((next.match(/\./g) ?? []).length > 1) return;
          setText(next);
          const parsed = next === '' || next === '.' ? '' : Number(next);
          setSynced(parsed);
          onChange(parsed);
        }}
        placeholder="0.00"
        aria-label={label}
        aria-invalid={invalid}
        enterKeyHint="next"
        disabled={disabled}
        className={cn(
          'h-11 pl-6 text-right font-sans tabular-nums md:h-10',
          fieldErrorClass(invalid ? 'x' : undefined),
        )}
      />
    </div>
  );
}
