import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ApiError, fetchIncident } from '../lib/api'
import { eventSummary, formatClock, formatMs, relative, shortId } from '../lib/format'
import { useConsole } from '../store/console'
import { EmptyState, Panel } from './ui'
import { AGENT_BY_NAME } from '../lib/agents'

const OUTCOME_COLOR: Record<string, string> = {
  verified: 'var(--emerald)',
  blocked: 'var(--amber)',
  unverified: 'var(--red)',
}

function eventTone(type: string, payload: Record<string, unknown>): string {
  if (type === 'fault_injected') return 'var(--red)'
  if (type === 'recovery_blocked') return 'var(--amber)'
  if (type === 'verification') return payload.verified ? 'var(--emerald)' : 'var(--red)'
  if (type === 'simulated_recovery') return 'var(--emerald)'
  const agent = AGENT_BY_NAME[String(payload.agent ?? '')]
  if (agent && agent.tone !== 'neutral') return `var(--${agent.tone})`
  return 'var(--text-3)'
}

export function AuditTimeline({ compact = false }: { compact?: boolean }) {
  const { history, historyError, run, openRun, clearSession } = useConsole()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = async (id: string) => {
    setLoadingId(id)
    setLoadError(null)
    try {
      const full = await fetchIncident(id)
      openRun(full)
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Unknown error')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Panel
      title="Audit trail"
      hint="Ordered by backend timestamp, newest first"
      flush={history.length > 0}
    >
      {history.length === 0 ? (
        <EmptyState title="No recorded runs">
          {historyError
            ? `Backend history unavailable: ${historyError}`
            : 'Every simulation is stored in the backend run history (in-memory, capped at 50 runs). The trail appears here after the first run.'}
        </EmptyState>
      ) : (
        <div className="timeline" style={compact ? { maxHeight: 300 } : undefined}>
          {history.map((item) => {
            const isCurrent = run?.incident_id === item.incident_id
            return (
              <div className="tl-run" key={item.incident_id}>
                <div className="tl-run-head">
                  <span
                    className="tl-node"
                    style={{ background: OUTCOME_COLOR[item.outcome] ?? 'var(--text-3)', marginLeft: 0 }}
                  />
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    {shortId(item.incident_id, 12)}
                  </span>
                  <span className="pill" style={{ color: OUTCOME_COLOR[item.outcome] }}>
                    <span className="dot" />
                    {item.outcome}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {formatClock(item.started_at)} · {relative(item.started_at)} ·{' '}
                    {item.service}/{item.fault} · {item.event_count} events ·{' '}
                    {formatMs(item.duration_ms)}
                  </span>
                  {!isCurrent ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => void load(item.incident_id)}
                      disabled={loadingId === item.incident_id}
                    >
                      {loadingId === item.incident_id ? (
                        <>
                          <Loader2 size={12} className="spinner" /> Loading
                        </>
                      ) : (
                        'Open in console'
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={clearSession}
                    >
                      Clear console
                    </button>
                  )}
                </div>

                {loadError && loadingId === null && isCurrent ? (
                  <div className="tl-sub">{loadError}</div>
                ) : null}

                {isCurrent && run ? (
                  <div style={{ marginTop: 6 }}>
                    {run.events.map((event) => (
                      <div className="tl-entry" key={event.seq}>
                        <span
                          className="tl-node"
                          style={{ background: eventTone(event.type, event) }}
                        />
                        <div>
                          <div className="tl-title">
                            <span className="mono" style={{ fontSize: 11 }}>
                              {String(event.seq).padStart(3, '0')}
                            </span>{' '}
                            {event.type.replace(/_/g, ' ')}
                          </div>
                          <div className="tl-sub">
                            {event.agent} · simulation_only={String(event.simulation_only)}
                          </div>
                          <div className="tl-detail mono" style={{ fontSize: 11 }}>
                            {eventSummary(event)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {run.proposal.type === 'recovery_proposal' ? (
                      <div className="tl-entry">
                        <span
                          className="tl-node"
                          style={{ background: 'var(--cyan)' }}
                        />
                        <div>
                          <div className="tl-title">recovery proposal</div>
                          <div className="tl-sub">
                            RagnarokPatcher · returned in .proposal, missing from .events[]
                          </div>
                          <div className="tl-detail mono" style={{ fontSize: 11 }}>
                            action={run.proposal.action} based_on={run.proposal.based_on}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
