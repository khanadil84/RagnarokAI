import {
  FileCog,
  Gavel,
  Mic,
  Network,
  Rocket,
  ScanSearch,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { AgentId, AgentStatus, StageId } from './lifecycle'

export type { AgentId }

export interface AgentDef {
  id: AgentId
  name: string
  /** Short responsibility shown on cards and in the topology. */
  role: string
  /** Longer honest description of what the module actually does. */
  description: string
  /** Backend module this identity maps to, or the subsystem for gates. */
  module: string
  stages: StageId[]
  tone: 'cyan' | 'ice' | 'violet' | 'emerald' | 'amber' | 'red' | 'neutral'
  icon: LucideIcon
  /** True for non-agent lifecycle participants (voice gate, policy gate). */
  gate?: boolean
}

export const AGENTS: AgentDef[] = [
  {
    id: 'orchestrator',
    name: 'OrchestratorPrime',
    role: 'Planning & coordination',
    description:
      'Interprets operator intent (service, fault hints, constraints) and builds the intent-aware recovery plan. Runs a bounded loop — inspect, revise once, retry once, abort safely — and records every decision in the audit trail.',
    module: 'backend/agents/orchestrator.py',
    stages: ['orchestration'],
    tone: 'violet',
    icon: Network,
  },
  {
    id: 'chaos',
    name: 'ChaosValkyrie',
    role: 'Controlled fault injection',
    description:
      'Flips the simulated service into an unhealthy state by injecting the requested fault. Never touches a real service.',
    module: 'backend/agents/chaos_valkyrie.py',
    stages: ['fault'],
    tone: 'red',
    icon: Zap,
  },
  {
    id: 'aegis',
    name: 'AegisSentinel',
    role: 'Evidence & diagnosis',
    description:
      'Reads the simulated failure state and emits a diagnosis record with the cause and collected evidence lines.',
    module: 'backend/agents/aegis_sentinel.py',
    stages: ['diagnosis'],
    tone: 'ice',
    icon: ScanSearch,
  },
  {
    id: 'patcher',
    name: 'RagnarokPatcher',
    role: 'Recovery proposals',
    description:
      'Turns the diagnosis into a recovery proposal, honoring operator constraints (read-only narrows it to observation). The proposal is recorded in the audit trail and still requires the independent policy gate.',
    module: 'backend/agents/ragnarok_patcher.py',
    stages: ['proposal'],
    tone: 'cyan',
    icon: FileCog,
  },
  {
    id: 'nexus',
    name: 'NexusDeployer',
    role: 'Execution & verification',
    description:
      'Executes the approved recovery inside the simulation (with bounded retry on deterministic simulated failures) and verifies outcomes against evidence checks. Never claims success unless every check passes.',
    module: 'backend/agents/nexus_deployer.py',
    stages: ['execution', 'verification'],
    tone: 'emerald',
    icon: Rocket,
  },
]

export const GATES: AgentDef[] = [
  {
    id: 'voice',
    name: 'Voice Request',
    role: 'Operator intent',
    description:
      'Voice-first entry point: requests arrive via the global Voice Command bar (browser SpeechRecognition), Wispr Flow or typing. Hands-free by default — a completed final recognition auto-dispatches the autonomous run; listening pauses while it executes; duplicates are refused. Recognition runs client-side; the API receives text only. Voice text never grants policy approval.',
    module: 'backend/main.py · IncidentRequest.operator_request',
    stages: ['voice'],
    tone: 'neutral',
    icon: Mic,
    gate: true,
  },
  {
    id: 'policy',
    name: 'Policy Gate',
    role: 'core.policy + operator',
    description:
      'Recovery proceeds only when core.policy allows the action and the operator has granted approval via the explicit Incident Lab toggle. Voice or typed text can never grant approval.',
    module: 'backend/core/policy.py',
    stages: ['approval'],
    tone: 'neutral',
    icon: Gavel,
    gate: true,
  },
]

export const ALL_PARTICIPANTS: AgentDef[] = [...AGENTS, ...GATES]

export const AGENT_BY_NAME: Record<string, AgentDef> = Object.fromEntries(
  ALL_PARTICIPANTS.map((agent) => [agent.name, agent]),
)

export const AGENT_BY_ID: Record<AgentId, AgentDef> = Object.fromEntries(
  ALL_PARTICIPANTS.map((agent) => [agent.id, agent]),
) as Record<AgentId, AgentDef>

export interface AgentActivity {
  status: AgentStatus
  summary: string
  lastEvent: string | null
  durationMs: number | null
}

export const TONE_HEX: Record<AgentDef['tone'], string> = {
  cyan: '#3ad4ef',
  ice: '#8fc7f4',
  violet: '#a78bfa',
  emerald: '#34d39a',
  amber: '#f0b445',
  red: '#f16f7f',
  neutral: '#6f829b',
}
