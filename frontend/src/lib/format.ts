export function shortId(id: string, size = 8): string {
  return id.length > size ? `${id.slice(0, size)}…` : id
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value < 1) return `${value.toFixed(3)} ms`
  if (value < 1000) return `${value.toFixed(1)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

export function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function relative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const delta = Math.max(0, now - then)
  if (delta < 1000) return 'just now'
  const seconds = Math.round(delta / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}

/** Compact one-line rendering of an event payload for the console. */
export function eventSummary(event: Record<string, unknown>): string {
  const skip = new Set(['seq', 'agent', 'type', 'simulation_only'])
  const parts: string[] = []
  for (const [key, value] of Object.entries(event)) {
    if (skip.has(key)) continue
    if (Array.isArray(value)) {
      parts.push(`${key}=[${value.length} items]`)
    } else if (typeof value === 'object' && value !== null) {
      parts.push(`${key}={…}`)
    } else {
      parts.push(`${key}=${String(value)}`)
    }
  }
  return parts.join('  ')
}
