export interface HealthResponse {
  status: string
  project: string
  simulation_only: boolean
  voice_input?: string
  run_count?: number
}

export interface StageMeasurement {
  name: string
  agent: string | null
  status: string
  duration_ms: number
}

export interface PolicyVerdict {
  action_allowed: boolean
  operator_approved: boolean
  approved: boolean
}

export interface ParsedIntent {
  service: string
  fault_hint: string | null
  requested_action: string | null
  constraints: string[]
  urgency: string
  raw: string
  source?: string
  simulation_only?: boolean
}

export interface LoopStats {
  iterations: number
  max_iterations: number
  retries_used: number
  max_retries_per_step?: number
  revised: boolean
  aborted: boolean
  abort_reason: string | null
  attempts: { attempt: number; result: string; error?: string }[]
  budget_seconds?: number
}

export interface PlanStep {
  step: string
  owner: string
  purpose: string
  status: string
}

export interface VerificationCheck {
  name: string
  passed: boolean
  observed: unknown
}

export interface IncidentEvent {
  seq: number
  agent: string
  type: string
  simulation_only: boolean
  [key: string]: unknown
}

export interface Diagnosis {
  agent: string
  type: string
  service: string
  cause: string
  evidence: string[]
  simulation_only: boolean
}

export interface Proposal {
  agent: string
  type: string
  action: string
  based_on: string
  requires_policy_approval: boolean
  simulation_only: boolean
}

export interface Recovery {
  agent: string
  type: string
  reason?: string
  action?: string
  healthy: boolean
  simulation_only: boolean
}

export interface Verification {
  agent: string
  type: string
  healthy: boolean
  verified: boolean
  checks?: VerificationCheck[]
  simulation_only: boolean
}

export interface RunResponse {
  incident_id: string
  service: string
  fault: string
  operator_request: string
  simulation_only: boolean
  started_at: string
  duration_ms: number
  intent?: ParsedIntent
  plan: string[]
  plan_detail?: PlanStep[]
  loop?: LoopStats
  stages: StageMeasurement[]
  policy: PolicyVerdict
  diagnosis: Diagnosis
  proposal: Proposal
  recovery: Recovery
  verification: Verification
  events: IncidentEvent[]
}

export type RunOutcome = 'verified' | 'blocked' | 'unverified'

export interface RunSummary {
  incident_id: string
  started_at: string
  service: string
  fault: string
  operator_request: string
  duration_ms: number
  event_count: number
  outcome: RunOutcome
  approved: boolean | null
  verified: boolean | null
  simulation_only: boolean
}

export interface KnownGap {
  text: string
}

export interface LifecycleContract {
  simulation_only: boolean
  stages: {
    name: string
    agent: string | null
    source: string
  }[]
  known_gaps: string[]
}

export type Connection = 'checking' | 'online' | 'offline'
