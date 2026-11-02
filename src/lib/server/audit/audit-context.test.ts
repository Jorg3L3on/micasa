import { describe, expect, it, vi } from 'vitest'

describe('audit actor store', () => {
  it('is shared by every instance of the module (Next.js loads server modules more than once)', async () => {
    const first = await import('./audit-context')
    vi.resetModules()
    const second = await import('./audit-context')
    expect(second).not.toBe(first)

    const seen = await first.runWithAuditActor({ source: 'WEB', userId: 7 }, async () => {
      await Promise.resolve()
      return second.getAuditActor()
    })
    expect(seen).toMatchObject({ source: 'WEB', userId: 7 })
  })

  it('setAuditLabel labels the rest of the batch', async () => {
    const { getAuditActor, runWithAuditActor, setAuditLabel } = await import('./audit-context')
    const labels = await runWithAuditActor({ source: 'SYSTEM' }, async () => {
      const before = getAuditActor()?.label ?? null
      setAuditLabel('Importación de estado de cuenta: Mercado Pago')
      await Promise.resolve()
      return [before, getAuditActor()?.label]
    })
    expect(labels).toEqual([null, 'Importación de estado de cuenta: Mercado Pago'])
  })
})
