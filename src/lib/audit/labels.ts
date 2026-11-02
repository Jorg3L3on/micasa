/**
 * Spanish labels and display formats for audit rows (Actividad, Historial,
 * CSV). Shared by the read API and the UI; no server imports.
 *
 * Every audited model (src/lib/server/audit/audited-models.ts) needs an entry
 * in ENTITY_LABELS and every visible column a FieldSpec; labels.test.ts checks
 * both against prisma/schema.prisma, including that money and date columns
 * use the right kind.
 */
import { formatDisplayDate } from '@/lib/calendar-dates';
import { formatMoney } from '@/lib/money';

export type FieldKind =
  | 'text'
  | 'money'
  | 'percent'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'ref'
  | 'list'
  | 'json';

export type FieldSpec = { label: string; kind: FieldKind };

/** Never shown in a diff (bookkeeping or stripped by the trigger anyway). */
export const HIDDEN_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'created_at',
  'updated_at',
  'password',
  'file_data',
]);

export const ENTITY_LABELS: Readonly<Record<string, { singular: string; plural: string }>> = {
  Expense: { singular: 'Gasto', plural: 'Gastos' },
  Income: { singular: 'Ingreso', plural: 'Ingresos' },
  ExpenseTemplate: { singular: 'Gasto recurrente', plural: 'Gastos recurrentes' },
  IncomeTemplate: { singular: 'Ingreso recurrente', plural: 'Ingresos recurrentes' },
  Category: { singular: 'Categoría', plural: 'Categorías' },
  Wallet: { singular: 'Billetera', plural: 'Billeteras' },
  WalletTransfer: { singular: 'Transferencia entre billeteras', plural: 'Transferencias entre billeteras' },
  Transfer: { singular: 'Aporte a la casa', plural: 'Aportes a la casa' },
  Budget: { singular: 'Presupuesto', plural: 'Presupuestos' },
  BudgetPeriod: { singular: 'Periodo de presupuesto', plural: 'Periodos de presupuesto' },
  BudgetAllocation: { singular: 'Asignación de presupuesto', plural: 'Asignaciones de presupuesto' },
  CreditCardPayment: { singular: 'Pago de tarjeta', plural: 'Pagos de tarjeta' },
  CreditCardPaymentPlan: { singular: 'Plan de pago de tarjeta', plural: 'Planes de pago de tarjeta' },
  CreditCardScheduledPayment: { singular: 'Pago programado', plural: 'Pagos programados' },
  CreditCardInstallmentPlan: { singular: 'Compra a meses', plural: 'Compras a meses' },
  CreditCardInstallmentPlanPayment: { singular: 'Mensualidad', plural: 'Mensualidades' },
  CreditCardStatementImport: { singular: 'Estado de cuenta importado', plural: 'Estados de cuenta importados' },
  Loan: { singular: 'Préstamo', plural: 'Préstamos' },
  LoanPayment: { singular: 'Pago de préstamo', plural: 'Pagos de préstamo' },
  Lender: { singular: 'Prestamista', plural: 'Prestamistas' },
  LenderPayment: { singular: 'Abono a prestamista', plural: 'Abonos a prestamistas' },
  House: { singular: 'Casa', plural: 'Casas' },
  HouseMember: { singular: 'Miembro de la casa', plural: 'Miembros de la casa' },
  Fortnight: { singular: 'Quincena', plural: 'Quincenas' },
  User: { singular: 'Cuenta', plural: 'Cuentas' },
};

