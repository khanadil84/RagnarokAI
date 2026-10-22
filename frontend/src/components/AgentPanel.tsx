import { AGENTS } from '../lib/agents'
import { formatMs } from '../lib/format'
import { statusLabel } from '../lib/lifecycle'
import { useConsole } from '../store/console'
import { EmptyState, Panel, StatusPill } from './ui'

export function AgentPanel() {
  const { run, stages, agentStates, selection, select } = useConsole()

  return (
    <Panel
      title="Agent network"
      hint="State derived from the latest run response"
    >
      <div className="panel-body flush">
        {AGENTS.map((agent) => {
          const status = agentStates[agent.id]
          const lastEvent = run
            ? [...run.events].reverse().find((event) => event.agent === agent.name)
            : undefined
          const owned = stages.filter((stage) => stage.participant === agent.name)
          const duration = owned.reduce(
            (total, stage) => total + (stage.durationMs ?? 0),
            0,
          )
          const selected = selection?.kind === 'agent' && selection.id === agent.id
          return (
            <button
              key={agent.id}
              className={`agent-row${selected ? ' selected' : ''}`}
              onClick={() =>
                select(selected ? null : { kind: 'agent', id: agent.id })
              }
            >
              <span
                className="agent-glyph"
                style={{
                  color: agent.tone === 'neutral' ? undefined : `var(--${agent.tone})`,
                  borderColor: `color-mix(in srgb, ${agent.tone === 'neutral' ? '#6f829b' : `var(--${agent.tone})`} 35%, transparent)`,
                }}
              >
                <agent.icon size={15} strokeWidth={1.7} />
              </span>
              <span className="agent-meta">
                <span className="agent-name">{agent.name}</span>
                <span className="agent-role">{agent.role}</span>
                {lastEvent ? (
                  <span className="agent-event">
                    events[{lastEvent.seq}] · {lastEvent.type}
                  </span>
                ) : (
                  <span className="agent-event muted">
                    no events recorded yet
                  </span>
                )}
              </span>
              <span style={{ textAlign: 'right', display: 'grid', gap: 4, justifyItems: 'end' }}>
                <StatusPill status={status} />
                <span className="mono muted" style={{ fontSize: 10.5 }}>
                  {run ? `${formatMs(duration)} in stages` : statusLabel(status)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {!run ? (
        <EmptyState title="No agent has executed anything yet">
          Agent states stay <em>Idle</em> until a run response arrives. The
          dashboard never animates an agent as working without a corresponding
          backend record.
        </EmptyState>
      ) : null}
    </Panel>
  )
}
