import { describe, expect, it } from 'vitest'
import {
  createDeferredSubmit,
  createDuplicateGuard,
  shouldAutoSubmit,
  type TimerApi,
} from './dispatch'

/** Deterministic manual timers for testing debounce behavior. */
function manualTimers(): TimerApi & { flush: () => void; queued: () => number } {
  let nextId = 0
  const pending = new Map<number, () => void>()
  return {
    set(fn) {
      nextId += 1
      pending.set(nextId, fn)
      return nextId
    },
    clear(id) {
      pending.delete(id)
    },
    flush() {
      const fns = [...pending.values()]
      pending.clear()
      fns.forEach((fn) => fn())
    },
    queued: () => pending.size,
  }
}

describe('shouldAutoSubmit (automatic dispatch)', () => {
  it('auto-submits a completed final command in hands-free mode', () => {
    expect(shouldAutoSubmit('checkout memory pressure, restore', true)).toBe(
      true,
    )
  })

  it('never auto-submits when hands-free mode is off', () => {
    expect(shouldAutoSubmit('restore checkout', false)).toBe(false)
  })

  it('never auto-submits empty or whitespace-only recognitions', () => {
    expect(shouldAutoSubmit('', true)).toBe(false)
    expect(shouldAutoSubmit('   \n\t ', true)).toBe(false)
  })

  it('never auto-submits fragments below the minimum command length', () => {
    expect(shouldAutoSubmit('fix', true)).toBe(false)
    expect(shouldAutoSubmit('ok now', true)).toBe(false)
  })
})

describe('createDeferredSubmit (Wispr Flow / text auto-dispatch)', () => {
  it('fires exactly once after the pause with the latest submitted text', () => {
    const timers = manualTimers()
    const fired: string[] = []
    const deferred = createDeferredSubmit((text) => fired.push(text), 1500, timers)

    deferred.schedule('fix checkout')
    expect(deferred.pending).toBe(true)
    deferred.schedule('fix checkout capacity now')
    expect(timers.queued()).toBe(1)

    timers.flush()
    expect(fired).toEqual(['fix checkout capacity now'])
    expect(deferred.pending).toBe(false)

    timers.flush()
    expect(fired).toHaveLength(1)
  })

  it('cancel prevents the pending auto-submit', () => {
    const timers = manualTimers()
    const fired: string[] = []
    const deferred = createDeferredSubmit((text) => fired.push(text), 1500, timers)

    deferred.schedule('restore checkout capacity')
    deferred.cancel()
    expect(deferred.pending).toBe(false)
    timers.flush()
    expect(fired).toEqual([])
  })

  it('scheduling empty text cancels instead of arming a timer', () => {
    const timers = manualTimers()
    const fired: string[] = []
    const deferred = createDeferredSubmit((text) => fired.push(text), 1500, timers)

    deferred.schedule('restore checkout capacity')
    deferred.schedule('   ')
    expect(deferred.pending).toBe(false)
    timers.flush()
    expect(fired).toEqual([])
  })

  it('delivers the trimmed text so duplicate/guard logic sees the same form', () => {
    const timers = manualTimers()
    const fired: string[] = []
    const deferred = createDeferredSubmit((text) => fired.push(text), 1500, timers)

    deferred.schedule('  restore checkout capacity  ')
    timers.flush()
    expect(fired).toEqual(['restore checkout capacity'])
  })
})

describe('createDuplicateGuard (duplicate prevention)', () => {
  it('blocks the same command text inside the window', () => {
    const guard = createDuplicateGuard(2000)
    expect(guard.isDuplicate('fix checkout', 1000)).toBe(false)
    guard.record('fix checkout', 1000)
    expect(guard.isDuplicate('fix checkout', 2500)).toBe(true)
  })

  it('allows the same text again after the window expires', () => {
    const guard = createDuplicateGuard(2000)
    guard.record('fix checkout', 1000)
    expect(guard.isDuplicate('fix checkout', 3001)).toBe(false)
  })

  it('allows different text inside the window', () => {
    const guard = createDuplicateGuard(2000)
    guard.record('fix checkout', 1000)
    expect(guard.isDuplicate('investigate search', 1500)).toBe(false)
  })

  it('treats trimmed variants as the same command', () => {
    const guard = createDuplicateGuard(2000)
    guard.record('  fix checkout  ', 1000)
    expect(guard.isDuplicate('fix checkout', 1200)).toBe(true)
  })

  it('ignores empty submissions entirely', () => {
    const guard = createDuplicateGuard(2000)
    expect(guard.isDuplicate('', 1000)).toBe(false)
    guard.record('', 1000)
    expect(guard.isDuplicate('fix checkout', 1100)).toBe(false)
  })
})