/** Columns that mean the same in every model. */
const COMMON_FIELDS: Readonly<Record<string, FieldSpec>> = {
  name: { label: 'Nombre', kind: 'text' },
  description: { label: 'Descripción', kind: 'text' },
  amount: { label: 'Monto', kind: 'money' },
  note: { label: 'Nota', kind: 'text' },
  notes: { label: 'Notas', kind: 'text' },
  label: { label: 'Etiqueta', kind: 'text' },
  active: { label: 'Activo', kind: 'boolean' },
  status: { label: 'Estado', kind: 'enum' },
  user_id: { label: 'Usuario', kind: 'ref' },
  house_id: { label: 'Casa', kind: 'ref' },
  wallet_id: { label: 'Billetera', kind: 'ref' },
  category_id: { label: 'Categoría', kind: 'ref' },
  fortnight_id: { label: 'Quincena', kind: 'ref' },
  source_wallet_id: { label: 'Billetera de origen', kind: 'ref' },
  credit_card_wallet_id: { label: 'Tarjeta', kind: 'ref' },
  credit_card_payment_id: { label: 'Pago de tarjeta', kind: 'ref' },
  expense_id: { label: 'Gasto', kind: 'ref' },
  due_day: { label: 'Día de pago', kind: 'number' },
  cutoff_day: { label: 'Día de corte', kind: 'number' },
  due_date: { label: 'Fecha de pago', kind: 'date' },
  paid_at: { label: 'Pagado el', kind: 'date' },
  start_date: { label: 'Inicio', kind: 'date' },
  end_date: { label: 'Fin', kind: 'date' },
  sequence: { label: 'Número', kind: 'number' },
  suggested_amount: { label: 'Monto sugerido', kind: 'money' },
  applies_first_fortnight: { label: 'Aplica en 1.ª quincena', kind: 'boolean' },
  applies_second_fortnight: { label: 'Aplica en 2.ª quincena', kind: 'boolean' },
  minimum_payment: { label: 'Pago mínimo', kind: 'money' },
  provider_icon_key: { label: 'Ícono', kind: 'text' },
  source: { label: 'Fuente', kind: 'text' },
};

