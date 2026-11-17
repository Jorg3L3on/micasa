'use client';

import { useState, type CSSProperties } from 'react';

import {
  FREE_FIRST,
  FREE_MONTH,
  FREE_SECOND,
  MONTH_INCOME,
  MONTH_SPENT,
  PAYCHECK,
  QUINCENAS,
  SIMULATOR_DEFAULT,
  SIMULATOR_MAX,
  SIMULATOR_STEP,
  describeDay,
  expensesOfQuincena,
  formatPesos,
  freeInQuincena,
  halfOfDay,
  simulatePurchase,
  spentInQuincena,
  type QuincenaIndex,
} from '@/components/landing/landing-data';

/* -------------------------------------------------------------------------- */
/* Ver por mes / Ver por quincena                                             */
/* -------------------------------------------------------------------------- */

type CompareBar = {
  label: string;
  free: string;
  tone: string;
  spentShare: number;
  note: string;
};

const share = (spent: number, income: number) => Math.round((spent / income) * 1000) / 10;

const MONTH_BARS: CompareBar[] = [
  {
    label: 'EL MES COMPLETO',
    free: `${formatPesos(FREE_MONTH)} libres`,
    tone: '#34d399',
    spentShare: share(MONTH_SPENT, MONTH_INCOME),
    note: `Cobras ${formatPesos(MONTH_INCOME)} · pagas ${formatPesos(MONTH_SPENT)}`,
  },
];

const QUINCENA_BARS: CompareBar[] = [
  {
    label: 'PRIMERA QUINCENA',
    free: `${formatPesos(FREE_FIRST)} libres`,
    tone: '#ffc45c',
    spentShare: share(spentInQuincena(0), PAYCHECK),
    note: `Cobras ${formatPesos(PAYCHECK)} · pagas ${formatPesos(spentInQuincena(0))} (renta y tarjeta)`,
  },
  {
    label: 'SEGUNDA QUINCENA',
    free: `${formatPesos(FREE_SECOND)} libres`,
    tone: '#34d399',
    spentShare: share(spentInQuincena(1), PAYCHECK),
    note: `Cobras ${formatPesos(PAYCHECK)} · pagas ${formatPesos(spentInQuincena(1))}`,
  },
];

