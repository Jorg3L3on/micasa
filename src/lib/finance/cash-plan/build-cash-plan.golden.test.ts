import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTION_CATALOG } from '@/lib/finance/cash-plan/catalog';
import { buildCashPlan } from '@/lib/finance/cash-plan/build-cash-plan';
import type { ActionTypeId, PlanInput, PlanMode, PlanResult, RiskTag } from '@/lib/finance/cash-plan/types';

type GoldenCase = {
  id: string;
  notes?: string;
  input: PlanInput;
  expectedMode: PlanMode;
  expectedPrimaryActionTypes?: ActionTypeId[];
  expectedPrimaryStrategy?: string;
  expectedPrimaryId?: string;
  forbiddenPrimaryActionTypes?: ActionTypeId[];
  forbiddenPrimaryObligationIds?: string[];
  expectConfidence?: PlanResult['confidence'];
  expectDataGapCodes?: string[];
  expectTie?: boolean;
  expectImpact?: boolean;
  expectRiskTags?: RiskTag[];
  expectAlternativeRiskTag?: RiskTag;
  expectAlternativeWarning?: string;
  forbidActionAmount?: number;
};

const cases = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/finance/cash-plan/golden/cases.json'), 'utf8'),
) as GoldenCase[];

const actionTypes = (result: PlanResult): ActionTypeId[] =>
  result.primary.actions.map((item) => item.type);

describe('cash plan golden cases', () => {
  it('covers at least 10 synthetic scenarios', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  it.each(cases.map((item) => [item.id, item] as const))('%s', (_id, golden) => {
    const first = buildCashPlan(golden.input);
    const second = buildCashPlan(golden.input);
    expect(second).toEqual(first);
    expect(first.mode).toBe(golden.expectedMode);
    expect(first.meta.engineVersion).toBe('cash-plan-1');
    expect(first.meta.computedAt).toBe(golden.input.computedAt);

    if (golden.expectedPrimaryId) {
      expect(first.primary.id).toBe(golden.expectedPrimaryId);
    }
    if (golden.expectedPrimaryStrategy) {
      expect(first.primary.strategyKey).toBe(golden.expectedPrimaryStrategy);
    }
    for (const type of golden.expectedPrimaryActionTypes ?? []) {
      expect(actionTypes(first), first.primary.summary).toContain(type);
    }
    for (const type of golden.forbiddenPrimaryActionTypes ?? []) {
      expect(actionTypes(first), JSON.stringify(first.primary)).not.toContain(type);
    }
    for (const obligationId of golden.forbiddenPrimaryObligationIds ?? []) {
      expect(first.primary.actions.some((item) => item.obligationId === obligationId)).toBe(false);
    }
    if (golden.expectConfidence) expect(first.confidence).toBe(golden.expectConfidence);
    for (const code of golden.expectDataGapCodes ?? []) {
      expect(first.dataGaps.map((gap) => gap.code)).toContain(code);
    }
    if (golden.expectTie != null) expect(first.tie).toBe(golden.expectTie);
    if (golden.expectImpact) {
      expect(first.primary.impact?.monthsDelta).toEqual(expect.any(Number));
      expect(first.primary.impact?.interestDelta).toEqual(expect.any(Number));
      const snowball = [first.primary, ...first.alternatives].find((plan) => plan.strategyKey === 'snowball');
      expect(snowball?.impact).toBeTruthy();
      expect(first.primary.impact?.interestDelta ?? 0).toBeGreaterThanOrEqual(snowball?.impact?.interestDelta ?? 0);
    }
    for (const tag of golden.expectRiskTags ?? []) {
      expect(first.primary.estimatedRiskTags).toContain(tag);
    }
    if (golden.expectAlternativeRiskTag) {
      expect(
        first.alternatives.some((plan) => plan.estimatedRiskTags.includes(golden.expectAlternativeRiskTag as RiskTag)),
      ).toBe(true);
    }
    if (golden.expectAlternativeWarning) {
      const blob = first.alternatives.flatMap((plan) => [...plan.warnings, ...plan.actions.flatMap((item) => item.warnings)]).join(' ');
      expect(blob).toContain(golden.expectAlternativeWarning);
    }
    if (golden.forbidActionAmount != null) {
      const amounts = [first.primary, ...first.alternatives].flatMap((plan) =>
        plan.actions.map((item) => item.amount),
      );
      expect(amounts).not.toContain(golden.forbidActionAmount);
    }
    expect(first.primary.actions.every((item) => item.type in ACTION_CATALOG)).toBe(true);
    expect(first.primary.touchesUntouchable).toBe(false);
  });

  it('emits every core catalog action across the suite', () => {
    const seen = new Set<ActionTypeId>();
    for (const golden of cases) {
      const result = buildCashPlan(golden.input);
      for (const plan of [result.primary, ...result.alternatives]) {
        for (const item of plan.actions) seen.add(item.type);
      }
    }
    for (const type of Object.keys(ACTION_CATALOG) as ActionTypeId[]) {
      expect(seen, type).toContain(type);
    }
  });
});