/** Model-specific columns, or overrides of COMMON_FIELDS. */
export const FIELD_LABELS: Readonly<Record<string, Readonly<Record<string, FieldSpec>>>> = {
  Expense: {
    is_paid: { label: 'Pagado', kind: 'boolean' },
    payment_date: { label: 'Fecha de pago', kind: 'date' },
    credit_installment_current: { label: 'Mensualidad actual', kind: 'number' },
    credit_installment_total: { label: 'Mensualidades totales', kind: 'number' },
    expense_template_id: { label: 'Gasto recurrente', kind: 'ref' },
    loan_payment_id: { label: 'Pago de préstamo', kind: 'ref' },
    statement_import_id: { label: 'Estado de cuenta', kind: 'ref' },
  },
  Income: {
    received_at: { label: 'Recibido el', kind: 'date' },
    income_template_id: { label: 'Ingreso recurrente', kind: 'ref' },
    wallet_credited: { label: 'Abonado a la billetera', kind: 'boolean' },
  },
  ExpenseTemplate: {
    is_recurring: { label: 'Recurrente', kind: 'boolean' },
    is_subscription: { label: 'Suscripción', kind: 'boolean' },
    due_day_first_fortnight: { label: 'Día de pago (1.ª quincena)', kind: 'number' },
    due_day_second_fortnight: { label: 'Día de pago (2.ª quincena)', kind: 'number' },
  },
  IncomeTemplate: {},
  Category: {
    icon: { label: 'Ícono', kind: 'text' },
    sort_order: { label: 'Orden', kind: 'number' },
    parent_id: { label: 'Categoría padre', kind: 'ref' },
    kind: { label: 'Tipo', kind: 'enum' },
  },
  Wallet: {
    amount: { label: 'Saldo', kind: 'money' },
    credit_limit: { label: 'Límite de crédito', kind: 'money' },
    temporary_credit_limit: { label: 'Límite temporal', kind: 'money' },
    temporary_credit_limit_as_of: { label: 'Límite temporal al', kind: 'date' },
    type: { label: 'Tipo', kind: 'enum' },
    apr_annual: { label: 'Tasa anual', kind: 'percent' },
    cat_annual: { label: 'CAT anual', kind: 'percent' },
    include_in_liquidity: { label: 'Cuenta en liquidez', kind: 'boolean' },
    last_paid_period: { label: 'Último periodo pagado', kind: 'text' },
    goal_amount: { label: 'Meta', kind: 'money' },
    goal_due_date: { label: 'Fecha meta', kind: 'date' },
    assignee_user_id: { label: 'Asignada a', kind: 'ref' },
  },
  WalletTransfer: {
    fee_amount: { label: 'Comisión', kind: 'money' },
    from_wallet_id: { label: 'Desde', kind: 'ref' },
    to_wallet_id: { label: 'Hacia', kind: 'ref' },
    transferred_at: { label: 'Fecha', kind: 'date' },
    exclude_from_report: { label: 'Fuera de reportes', kind: 'boolean' },
  },
  Transfer: {
    type: { label: 'Tipo', kind: 'enum' },
    user_expense_id: { label: 'Gasto personal', kind: 'ref' },
    house_income_id: { label: 'Ingreso de la casa', kind: 'ref' },
  },
  Budget: {
    total_amount: { label: 'Monto total', kind: 'money' },
    frequency: { label: 'Frecuencia', kind: 'enum' },
    recurrent: { label: 'Recurrente', kind: 'boolean' },
  },
  BudgetPeriod: {
    budget_id: { label: 'Presupuesto', kind: 'ref' },
  },
  BudgetAllocation: {
    budget_id: { label: 'Presupuesto', kind: 'ref' },
  },
  CreditCardPayment: {
    adjusts_debt: { label: 'Ajusta la deuda', kind: 'boolean' },
    bank_charge_expense_id: { label: 'Gasto del cargo bancario', kind: 'ref' },
  },
  CreditCardPaymentPlan: {
    planned_amount: { label: 'Monto planeado', kind: 'money' },
    declared_zero: { label: 'Sin pago esta quincena', kind: 'boolean' },
    scope: { label: 'Alcance', kind: 'enum' },
    cycle_count: { label: 'Ciclos', kind: 'number' },
    valid_until: { label: 'Vigente hasta', kind: 'date' },
    anchor_statement_end: { label: 'Corte de referencia', kind: 'date' },
    over_debt_reason: { label: 'Motivo sobre la deuda', kind: 'enum' },
  },
  CreditCardScheduledPayment: {},
  CreditCardInstallmentPlan: {
    installment_amount: { label: 'Mensualidad', kind: 'money' },
    total_installments: { label: 'Mensualidades', kind: 'number' },
    paid_installments: { label: 'Pagadas', kind: 'number' },
    already_in_card_balance: { label: 'Ya en el saldo de la tarjeta', kind: 'boolean' },
  },
  CreditCardInstallmentPlanPayment: {
    plan_id: { label: 'Compra a meses', kind: 'ref' },
  },
  CreditCardStatementImport: {
    provider: { label: 'Emisor', kind: 'enum' },
    created_by_user_id: { label: 'Importado por', kind: 'ref' },
    file_name: { label: 'Archivo', kind: 'text' },
    file_mime: { label: 'Tipo de archivo', kind: 'text' },
    period_start: { label: 'Inicio del periodo', kind: 'date' },
    period_end: { label: 'Fin del periodo', kind: 'date' },
    account_number: { label: 'Cuenta', kind: 'text' },
    statement_issue_date: { label: 'Fecha de corte', kind: 'date' },
    payment_due_date: { label: 'Fecha límite de pago', kind: 'date' },
    total_due: { label: 'Total a pagar', kind: 'money' },
    parse_warnings: { label: 'Avisos', kind: 'list' },
  },
  Loan: {
    lender: { label: 'Prestamista', kind: 'text' },
    lender_id: { label: 'Prestamista vinculado', kind: 'ref' },
    type: { label: 'Tipo', kind: 'enum' },
    principal_amount: { label: 'Monto prestado', kind: 'money' },
    payment_amount: { label: 'Pago', kind: 'money' },
    payment_count: { label: 'Número de pagos', kind: 'number' },
    frequency: { label: 'Frecuencia', kind: 'enum' },
    payment_source: { label: 'Forma de pago', kind: 'enum' },
    linked_wallet_id: { label: 'Billetera vinculada', kind: 'ref' },
    income_template_id: { label: 'Ingreso recurrente', kind: 'ref' },
  },
  LoanPayment: {
    loan_id: { label: 'Préstamo', kind: 'ref' },
    lender_payment_id: { label: 'Abono a prestamista', kind: 'ref' },
  },
  Lender: {},
  LenderPayment: {
    lender_id: { label: 'Prestamista', kind: 'ref' },
    mode: { label: 'Modo', kind: 'enum' },
    allocation: { label: 'Reparto', kind: 'json' },
  },
  House: {
    owner_id: { label: 'Dueño', kind: 'ref' },
  },
  HouseMember: {
    role: { label: 'Rol', kind: 'enum' },
  },
  Fortnight: {
    label: { label: 'Quincena', kind: 'text' },
    month: { label: 'Mes', kind: 'number' },
    year: { label: 'Año', kind: 'number' },
    period: { label: 'Periodo', kind: 'enum' },
    closed: { label: 'Cerrada', kind: 'boolean' },
  },
  User: {
    email: { label: 'Correo', kind: 'text' },
    is_admin: { label: 'Administrador de MiCasa', kind: 'boolean' },
    onboarding_completed: { label: 'Configuración inicial completa', kind: 'boolean' },
  },
};

