/**
 * Pure voice-first dispatch logic, shared by the store and the Voice Command
 * bar so tests exercise the exact code paths production uses.
 *
 * Voice text never grants policy approval — these helpers only decide *when*
 * a run starts, never *what authority* it carries.
 */

export const DUPLICATE_WINDOW_MS = 2000

/** Pause after the last input change before an auto-submit fires. */
export const AUTO_DISPATCH_DEBOUNCE_MS = 1500

/** Commands shorter than this are never auto-submitted (manual fallback). */
export const MIN_COMMAND_LENGTH = 8

/**
 * A completed final command auto-submits only in hands-free mode and only
 * when there is real text to send (short fragments use the manual path).
 */
export function shouldAutoSubmit(text: string, handsFree: boolean): boolean {
  if (!handsFree) return false
  return text.trim().length >= MIN_COMMAND_LENGTH
}

export interface DuplicateGuard {
  /** True when this exact trimmed text was already recorded inside the window. */
  isDuplicate(text: string, now?: number): boolean
  /** Record an accepted submission. */
  record(text: string, now?: number): void
}

/**
 * Duplicate-submission protection: the same command text accepted twice
 * within the window is rejected (double finals, double clicks, re-speaks).
 */
export function createDuplicateGuard(
  windowMs: number = DUPLICATE_WINDOW_MS,
): DuplicateGuard {
  let last: { text: string; at: number } | null = null
  return {
    isDuplicate(text, now = Date.now()) {
      const trimmed = text.trim()
      if (!trimmed) return false
      return (
        last !== null && last.text === trimmed && now - last.at < windowMs
      )
    },
    record(text, now = Date.now()) {
      const trimmed = text.trim()
      if (!trimmed) return
      last = { text: trimmed, at: now }
    },
  }
}

export interface TimerApi {
  set: (fn: () => void, ms: number) => number
  clear: (id: number) => void
}

export interface DeferredSubmit {
  /** (Re)arm the timer; an empty text cancels instead. */
  schedule: (text: string) => void
  /** Cancel any pending auto-submit. */
  cancel: () => void
  readonly pending: boolean
}

/**
 * Debounced auto-submit for text that lands in the command bar without a
 * browser recognition session — this is how Wispr Flow (or any system
 * dictation/typing) submissions reach the safe dispatch path without a
 * Dispatch click. Each new change replaces the pending timer; the fire
 * callback receives the latest trimmed text exactly once.
 */
export function createDeferredSubmit(
  fire: (text: string) => void,
  delayMs: number = AUTO_DISPATCH_DEBOUNCE_MS,
  timers: TimerApi = {
    set: (fn, ms) => window.setTimeout(fn, ms),
    clear: (id) => window.clearTimeout(id),
  },
): DeferredSubmit {
  let timerId: number | null = null
  let latest = ''

  const cancel = (): void => {
    if (timerId !== null) {
      timers.clear(timerId)
      timerId = null
    }
    latest = ''
  }

  return {
    schedule(text) {
      const trimmed = text.trim()
      if (!trimmed) {
        cancel()
        return
      }
      latest = trimmed
      if (timerId !== null) timers.clear(timerId)
      timerId = timers.set(() => {
        timerId = null
        const ready = latest
        latest = ''
        if (ready) fire(ready)
      }, delayMs)
    },
    cancel,
    get pending() {
      return timerId !== null
    },
  }
}
