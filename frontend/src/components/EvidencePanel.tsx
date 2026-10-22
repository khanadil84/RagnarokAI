import { AlertTriangle, BadgeCheck, ShieldQuestion } from 'lucide-react'
import { formatMs, shortId } from '../lib/format'
import { useConsole } from '../store/console'
import { EmptyState, Panel } from './ui'

export function EvidencePanel() {
  const { run } = useConsole()

  if (!run) {
    return (
      <Panel title="Recovery evidence">
        <EmptyState title="No evidence collected">
          Diagnosis, proposal, policy decision, execution result and verification
          all come from a single run response. Execute a simulation to populate
          this panel.
        </EmptyState>
      </Panel>
    )
  }

  const verified = run.verification.verified
  const blocked = run.recovery.type === 'recovery_blocked'

  return (
    <Panel
      title="Recovery evidence"
      hint={`Incident ${shortId(run.incident_id, 12)} · simulation only`}
    >
      <div className="stack">
        <div className={`verdict ${verified ? 'verified' : 'failed'}`}>
          {verified ? (
            <BadgeCheck size={22} color="var(--emerald)" />
          ) : (
            <AlertTriangle size={22} color="var(--red)" />
          )}
          <div>
            <div className="verdict-title">
              {verified
                ? 'Recovery verified in simulation'
                : blocked
                  ? 'Recovery blocked — verification failed'
                  : 'Recovery unverified'}
            </div>
            <div className="verdict-sub">
              healthy={String(run.verification.healthy)} · verified=
              {String(run.verification.verified)} · action_allowed=
              {String(run.policy.action_allowed)} · operator_approved=
              {String(run.policy.operator_approved)}
            </div>
          </div>
        </div>

        <div className="evidence-grid">
          <section className="stack" style={{ gap: 'var(--sp-3)' }}>
            <div className="eyebrow">Diagnosis · AegisSentinel</div>
            <dl className="kv">
              <dt>Service</dt>
              <dd>{run.diagnosis.service}</dd>
              <dt>Cause</dt>
              <dd>{run.diagnosis.cause}</dd>
              <dt>Evidence</dt>
              <dd style={{ display: 'grid', gap: 2 }}>
                {run.diagnosis.evidence.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </dd>
            </dl>
          </section>

          <section className="stack" style={{ gap: 'var(--sp-3)' }}>
            <div className="eyebrow">Proposal · RagnarokPatcher</div>
            <dl className="kv">
              <dt>Action</dt>
              <dd>{run.proposal.action}</dd>
              <dt>Based on</dt>
              <dd>{run.proposal.based_on}</dd>
              <dt>Approval</dt>
              <dd>
                {run.proposal.requires_policy_approval ? 'required' : 'not required'}
              </dd>
            </dl>
            <div className="note">
              The proposal object is returned in <code>.proposal</code> but is not
              appended to <code>.events[]</code>, so it is absent from the audit log.
            </div>
          </section>

          <section className="stack" style={{ gap: 'var(--sp-3)' }}>
            <div className="eyebrow">Policy decision</div>
            <dl className="kv">
              <dt>Action allowed</dt>
              <dd>{String(run.policy.action_allowed)}</dd>
              <dt>Operator approved</dt>
              <dd>{String(run.policy.operator_approved)}</dd>
              <dt>Outcome</dt>
              <dd style={{ color: run.policy.approved ? 'var(--emerald)' : 'var(--amber)' }}>
                {run.policy.approved ? 'approved' : 'denied'}
              </dd>
            </dl>
          </section>

          <section className="stack" style={{ gap: 'var(--sp-3)' }}>
            <div className="eyebrow">Execution & verification · NexusDeployer</div>
            <dl className="kv">
              <dt>Result</dt>
              <dd>{run.recovery.type}</dd>
              <dt>Reason</dt>
              <dd>{run.recovery.reason ?? '—'}</dd>
              <dt>Healthy</dt>
              <dd>{String(run.recovery.healthy)}</dd>
              <dt>Engine time</dt>
              <dd>{formatMs(run.duration_ms)}</dd>
            </dl>
          </section>
        </div>

        <div className="note warn">
          <ShieldQuestion
            size={13}
            style={{ verticalAlign: '-2px', marginRight: 6 }}
          />
          Verification reports simulator state only. This build has no cloud
          credentials and performs no real deployments, rollbacks or restarts.
        </div>
      </div>
    </Panel>
  )
}
