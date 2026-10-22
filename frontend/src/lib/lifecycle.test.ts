import { describe, expect, it } from 'vitest'
import {
  STAGE_COUNT,
  STAGE_DEFS,
  deriveAgentStates,
  deriveLifecycle,
} from './lifecycle'
import type { RunResponse } from './types'

function blockedRun(): RunResponse {
  return {
    incident_id: 'inc-1',
    service: 'checkout',
    fault: 'memory_pressure',
    operator_request: '',
    simulation_only: true,
    started_at: '2026-10-20T10:00:00.000+00:00',
    duration_ms: 4.2,
    plan: ['simulate_fault', 'collect_evidence'],
    stages: [
      { name: 'operator_request', agent: null, status: 'not_integrated', duration_ms: 0.01 },
      { name: 'orchestration', agent: 'OrchestratorPrime', status: 'completed', duration_ms: 0.02 },
      { name: 'fault_simulation', agent: 'ChaosValkyrie', status: 'completed', duration_ms: 0.03 },
      { name: 'diagnosis', agent: 'AegisSentinel', status: 'completed', duration_ms: 0.04 },
      { name: 'recovery_proposal', agent: 'RagnarokPatcher', status: 'completed', duration_ms: 0.05 },
      { name: 'policy_approval', agent: null, status: 'denied', duration_ms: 0.06 },
      { name: 'simulated_execution', agent: 'NexusDeployer', status: 'blocked', duration_ms: 0.07 },
      { name: 'verification', agent: 'NexusDeployer', status: 'failed', duration_ms: 0.08 },
    ],
    policy: { action_allowed: true, operator_approved: false, approved: false },
    diagnosis: {
      agent: 'AegisSentinel',
      type: 'diagnosis',
      service: 'checkout',
      cause: 'memory_pressure',
      evidence: ['simulated health check failed'],
      simulation_only: true,
    },
    proposal: {
      agent: 'RagnarokPatcher',
      type: 'recovery_proposal',
      action: 'restore_simulated_service_capacity',
      based_on: 'memory_pressure',
      requires_policy_approval: true,
      simulation_only: true,
    },
    recovery: {
      agent: 'NexusDeployer',
      type: 'recovery_blocked',
      reason: 'Policy approval not granted',
      healthy: false,
      simulation_only: true,
    },
    verification: {
      agent: 'NexusDeployer',
      type: 'verification',
      healthy: false,
      verified: false,
      simulation_only: true,
    },
    events: [
      { seq: 1, agent: 'ChaosValkyrie', type: 'fault_injected', simulation_only: true },
      { seq: 2, agent: 'AegisSentinel', type: 'diagnosis', simulation_only: true },
      { seq: 3, agent: 'NexusDeployer', type: 'recovery_blocked', simulation_only: true },
      { seq: 4, agent: 'NexusDeployer', type: 'verification', simulation_only: true },
    ],
  }
}

function verifiedRun(): RunResponse {
  const run = blockedRun()
  run.operator_request = 'restore checkout'
  run.policy = { action_allowed: true, operator_approved: true, approved: true }
  run.stages = run.stages.map((stage) =>
    stage.name === 'operator_request'
      ? { ...stage, status: 'received' }
      : stage.name === 'policy_approval'
        ? { ...stage, status: 'approved' }
        : stage.name === 'simulated_execution'
          ? { ...stage, status: 'completed' }
          : stage.name === 'verification'
            ? { ...stage, status: 'verified' }
            : stage,
  )
  run.recovery = {
    agent: 'NexusDeployer',
    type: 'simulated_recovery',
    action: 'restore_simulated_service_capacity',
    healthy: true,
    simulation_only: true,
  }
  run.verification = {
    agent: 'NexusDeployer',
    type: 'verification',
    healthy: true,
    verified: true,
    simulation_only: true,
  }
  run.events[3] = { ...run.events[3]!, type: 'simulated_recovery' }
  run.events.push({ seq: 5, agent: 'NexusDeployer', type: 'verification', simulation_only: true })
  return run
}

describe('deriveLifecycle', () => {
  it('exposes eight stages in contract order before any run', () => {
    const stages = deriveLifecycle(null)
    expect(stages).toHaveLength(STAGE_COUNT)
    expect(stages.map((s) => s.id)).toEqual(STAGE_DEFS.map((s) => s.id))
    expect(stages.every((s) => s.status === 'idle')).toBe(true)
  })

  it('marks a blocked recovery as blocked at approval and failed at verification', () => {
    const stages = deriveLifecycle(blockedRun())
    const byId = Object.fromEntries(stages.map((s) => [s.id, s]))
    expect(byId.voice?.status).toBe('unavailable')
    expect(byId.approval?.status).toBe('blocked')
    expect(byId.execution?.status).toBe('blocked')
    expect(byId.verification?.status).toBe('failed')
    expect(byId.verification?.summary).toBe('Verification failed')
  })

  it('reports provenance for every derived stage', () => {
    const stages = deriveLifecycle(verifiedRun())
    expect(stages.every((s) => s.source.length > 0)).toBe(true)
    expect(stages.find((s) => s.id === 'proposal')?.source).toContain('.proposal')
    expect(stages.find((s) => s.id === 'fault')?.source).toContain('.events[1]')
  })

  it('marks the full happy path completed and flags the text fallback', () => {
    const stages = deriveLifecycle(verifiedRun())
    const byId = Object.fromEntries(stages.map((s) => [s.id, s]))
    expect(byId.voice?.status).toBe('completed')
    expect(byId.voice?.summary).toContain('Text request')
    expect(byId.verification?.status).toBe('completed')
    expect(byId.execution?.status).toBe('completed')
  })
})

describe('deriveAgentStates', () => {
  it('keeps every agent idle before any run', () => {
    const states = deriveAgentStates(null, 'online')
    expect(Object.values(states).every((s) => s === 'idle')).toBe(true)
  })

  it('reports agents unavailable while the backend is unreachable', () => {
    const states = deriveAgentStates(verifiedRun(), 'offline')
    expect(Object.values(states).every((s) => s === 'unavailable')).toBe(true)
  })

  it('derives blocked nexus when approval was denied', () => {
    const states = deriveAgentStates(blockedRun(), 'online')
    expect(states.nexus).toBe('blocked')
    expect(states.policy).toBe('blocked')
    expect(states.chaos).toBe('completed')
  })

  it('derives completed agents on a verified run', () => {
    const states = deriveAgentStates(verifiedRun(), 'online')
    expect(states.orchestrator).toBe('completed')
    expect(states.nexus).toBe('completed')
    expect(states.voice).toBe('completed')
    expect(states.policy).toBe('completed')
  })
})
