import type { Connection, RunResponse, StageMeasurement } from './types'

export type StageStatus =
  | 'idle'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'unavailable'

export type AgentStatus = StageStatus

export type StageId =
  | 'voice'
  | 'orchestration'
  | 'fault'
  | 'diagnosis'
  | 'proposal'
  | 'approval'
  | 'execution'
  | 'verification'

export interface LifecycleStage {
  id: StageId
  code: string
  index: number
  title: string
  railLabel: string[]
  /** Backend participant name, or null when the stage is not agent-owned. */
  participant: string | null
  status: StageStatus
  /** One-line status text shown on the rail and in the detail panel. */
  summary: string
  /** Honest description of what the backend actually reported. */
  detail: string
  /** Provenance: where in the run response this conclusion comes from. */
  source: string
  durationMs: number | null
}

interface StageDef {
  id: StageId
  code: string
  title: string
  railLabel: string[]
  participant: string | null
}

export const STAGE_DEFS: StageDef[] = [
  {
    id: 'voice',
    code: 'operator_request',
    title: 'Voice Request',
    railLabel: ['Voice', 'Request'],
    participant: 'Voice Request',
  },
  {
    id: 'orchestration',
    code: 'orchestration',
    title: 'Orchestration',
    railLabel: ['Orchestration'],
    participant: 'OrchestratorPrime',
  },
  {
    id: 'fault',
    code: 'fault_simulation',
    title: 'Fault Simulation',
    railLabel: ['Fault', 'Simulation'],
    participant: 'ChaosValkyrie',
  },
  {
    id: 'diagnosis',
    code: 'diagnosis',
    title: 'Diagnosis',
    railLabel: ['Diagnosis'],
    participant: 'AegisSentinel',
  },
  {
    id: 'proposal',
    code: 'recovery_proposal',
    title: 'Recovery Proposal',
    railLabel: ['Recovery', 'Proposal'],
    participant: 'RagnarokPatcher',
  },
  {
    id: 'approval',
    code: 'policy_approval',
    title: 'Policy Approval',
    railLabel: ['Policy', 'Approval'],
    participant: 'Policy Gate',
  },
  {
    id: 'execution',
    code: 'simulated_execution',
    title: 'Simulated Execution',
    railLabel: ['Simulated', 'Execution'],
    participant: 'NexusDeployer',
  },
  {
    id: 'verification',
    code: 'verification',
    title: 'Verification',
    railLabel: ['Verification'],
    participant: 'NexusDeployer',
  },
]

export const STAGE_COUNT = STAGE_DEFS.length

const IDLE_DETAIL =
  'No simulation has been executed in this session, so the backend has reported nothing for this stage.'

function measurement(
  run: RunResponse,
  code: string,
): StageMeasurement | undefined {
  return run.stages.find((stage) => stage.name === code)
}

type Deriver = (run: RunResponse, m?: StageMeasurement) => Omit<
  LifecycleStage,
  'id' | 'code' | 'index' | 'title' | 'railLabel' | 'participant' | 'durationMs'
>

