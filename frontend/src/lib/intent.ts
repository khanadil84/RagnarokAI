/**
 * Client-side mirror of backend/core/intent.py for pre-dispatch intent chips.
 * The backend re-parses server-side; this preview never grants authority and
 * never grants approval.
 */

export interface IntentPreview {
  service: string | null
  fault: string | null
  requestedAction: string | null
  constraints: string[]
  urgency: 'normal' | 'high'
  chips: string[]
}

const KNOWN_SERVICES = [
  'checkout',
  'api',
  'search',
  'payments',
  'inventory',
] as const

const FAULT_KEYWORDS: Record<string, string[]> = {
  memory_pressure: ['memory', 'ram', 'oom', 'leak', 'heap'],
  latency_spike: ['latency', 'slow', 'spike', 'p99', 'lag', 'response time'],
  disk_saturation: ['disk', 'storage', 'volume', 'inode', 'partition'],
  connection_exhaustion: ['connection', 'pool', 'socket', 'exhaust'],
}

const CONSTRAINT_PATTERNS: Record<string, string[]> = {
  read_only: [
    'read only',
    'read-only',
    'readonly',
    'do not change',
    "don't change",
    'observe only',
    'observe-only',
  ],
  no_restart: ['do not restart', "don't restart", 'no restart', 'without restarting'],
  no_deploy: ['do not deploy', "don't deploy", 'no deploy', 'no deployment'],
}

const ACTION_PATTERNS: Record<string, string[]> = {
  restore_capacity: [
    'restore',
    'recover',
    'fix',
    'heal',
    'remediate',
    'bring back',
    'scale up',
    'scale',
  ],
  investigate_only: ['investigate', 'diagnose', 'look into', 'check', 'inspect', 'assess'],
}

const URGENCY_WORDS = ['asap', 'immediately', 'urgent', 'right now', 'now', 'p1', 'critical']

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchKeyword(
  normalized: string,
  table: Record<string, string[]>,
): string | null {
  for (const [key, words] of Object.entries(table)) {
    for (const word of words) {
      if (new RegExp(`(?<!\\w)${escapeRegExp(word)}(?!\\w)`).test(normalized)) {
        return key
      }
    }
  }
  return null
}

export function previewIntent(text: string): IntentPreview {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')

  let service: string | null = null
  let earliest = Number.POSITIVE_INFINITY
  for (const candidate of KNOWN_SERVICES) {
    const index = normalized.indexOf(candidate)
    if (index >= 0 && index < earliest) {
      earliest = index
      service = candidate
    }
  }

  const fault = matchKeyword(normalized, FAULT_KEYWORDS)
  const requestedAction = matchKeyword(normalized, ACTION_PATTERNS)
  const constraints = Object.keys(CONSTRAINT_PATTERNS).filter((name) =>
    CONSTRAINT_PATTERNS[name]!.some((pattern) => normalized.includes(pattern)),
  )
  const urgency = URGENCY_WORDS.some((word) => normalized.includes(word))
    ? 'high'
    : 'normal'

  const chips: string[] = []
  if (service) chips.push(`service:${service}`)
  if (fault) chips.push(`fault:${fault}`)
  if (requestedAction) chips.push(`action:${requestedAction}`)
  for (const constraint of constraints) chips.push(`constraint:${constraint}`)
  if (urgency === 'high') chips.push('urgency:high')

  return {
    service,
    fault,
    requestedAction,
    constraints,
    urgency,
    chips,
  }
}