export const ENUM_VALUE_LABELS: Readonly<Record<string, string>> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEPARTMENT_STORE_CARD: 'Tarjeta departamental',
  GOAL: 'Meta',
  FIRST: '1.ª quincena',
  SECOND: '2.ª quincena',
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  CUSTOM: 'Personalizado',
  EXPENSE: 'Gasto',
  INCOME: 'Ingreso',
  SCHEDULED: 'Programado',
  PAID: 'Pagado',
  ACTIVE: 'Activo',
  COMPLETED: 'Terminado',
  PERSONAL: 'Personal',
  PAYROLL: 'Nómina',
  FORTNIGHTLY: 'Quincenal',
  MONTHLY: 'Mensual',
  WALLET: 'Billetera',
  PAYROLL_DEDUCTION: 'Descuento de nómina',
  EXTERNAL: 'Externo',
  USER_TO_HOUSE: 'De persona a casa',
  THIS_CYCLE: 'Este ciclo',
  N_CYCLES: 'Varios ciclos',
  UNTIL_DATE: 'Hasta una fecha',
  INTEREST: 'Interés',
  LATE_FEE: 'Cargo por atraso',
  OTHER: 'Otro',
  MERCADO_PAGO: 'Mercado Pago',
  CA_DEPARTAMENTAL: 'C&A Departamental',
  CA_EFECTIVO: 'C&A Efectivo',
  DIDI_CARD: 'DiDi Card',
  LIVERPOOL: 'Liverpool',
};

export const ACTION_LABELS: Readonly<Record<'CREATE' | 'UPDATE' | 'DELETE', { verb: string; label: string }>> = {
  CREATE: { verb: 'creó', label: 'Creación' },
  UPDATE: { verb: 'editó', label: 'Edición' },
  DELETE: { verb: 'eliminó', label: 'Eliminación' },
};

export const SOURCE_LABELS: Readonly<Record<'WEB' | 'AGENT' | 'ADMIN' | 'SYSTEM', string>> = {
  WEB: 'App',
  AGENT: 'Agente',
  ADMIN: 'Soporte',
  SYSTEM: 'Sistema',
};

export const entityLabel = (model: string): string => ENTITY_LABELS[model]?.singular ?? model;

export const fieldSpec = (model: string, field: string): FieldSpec =>
  FIELD_LABELS[model]?.[field] ?? COMMON_FIELDS[field] ?? { label: field, kind: 'text' };

export const isVisibleField = (field: string): boolean => !HIDDEN_FIELDS.has(field);

const EMPTY = '—';

/** Civil day from a stored value: `YYYY-MM-DD…` (wall-clock timestamp or DATE). */
const civilDay = (value: string): string | null => (/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

/** Display string for one audited value, as users see it in forms. */
export const formatAuditValue = (model: string, field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return EMPTY;
  const { kind } = fieldSpec(model, field);
  switch (kind) {
    case 'money': {
      const n = Number(value);
      return Number.isFinite(n) ? formatMoney(n) : String(value);
    }
    case 'percent': {
      const n = Number(value);
      return Number.isFinite(n)
        ? `${(n * 100).toLocaleString('es-MX', { maximumFractionDigits: 2 })} %`
        : String(value);
    }
    case 'boolean':
      return value === true || value === 'true' ? 'Sí' : 'No';
    case 'date': {
      const day = typeof value === 'string' ? civilDay(value) : null;
      return day ? formatDisplayDate(day) : String(value);
    }
    case 'datetime': {
      const day = typeof value === 'string' ? civilDay(value) : null;
      return day ? `${formatDisplayDate(day)} ${String(value).slice(11, 16)}` : String(value);
    }
    case 'enum':
      return ENUM_VALUE_LABELS[String(value)] ?? String(value);
    case 'ref':
      return `#${value}`;
    case 'list':
      return Array.isArray(value) ? (value.length ? value.join(', ') : EMPTY) : String(value);
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('es-MX') : String(value);
    default:
      return String(value);
  }
};
