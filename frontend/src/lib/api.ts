import type {
  HealthResponse,
  LifecycleContract,
  ParsedIntent,
  RunResponse,
  RunSummary,
} from './types'

const API_STORAGE_KEY = 'ragnarok.apiBase'

export function getApiBase(): string {
  const stored = window.localStorage.getItem(API_STORAGE_KEY)
  return stored ? stored.replace(/\/$/, '') : ''
}

export function setApiBase(value: string): void {
  const cleaned = value.trim().replace(/\/$/, '')
  if (cleaned) window.localStorage.setItem(API_STORAGE_KEY, cleaned)
  else window.localStorage.removeItem(API_STORAGE_KEY)
}

export class ApiError extends Error {
  readonly kind: 'network' | 'http' | 'parse'

  constructor(kind: 'network' | 'http' | 'parse', message: string) {
    super(message)
    this.kind = kind
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError('network', `Cannot reach ${url}`)
  }
  if (!response.ok) {
    throw new ApiError('http', `${response.status} ${response.statusText} — ${path}`)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('parse', `Malformed JSON from ${path}`)
  }
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health', { signal })
}

export interface RunPayload {
  fault: string
  approve_recovery: boolean
  operator_request: string
  /** Deterministic loop-failure demo; defaults to "none" on the backend. */
  simulate_failure?: 'none' | 'once' | 'always'
}

export function runIncident(payload: RunPayload): Promise<RunResponse> {
  return request<RunResponse>('/api/incidents/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Additive endpoint: server-side intent parse. Never grants approval. */
export function parseIntent(text: string): Promise<ParsedIntent> {
  return request<ParsedIntent>('/api/intents/parse', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function fetchHistory(limit = 25): Promise<{ items: RunSummary[] }> {
  return request<{ items: RunSummary[] }>(`/api/incidents?limit=${limit}`)
}

export function fetchIncident(id: string): Promise<RunResponse> {
  return request<RunResponse>(`/api/incidents/${id}`)
}

export function fetchLifecycleContract(): Promise<LifecycleContract> {
  return request<LifecycleContract>('/api/lifecycle')
}

/** Fault labels the engine accepts. Behaviour is identical for every label. */
export const FAULT_OPTIONS = [
  { value: 'memory_pressure', label: 'memory_pressure — simulated memory pressure' },
  { value: 'latency_spike', label: 'latency_spike — simulated latency spike' },
  { value: 'disk_saturation', label: 'disk_saturation — simulated disk saturation' },
  { value: 'connection_exhaustion', label: 'connection_exhaustion — simulated pool exhaustion' },
]
