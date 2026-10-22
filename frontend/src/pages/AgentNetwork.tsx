import { AGENTS, GATES, TONE_HEX } from '../lib/agents'
import { statusLabel, type AgentStatus } from '../lib/lifecycle'
import { STATUS_COLOR } from '../lib/lifecycle'
import { Panel, StatusPill } from '../components/ui'
import { useConsole } from '../store/console'

function AgentCard({
  agentId,
  status,
  description,
  module,
  owns,
  lastEvent,
}: {
  agentId: string
  status: AgentStatus
  description: string
  module: string
  owns: string
  lastEvent: string
}) {
  const def = [...AGENTS, ...GATES].find((agent) => agent.id === agentId)!
  return (
    <section className="panel">
      <header className="panel-head">
        <span
          className="agent-glyph"
          style={{
            width: 26,
            height: 26,
            color: def.gate ? 'var(--text-2)' : TONE_HEX[def.tone],
          }}
        >
          <def.icon size={14} strokeWidth={1.7} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="agent-name">{def.name}</div>
          <div className="agent-role">{def.role}</div>
        </div>
        <span className="panel-hint">
          <StatusPill status={status} />
        </span>
      </header>
      <div className="panel-body stack" style={{ gap: 'var(--sp-3)' }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {description}
        </p>
        <dl className="kv">
          <dt>Module</dt>
          <dd style={{ fontSize: 11 }}>{module}</dd>
          <dt>Owns</dt>
          <dd>{owns}</dd>
          <dt>State</dt>
          <dd style={{ color: STATUS_COLOR[status] }}>{statusLabel(status)}</dd>
          <dt>Latest</dt>
          <dd style={{ fontSize: 11 }}>{lastEvent}</dd>
        </dl>
      </div>
    </section>
  )
}

export function AgentNetworkPage() {
  const { agentStates, run, selection, select } = useConsole()

  const lastEventFor = (name: string) => {
    if (!run) return 'no events recorded'
    const event = [...run.events].reverse().find((item) => item.agent === name)
    return event ? `events[${event.seq}] · ${event.type}` : 'no events in this run'
  }

  const selected = selection?.kind === 'agent' ? selection.id : null

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Agent network</h1>
          <p className="page-sub">
            Five autonomous agents plus two lifecycle gates. States are computed
            from the most recent run response and the backend connectivity probe —
            an agent is never shown as working without a corresponding record.
          </p>
        </div>
      </div>

      <div className="grid">
        {AGENTS.map((agent) => (
          <div
            className="col-4"
            key={agent.id}
            onClick={() =>
              select(
                selected === agent.id ? null : { kind: 'agent', id: agent.id },
              )
            }
            style={{ cursor: 'pointer' }}
          >
            <AgentCard
              agentId={agent.id}
              status={agentStates[agent.id]}
              description={agent.description}
              module={agent.module}
              owns={agent.stages.join(', ')}
              lastEvent={lastEventFor(agent.name)}
            />
          </div>
        ))}
        {GATES.map((gate) => (
          <div
            className="col-4"
            key={gate.id}
            onClick={() =>
              select(selected === gate.id ? null : { kind: 'agent', id: gate.id })
            }
            style={{ cursor: 'pointer' }}
          >
            <AgentCard
              agentId={gate.id}
              status={agentStates[gate.id]}
              description={gate.description}
              module={gate.module}
              owns={gate.stages.join(', ')}
              lastEvent={lastEventFor(gate.name)}
            />
          </div>
        ))}
      </div>

      <Panel title="Orchestration plan">
        {run && run.plan.length > 0 ? (
          <ol className="mono" style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12.5, lineHeight: 2 }}>
            {run.plan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            No plan has been produced yet. OrchestratorPrime emits the plan as{' '}
            <code>.plan</code> on every run; it is advisory metadata and the engine
            does not dispatch work from it.
          </p>
        )}
      </Panel>
    </div>
  )
}