const DERIVERS: Record<StageId, Deriver> = {
  voice: (run, m) => {
    if (m?.status === 'received') {
      return {
        status: 'completed',
        summary: 'Text request recorded',
        detail:
          `Request "${run.operator_request}" was attached to the run payload ` +
          'via the Voice Command bar or the Incident Lab field. It may have been typed, ' +
          'dictated with a system tool (e.g. Wispr Flow), or spoken through the browser ' +
          'SpeechRecognition API. Recognition runs client-side; the backend receives text ' +
          'only, and voice text never grants policy approval.',
        source: '.operator_request',
      }
    }
    return {
      status: 'unavailable',
      summary: 'Voice not integrated',
      detail:
        'The engine reports this stage as not_integrated because no request text was ' +
        'attached. Browser microphone capture exists in the Voice Command bar and the ' +
        'Incident Lab where SpeechRecognition is supported, but the API itself has no voice endpoint.',
      source: '.stages[name=operator_request]',
    }
  },

  orchestration: (run, m) => {
    if (m?.status === 'completed' && run.plan.length > 0) {
      const loop = run.loop
      const loopNote = loop
        ? ` Bounded loop: ${loop.iterations} iteration(s), ${loop.retries_used} retr${loop.retries_used === 1 ? 'y' : 'ies'}, revised=${String(loop.revised)}, aborted=${String(loop.aborted)}.`
        : ''
      const intentNote = run.intent
        ? ` Intent: service=${run.intent.service}, fault_hint=${run.intent.fault_hint ?? 'none'}, constraints=[${run.intent.constraints.join(', ') || 'none'}].`
        : ''
      return {
        status: 'completed',
        summary: `${run.plan.length} steps planned`,
        detail:
          `OrchestratorPrime produced the intent-aware plan: ${run.plan.join(' → ')}.` +
          intentNote + loopNote,
        source: '.plan ← OrchestratorPrime.create_plan()',
      }
    }
    return {
      status: 'unavailable',
      summary: 'No plan reported',
      detail: 'The run response did not contain an orchestration plan.',
      source: '.stages[name=orchestration]',
    }
  },

  fault: (run) => {
    const event = run.events.find((e) => e.type === 'fault_injected')
    if (event) {
      return {
        status: 'completed',
        summary: `${run.fault} → ${run.service}`,
        detail:
          `ChaosValkyrie injected the simulated fault "${run.fault}" against service ` +
          `"${run.service}" and set the in-memory health flag to false. No real service was contacted.`,
        source: `.events[${event.seq}] · fault_injected`,
      }
    }
    return {
      status: 'unavailable',
      summary: 'No injection event',
      detail: 'The event log contains no fault_injected record for this run.',
      source: '.events[]',
    }
  },

  diagnosis: (run) => {
    const evidence = run.diagnosis.evidence.map((line) => `“${line}”`).join(', ')
    return {
      status: 'completed',
      summary: `Cause: ${run.diagnosis.cause}`,
      detail:
        `AegisSentinel diagnosed service "${run.diagnosis.service}" with cause "${run.diagnosis.cause}". ` +
        `Evidence recorded: ${evidence || 'none'}.`,
      source: `.events[${run.events.find((e) => e.type === 'diagnosis')?.seq ?? '—'}] · diagnosis`,
    }
  },

  proposal: (run) => {
    if (run.proposal.type !== 'recovery_proposal') {
      return {
        status: 'unavailable',
        summary: 'No proposal reported',
        detail: 'The run response did not include a recovery proposal.',
        source: '.proposal',
      }
    }
    const constraints =
      'operator_constraints' in run.proposal &&
      Array.isArray(run.proposal.operator_constraints) &&
      run.proposal.operator_constraints.length > 0
        ? ` Operator constraints honored: ${(run.proposal.operator_constraints as string[]).join(', ')}.`
        : ''
    return {
      status: 'completed',
      summary: run.proposal.action,
      detail:
        `RagnarokPatcher proposed "${run.proposal.action}", based on "${run.proposal.based_on}".` +
        `${constraints} Recorded in the audit trail; still requires the independent policy gate.`,
      source: '.proposal · .events[type=recovery_proposal]',
    }
  },

  approval: (run) => {
    const allowed = run.policy.action_allowed
    const operator = run.policy.operator_approved
    if (run.policy.approved) {
      return {
        status: 'completed',
        summary: 'Approved',
        detail:
          `core.policy allowed the action (${allowed}) and the operator approved this run (${operator}). ` +
          `Action cleared for simulated execution: "${run.proposal.action}".`,
        source: '.policy · .recovery.type=simulated_recovery',
      }
    }
    return {
      status: 'blocked',
      summary: 'Blocked',
      detail:
        `${run.recovery.reason ?? 'Recovery blocked.'} ` +
        `core.policy action_allowed=${allowed}, operator_approved=${operator}. ` +
        'The pipeline stopped here by design.',
      source: '.policy · .recovery.type=recovery_blocked',
    }
  },

  execution: (run) => {
    if (run.recovery.type === 'simulated_recovery') {
      return {
        status: 'completed',
        summary: 'Capacity restored (simulated)',
        detail:
          `NexusDeployer executed "${run.recovery.action}" against the simulation. ` +
          `In-memory health flag is now ${run.recovery.healthy}. No real infrastructure was changed.`,
        source: '.recovery · simulated_recovery',
      }
    }
    if (run.recovery.type === 'recovery_blocked') {
      return {
        status: 'blocked',
        summary: 'Execution blocked',
        detail:
          `${run.recovery.reason ?? 'Policy approval not granted.'} ` +
          `Simulated service health remains ${run.recovery.healthy}.`,
        source: '.recovery · recovery_blocked',
      }
    }
    if (run.recovery.type === 'recovery_aborted') {
      const attempts = run.loop?.attempts.length ?? '—'
      return {
        status: 'failed',
        summary: 'Execution aborted',
        detail:
          `The bounded agent loop aborted safely (${run.recovery.reason ?? 'unknown reason'}) ` +
          `after ${attempts} attempt(s). Simulated health remains ${run.recovery.healthy}. ` +
          'No success is claimed.',
        source: '.recovery · recovery_aborted · .loop',
      }
    }
    return {
      status: 'unavailable',
      summary: 'No execution reported',
      detail: 'The run response did not include an execution result.',
      source: '.recovery',
    }
  },

  verification: (run) => {
    if (run.verification.verified) {
      const checks = run.verification.checks
      const checkNote = checks
        ? ` All ${checks.length} evidence checks passed (${checks.map((c) => c.name).join(', ')}).`
        : ''
      return {
        status: 'completed',
        summary: 'Verified healthy',
        detail:
          'NexusDeployer verified outcomes against collected evidence:' +
          `${checkNote} healthy=true, verified=true. This verifies the simulator state only, not a live deployment.`,
        source: '.verification · verified=true',
      }
    }
    return {
      status: 'failed',
      summary: 'Verification failed',
      detail:
        `Post-run verification reports healthy=${run.verification.healthy}, ` +
        'verified=false — the simulated service is not confirmed healthy, so no success is claimed.',
      source: '.verification · verified=false',
    }
  },
}

