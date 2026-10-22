import { useState } from 'react'
import { AuditTimeline } from '../components/AuditTimeline'
import { Panel } from '../components/ui'
import { AGENTS } from '../lib/agents'
import { useConsole } from '../store/console'

export function AuditTrailPage() {
  const { run, history } = useConsole()
  const [agentFilter, setAgentFilter] = useState<string>('all')

  const filteredEvents = run
    ? agentFilter === 'all'
      ? run.events
      : run.events.filter((event) => event.agent === agentFilter)
    : []

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit trail</h1>
          <p className="page-sub">
            Chronological record of every simulated incident the backend has
            executed in this process. Entries carry the backend timestamp and the
            sequence number assigned by the engine — nothing is added client-side
            except the noted proposal gap.
          </p>
        </div>
      </div>

      <AuditTimeline />

      <Panel
        title="Event ledger · current run"
        hint={
          run
            ? `${filteredEvents.length} of ${run.events.length} events shown`
            : 'no run loaded'
        }
        actions={
          <select
            className="select"
            style={{ width: 'auto', padding: '5px 8px', fontSize: 11.5 }}
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            aria-label="Filter events by agent"
          >
            <option value="all">All agents</option>
            {AGENTS.map((agent) => (
              <option key={agent.id} value={agent.name}>
                {agent.name}
              </option>
            ))}
          </select>
        }
        flush={filteredEvents.length > 0}
      >
        {!run ? (
          <p style={{ padding: 'var(--sp-5)', fontSize: 12.5, color: 'var(--text-3)' }}>
            Open a run from the trail above, or dispatch a new simulation, to
            inspect its event ledger.
          </p>
        ) : filteredEvents.length === 0 ? (
          <p style={{ padding: 'var(--sp-5)', fontSize: 12.5, color: 'var(--text-3)' }}>
            {agentFilter} emitted no events in this run.
          </p>
        ) : (
          <div className="panel-body flush">
            <div
              className="ledger-row eyebrow"
              style={{ color: 'var(--text-3)', background: 'var(--surface-1)' }}
            >
              <span>Seq</span>
              <span>Agent · type · payload</span>
            </div>
            {filteredEvents.map((event) => (
              <div className="ledger-row" key={event.seq}>
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {String(event.seq).padStart(3, '0')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <span className="mono" style={{ color: 'var(--text-1)' }}>
                    {event.agent}
                  </span>{' '}
                  · {event.type} ·{' '}
                  <span className="mono">
                    {Object.entries(event)
                      .filter(([key]) => !['seq', 'agent', 'type'].includes(key))
                      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                      .join(' ')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="History scope">
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {history.length} run{history.length === 1 ? '' : 's'} currently retained in
          backend memory (cap 50, cleared on restart). This build has no database and
          makes no claim of durable audit storage — see Settings → Integration
          ledger.
        </p>
      </Panel>
    </div>
  )
}
