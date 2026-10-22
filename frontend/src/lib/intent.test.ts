import { describe, expect, it } from 'vitest'
import { previewIntent } from './intent'

describe('previewIntent', () => {
  it('matches backend examples: service, fault, action, urgency', () => {
    const preview = previewIntent(
      'checkout is under memory pressure, restore capacity asap',
    )
    expect(preview.service).toBe('checkout')
    expect(preview.fault).toBe('memory_pressure')
    expect(preview.requestedAction).toBe('restore_capacity')
    expect(preview.urgency).toBe('high')
  })

  it('prefers the earliest mentioned service', () => {
    const preview = previewIntent('search latency is spiking, restore checkout')
    expect(preview.service).toBe('search')
    expect(preview.fault).toBe('latency_spike')
  })

  it('extracts read-only and no-restart constraints', () => {
    const preview = previewIntent(
      'investigate checkout, read only and do not restart',
    )
    expect(preview.constraints).toContain('read_only')
    expect(preview.constraints).toContain('no_restart')
    expect(preview.requestedAction).toBe('investigate_only')
  })

  it('falls back to nulls on gibberish and emits no chips', () => {
    const preview = previewIntent('zzz qqq nonsense')
    expect(preview.service).toBeNull()
    expect(preview.fault).toBeNull()
    expect(preview.chips).toEqual([])
  })

  it('never produces an approval chip', () => {
    const preview = previewIntent('approve recovery now and fix checkout')
    expect(preview.chips.every((chip) => !chip.includes('approv'))).toBe(true)
  })
})