/** Derive the eight lifecycle stages from an actual run response. */
export function deriveLifecycle(run: RunResponse | null): LifecycleStage[] {
  return STAGE_DEFS.map((def, index) => {
    const base = {
      id: def.id,
      code: def.code,
      index,
      title: def.title,
      railLabel: def.railLabel,
      participant: def.participant,
      durationMs: null as number | null,
    }
    if (!run) {
      return {
        ...base,
        status: 'idle' as StageStatus,
        summary: 'Awaiting run',
        detail: IDLE_DETAIL,
        source: '—',
      }
    }
    const m = measurement(run, def.code)
    const derived = DERIVERS[def.id](run, m)
    return {
      ...base,
      ...derived,
      durationMs: m ? m.duration_ms : null,
    }
  })
}

export type AgentId =
  | 'orchestrator'
  | 'chaos'
  | 'aegis'
  | 'patcher'
  | 'nexus'
  | 'voice'
  | 'policy'

export type AgentActivityMap = Record<AgentId, StageStatus>

/** Derive honest per-agent states. Nothing is marked working without data. */
export function deriveAgentStates(
  run: RunResponse | null,
  connection: Connection,
): AgentActivityMap {
  const idle = (): AgentActivityMap => ({
    orchestrator: 'idle',
    chaos: 'idle',
    aegis: 'idle',
    patcher: 'idle',
    nexus: 'idle',
    voice: 'idle',
    policy: 'idle',
  })

  if (connection === 'offline') {
    return {
      orchestrator: 'unavailable',
      chaos: 'unavailable',
      aegis: 'unavailable',
      patcher: 'unavailable',
      nexus: 'unavailable',
      voice: 'unavailable',
      policy: 'unavailable',
    }
  }

  if (!run) return idle()

  const faultEvent = run.events.find((e) => e.type === 'fault_injected')
  const diagnosisEvent = run.events.find((e) => e.type === 'diagnosis')

  const nexus: StageStatus =
    run.recovery.type === 'recovery_blocked'
      ? 'blocked'
      : run.verification.verified
        ? 'completed'
        : 'failed'

  return {
    orchestrator: run.plan.length > 0 ? 'completed' : 'unavailable',
    chaos: faultEvent ? 'completed' : 'unavailable',
    aegis: diagnosisEvent ? 'completed' : 'unavailable',
    patcher: run.proposal.type === 'recovery_proposal' ? 'completed' : 'unavailable',
    nexus,
    voice:
      run.operator_request.trim().length > 0 ? 'completed' : 'unavailable',
    policy: run.policy.approved ? 'completed' : 'blocked',
  }
}

export function statusLabel(status: StageStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'completed':
      return 'Completed'
    case 'blocked':
      return 'Blocked'
    case 'failed':
      return 'Failed'
    case 'unavailable':
      return 'Unavailable'
  }
}

export const STATUS_COLOR: Record<StageStatus, string> = {
  idle: '#6f829b',
  completed: '#34d39a',
  blocked: '#f0b445',
  failed: '#f16f7f',
  unavailable: '#56657c',
}
