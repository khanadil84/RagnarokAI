import { Activity, ShieldAlert } from 'lucide-react'
import { AgentPanel } from '../components/AgentPanel'
import { AuditTimeline } from '../components/AuditTimeline'
import { EvidencePanel } from '../components/EvidencePanel'
import { ExecutionConsole } from '../components/ExecutionConsole'
import { Topology } from '../components/Topology'
import { Panel } from '../components/ui'
import { formatMs, relative } from '../lib/format'
import { useConsole } from '../store/console'

export function OverviewPage() {
  const {
    run,
    restoredFrom,
    stages,
    agentStates,
    selection,
    select,
    revealIndex,
    revealing,
    skipReveal,
    history,
    connection,
  } = useConsole()

  const verification = run
    ? run.verification.verified
      ? 'Verified'
      : run.recovery.type === 'recovery_blocked'
        ? 'Blocked'
        : 'Unverified'
    : '—'

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Incident command</h1>
          <p className="page-sub">
            Live view of the autonomous recovery lifecycle. Every state on this
            page is derived from the simulator&apos;s own response — there is no
            synthetic telemetry, uptime or cloud connection anywhere in this
            product.
          </p>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span className="stat-label">Backend</span>
          <span
            className="stat-value"
            style={{
              color:
                connection === 'online'
                  ? 'var(--emerald)'
                  : connection === 'offline'
                    ? 'var(--red)'
                    : 'var(--amber)',
            }}
          >
            {connection}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            GET /api/health
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Engine time</span>
          <span className="stat-value">{run ? formatMs(run.duration_ms) : '—'}</span>
          <span className="muted" style={{ fontSize: 11 }}>
            {run ? `started ${relative(run.started_at)}` : 'no run yet'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Verification</span>
          <span
            className="stat-value"
            style={{
              color:
                verification === 'Verified'
                  ? 'var(--emerald)'
                  : verification === '—'
                    ? 'var(--text-3)'
                    : 'var(--red)',
            }}
          >
            {verification}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            simulated service health
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Recorded runs</span>
          <span className="stat-value">{history.length}</span>
          <span className="muted" style={{ fontSize: 11 }}>
            backend in-memory history
          </span>
        </div>
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Incident topology</h2>
          <span className="panel-hint">
            voice → orchestration → fault → diagnosis → proposal → approval →
            execution → verification
          </span>
        </header>
        <div className="panel-body flush">
          <Topology
            stages={stages}
            agentStates={agentStates}
            selection={selection}
            onSelect={select}
            revealIndex={revealIndex}
            revealing={revealing}
            onSkip={skipReveal}
            run={run}
            restoredFrom={restoredFrom}
          />
        </div>
      </section>

      <div className="grid">
        <div className="col-5 stack">
          <AgentPanel />
        </div>
        <div className="col-7 stack">
          <ExecutionConsole />
        </div>
        <div className="col-7 stack">
          <EvidencePanel />
        </div>
        <div className="col-5 stack">
          <AuditTimeline compact />
        </div>
      </div>

      <Panel title="How to read this dashboard">
        <div className="stack" style={{ gap: 'var(--sp-3)' }}>
          <div className="note">
            <Activity size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Stages are derived from named fields of a single{' '}
            <code>POST /api/incidents/run</code> response. Each stage in the
            topology shows the exact source path it came from.
          </div>
          <div className="note warn">
            <ShieldAlert size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Voice-first, safety-bound autonomy: speak into the global{' '}
            <strong>Voice Command bar</strong> — hands-free is on by default, so a
            completed final recognition auto-dispatches the run (no Dispatch or Run
            clicks). The backend interprets your intent, plans, runs a bounded agent
            loop, and verifies outcomes with evidence; listening pauses while it
            executes and duplicate commands are refused. Voice text never grants{' '}
            <strong>policy approval</strong> — that stays with the explicit Incident
            Lab toggle — and the voice stage reports{' '}
            <code>not_integrated</code> only when no request text is attached.
          </div>
        </div>
      </Panel>
    </div>
  )
}
