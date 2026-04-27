import { describe, expect, it } from 'vitest';
import { serializeHabit, serializeTaskItem } from '@/lib/server/tasks/serialize-tasks';

describe('serialize-tasks', () => {
  it('serializes task recurrence when present', () => {
    const result = serializeTaskItem({
      id: 1,
      list_id: 10,
      title: 'Pagar servicios',
      notes: null,
      status: 'TODO',
      priority: 'HIGH',
      due_at: new Date('2026-01-01T12:00:00.000Z'),
      completed_at: null,
      recurrence_unit: 'MONTH',
      recurrence_every: 1,
      recurrence_anchor: new Date('2026-01-01T12:00:00.000Z'),
      sort_order: 0,
      created_at: new Date('2026-01-01T12:00:00.000Z'),
      updated_at: new Date('2026-01-01T12:00:00.000Z'),
    });

    expect(result.recurrence).toEqual({
      unit: 'MONTH',
      every: 1,
      anchor: '2026-01-01T12:00:00.000Z',
    });
  });

  it('computes streak from consecutive habit logs', () => {
    const result = serializeHabit({
      id: 1,
      name: 'Tomar agua',
      description: null,
      active: true,
      recurrence_unit: 'DAY',
      recurrence_every: 1,
      target_per_period: 1,
      reminder_time: null,
      created_at: new Date('2026-01-03T10:00:00.000Z'),
      updated_at: new Date('2026-01-03T10:00:00.000Z'),
      logs: [
        {
          id: 3,
          completed_on: new Date('2026-01-03T08:00:00.000Z'),
          note: null,
          created_at: new Date('2026-01-03T08:00:00.000Z'),
        },
        {
          id: 2,
          completed_on: new Date('2026-01-02T08:00:00.000Z'),
          note: null,
          created_at: new Date('2026-01-02T08:00:00.000Z'),
        },
        {
          id: 1,
          completed_on: new Date('2026-01-01T08:00:00.000Z'),
          note: null,
          created_at: new Date('2026-01-01T08:00:00.000Z'),
        },
      ],
    });

    expect(result.current_streak).toBe(3);
    expect(result.logs).toHaveLength(3);
  });
});