export const MonthCompare = () => {
  const [view, setView] = useState<'mes' | 'quincena'>('mes');
  const byMonth = view === 'mes';
  const bars = byMonth ? MONTH_BARS : QUINCENA_BARS;

  return (
    <div className="mc-compare mc-view">
      <div>
        <div className="mc-switch" role="group" aria-label="Vista">
          <button type="button" aria-pressed={byMonth} onClick={() => setView('mes')}>
            Ver por mes
          </button>
          <button type="button" aria-pressed={!byMonth} onClick={() => setView('quincena')}>
            Ver por quincena
          </button>
        </div>
        <div aria-live="polite">
          <p className="mc-compare-title" style={{ color: byMonth ? '#34d399' : '#ffc45c' }}>
            {byMonth
              ? `El mes dice: te sobran ${formatPesos(FREE_MONTH)}.`
              : `La quincena dice: en la primera, solo ${formatPesos(FREE_FIRST)}.`}
          </p>
          <p className="mc-compare-text">
            {byMonth
              ? 'Suena bien. Pero ese dinero no está disponible todo al mismo tiempo. Cámbialo a quincena.'
              : 'Ahí caen la renta y la tarjeta. MiCasa te lo enseña antes de que gastes lo que es de la segunda.'}
          </p>
        </div>
      </div>
      <div className="mc-panel mc-bars">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="mc-bar-head">
              <span className="mc-kicker">{bar.label}</span>
              <span className="mc-bar-free mc-num" style={{ color: bar.tone }}>
                {bar.free}
              </span>
            </div>
            <div className="mc-bar-track" aria-hidden="true">
              <div className="mc-bar mc-bar-spent" style={{ width: `${bar.spentShare}%` }} />
              <div
                className="mc-bar mc-bar-left"
                style={{ width: `${100 - bar.spentShare}%`, background: bar.tone }}
              />
            </div>
            <p className="mc-note">{bar.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 31-day grid                                                                */
/* -------------------------------------------------------------------------- */

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export const DayGrid = () => {
  const [day, setDay] = useState(31);
  const answer = describeDay(day);

  return (
    <div className="mc-panel mc-days mc-view">
      <div className="mc-days-head">
        <p className="mc-kicker">TOCA UN DÍA · MES DE 31 DÍAS</p>
        <p className="mc-note">¿Con qué cobro se paga?</p>
      </div>
      <div className="mc-day-grid" role="group" aria-label="Días del mes">
        {DAYS.map((n) => (
          <button
            key={n}
            type="button"
            className="mc-day"
            data-half={halfOfDay(n)}
            aria-pressed={n === day}
            aria-label={`Día ${n}`}
            onClick={() => setDay(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mc-day-answer" aria-live="polite">
        <p className="mc-day-title" style={{ color: answer.tone }}>
          {answer.title}
        </p>
        <p className="mc-day-text">{answer.text}</p>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Panel financiero: two quincenas, tap an expense to mark it paid            */
/* -------------------------------------------------------------------------- */

const QUINCENA_INDEXES: QuincenaIndex[] = [0, 1];
const INITIALLY_PAID = ['renta', 'super'];

export const PanelDemo = () => {
  const [paid, setPaid] = useState<ReadonlySet<string>>(() => new Set(INITIALLY_PAID));

  const handleToggle = (id: string) => {
    setPaid((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mc-cols">
      {QUINCENA_INDEXES.map((index) => {
        const quincena = QUINCENAS[index];
        const rows = expensesOfQuincena(index);
        const done = rows.filter((row) => paid.has(row.id)).length;
        const due = rows
          .filter((row) => !paid.has(row.id))
          .reduce((sum, row) => sum + row.amount, 0);
        return (
          <div key={quincena.name} className="mc-col">
            <div className="mc-col-head">
              <p className="mc-col-name" style={{ color: quincena.tone }}>
                {quincena.name}
              </p>
              <p className="mc-col-range">{quincena.range}</p>
            </div>
            <div className="mc-col-stats">
              <div>
                <p className="mc-stat-label">Por pagar</p>
                <p className="mc-stat-value mc-num">{formatPesos(due)}</p>
              </div>
              <div>
                <p className="mc-stat-label">Libre después de todo</p>
                <p className="mc-stat-value mc-num" style={{ color: '#34d399' }}>
                  {formatPesos(freeInQuincena(index))}
                </p>
              </div>
            </div>
            <div className="mc-progress" aria-hidden="true">
              <span style={{ width: `${Math.round((done / rows.length) * 100)}%` }} />
            </div>
            <p className="mc-note" aria-live="polite">
              {done} de {rows.length} pagados
            </p>
            <div className="mc-rows">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="mc-row"
                  aria-pressed={paid.has(row.id)}
                  onClick={() => handleToggle(row.id)}
                >
                  <span className="mc-row-check" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="12" height="12">
                      <path
                        d="M3 8.5l3.2 3L13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="mc-row-text">
                    <span className="mc-row-name">{row.panelName}</span>
                    <span className="mc-row-meta">
                      Día {row.day} · {row.via}
                    </span>
                  </span>
                  <span className="mc-row-amount mc-num">{formatPesos(row.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Simular compra                                                             */
/* -------------------------------------------------------------------------- */

const MARK_LEFT = `${Math.round((FREE_FIRST / FREE_MONTH) * 1000) / 10}%`;

export const PurchaseSimulator = () => {
  const [amount, setAmount] = useState(SIMULATOR_DEFAULT);
  const result = simulatePurchase(amount);

  return (
    <>
      <div>
        <label htmlFor="mc-amount" className="mc-sim-label">
          Monto de la compra <span className="mc-sim-amount mc-num">{formatPesos(amount)}</span>
        </label>
        <input
          id="mc-amount"
          className="mc-range"
          type="range"
          min={0}
          max={SIMULATOR_MAX}
          step={SIMULATOR_STEP}
          value={amount}
          aria-valuetext={formatPesos(amount)}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
      </div>
      <div className="mc-sim-track" aria-hidden="true">
        <div
          className="mc-sim-fill"
          style={{ width: `${result.percent}%`, background: result.tone }}
        />
        <div className="mc-sim-mark" style={{ left: MARK_LEFT }} />
      </div>
      <p className="mc-sim-hint">La marca es lo libre de la primera quincena.</p>
      <div
        className="mc-verdict"
        data-verdict={result.verdict}
        style={{ borderColor: result.tone } as CSSProperties}
        aria-live="polite"
      >
        <p className="mc-verdict-title" style={{ color: result.tone }}>
          {result.title}
        </p>
        <p className="mc-verdict-text">{result.text}</p>
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Personal / Casa                                                            */
/* -------------------------------------------------------------------------- */

const CASA_ITEMS = [
  { name: 'Renta', amount: 7500 },
  { name: 'Luz', amount: 640 },
  { name: 'Súper', amount: 2400 },
];

const PERSONAL_ITEMS = [
  { name: 'Celular', amount: 399 },
  { name: 'Gimnasio', amount: 650 },
  { name: 'Ahorro para viaje', amount: 1500 },
];

export const ContextSwitch = () => {
  const [context, setContext] = useState<'personal' | 'casa'>('casa');
  const isCasa = context === 'casa';
  const items = isCasa ? CASA_ITEMS : PERSONAL_ITEMS;

  return (
    <div className="mc-panel mc-context mc-view">
      <div className="mc-switch" role="group" aria-label="Contexto">
        <button type="button" aria-pressed={!isCasa} onClick={() => setContext('personal')}>
          Personal
        </button>
        <button type="button" aria-pressed={isCasa} onClick={() => setContext('casa')}>
          Casa
        </button>
      </div>
      <div className="mc-context-body" aria-live="polite">
        <div className="mc-chips">
          {isCasa ? (
            <>
              <span className="mc-chip mc-chip-owner">Dueño</span>
              <span className="mc-chip mc-chip-admin">Administrador</span>
              <span className="mc-chip">Miembro</span>
            </>
          ) : (
            <span className="mc-chip mc-chip-solo">Solo tú</span>
          )}
        </div>
        {items.map((item) => (
          <div key={item.name} className="mc-line-item">
            <span>{item.name}</span>
            <span className="mc-num">{formatPesos(item.amount)}</span>
          </div>
        ))}
        <p className="mc-note">
          {isCasa
            ? 'Todos ven lo mismo. Puedes transferir de tu billetera a la de la casa.'
            : 'Nadie más ve este lado.'}
        </p>
      </div>
    </div>
  );
};
