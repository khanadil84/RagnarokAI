import { EvidencePanel } from '../components/EvidencePanel'
import { AuditTimeline } from '../components/AuditTimeline'
import { Panel } from '../components/ui'
import { fetchIncident } from '../lib/api'
import { formatMs, formatStamp, shortId } from '../lib/format'
import { useConsole } from '../store/console'

export function RecoveryEvidencePage() {
  const { history, run, openRun } = useConsole()

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Recovery evidence</h1>
          <p className="page-sub">
            Everything the simulator produced for the current incident: diagnosis
            evidence, recovery proposal, policy decision, execution result and the
            verification verdict — plus the outcome ledger of every recorded run.
          </p>
        </div>
      </div>

      <EvidencePanel />

      <Panel
        title="Verification ledger"
        hint="Outcomes computed by the backend, not by the UI"
        flush={history.length > 0}
      >
        {history.length === 0 ? (
          <p style={{ padding: 'var(--sp-5)', fontSize: 12.5, color: 'var(--text-3)' }}>
            No recorded runs yet. Each run appends one ledger row.
          </p>
        ) : (
          <div className="panel-body flush">
            <div
              className="ledger-row eyebrow"
              style={{ color: 'var(--text-3)', background: 'var(--surface-1)' }}
            >
              <span>Outcome</span>
              <span>Incident · started · engine time · approval · verification</span>
            </div>
            {history.map((item) => (
              <button
                key={item.incident_id}
                className="ledger-row"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => {
                  if (run?.incident_id === item.incident_id) return
                  void load(item.incident_id)
                }}
              >
                <span
                  className="pill"
                  style={{
                    color:
                      item.outcome === 'verified'
                        ? 'var(--emerald)'
                        : item.outcome === 'blocked'
                          ? 'var(--amber)'
                          : 'var(--red)',
                  }}
                >
                  <span className="dot" />
                  {item.outcome}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <span className="mono">{shortId(item.incident_id, 12)}</span> ·{' '}
                  {formatStamp(item.started_at)} · {formatMs(item.duration_ms)} ·{' '}
                  approved={String(item.approved)} · verified={String(item.verified)} ·{' '}
                  {item.service}/{item.fault}
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <AuditTimeline />
    </div>
  )

  async function load(id: string) {
    try {
      openRun(await fetchIncident(id))
    } catch {
      /* surfaced by the audit panel */
    }
  }
}
