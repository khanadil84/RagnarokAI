import { AGENT_BY_NAME } from '../lib/agents'
import { eventSummary, formatMs } from '../lib/format'
import { useConsole } from '../store/console'
import { EmptyState, Panel } from './ui'

const STAGE_TONE: Record<string, string> = {
  completed: 'var(--emerald)',
  verified: 'var(--emerald)',
  approved: 'var(--emerald)',
  blocked: 'var(--amber)',
  denied: 'var(--amber)',
  failed: 'var(--red)',
  not_integrated: 'var(--text-3)',
  received: 'var(--cyan)',
}

export function ExecutionConsole() {
  const { run } = useConsole()

  return (
    <Panel
      title="Execution console"
      hint="Raw output of POST /api/incidents/run"
      flush={!run}
    >
      {!run ? (
        <EmptyState title="Console is empty">
          The console prints exactly what the simulator returned for the current
          run: per-stage measurements and the ordered event log. Nothing is
          synthesized locally.
        </EmptyState>
      ) : (
        <>
          <div style={{ padding: 'var(--sp-4) var(--sp-5) 0' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Pipeline stages · measured engine time
            </div>
            <div className="mono" style={{ fontSize: 11.5, display: 'grid', gap: 3 }}>
              {run.stages.map((stage, index) => (
                <div
                  key={stage.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '26px 150px 1fr 86px 92px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span className="muted">{String(index + 1).padStart(2, '0')}</span>
                  <span>{stage.name}</span>
                  <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stage.agent ?? 'gate logic'}
                  </span>
                  <span style={{ color: STAGE_TONE[stage.status] ?? 'var(--text-2)' }}>
                    {stage.status}
                  </span>
                  <span className="muted" style={{ textAlign: 'right' }}>
                    {formatMs(stage.duration_ms)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="console" role="log" aria-label="Event log">
            {run.events.map((event) => {
              const agent = AGENT_BY_NAME[event.agent]
              const tone =
                event.type === 'recovery_blocked'
                  ? 'var(--amber)'
                  : event.type === 'fault_injected'
                    ? 'var(--red)'
                    : event.type === 'verification'
                      ? event.verified
                        ? 'var(--emerald)'
                        : 'var(--red)'
                      : agent && agent.tone !== 'neutral'
                        ? `var(--${agent.tone})`
                        : 'var(--text-2)'
              return (
                <div className="console-line" key={event.seq}>
                  <span className="console-seq">{String(event.seq).padStart(3, '0')}</span>
                  <span className="console-agent" style={{ color: tone }}>
                    {event.agent.slice(0, 1)}
                  </span>
                  <span className="console-type">
                    <span style={{ color: tone }}>{event.type}</span>{' '}
                    <span className="k">·</span> <span className="k">{event.agent}</span>{' '}
                    <span className="k">·</span>{' '}
                    <span className="v">{eventSummary(event as Record<string, unknown>)}</span>
                  </span>
                </div>
              )
            })}
            <div className="console-line">
              <span className="console-seq">{String(run.events.length + 1).padStart(3, '0')}</span>
              <span className="console-agent" style={{ color: 'var(--cyan)' }}>
                ∑
              </span>
              <span className="console-type">
                <span style={{ color: 'var(--cyan)' }}>run_complete</span>{' '}
                <span className="k">·</span>{' '}
                <span className="v">
                  duration_ms={run.duration_ms} verification.verified=
                  {String(run.verification.verified)}
                </span>
              </span>
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}
