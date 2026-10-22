import { useEffect, useState } from 'react'
import { getApiBase, setApiBase } from '../lib/api'
import { Panel, StatusPill } from '../components/ui'
import { useConsole } from '../store/console'

interface LedgerItem {
  area: string
  status: 'resolved' | 'open'
  text: string
}

const LEDGER: LedgerItem[] = [
  {
    area: 'Voice input',
    status: 'resolved',
    text: 'Voice-first dispatch is live: the global Voice Command bar (browser SpeechRecognition; Chromium/Edge/Safari) plus Wispr Flow dictation into its plain text field feed operator_request. Hands-free mode is ON by default — a completed final recognition auto-dispatches the autonomous run with no clicks; listening pauses while a run executes; duplicate commands inside a 2s window are refused. Dispatch and Run Simulation remain as manual fallbacks. The API receives text only and reports voice_input=browser_client.',
  },
  {
    area: 'Voice approval',
    status: 'resolved',
    text: 'Voice or typed text can never grant policy approval. approve_recovery comes solely from the explicit Incident Lab toggle; the parser carries no approval field and a test enforces it.',
  },
  {
    area: 'Proposal audit gap',
    status: 'resolved',
    text: 'RagnarokPatcher.propose() is now appended to incident.events[] as type=recovery_proposal, alongside intent_parsed, plan_created, plan_revised, step_failed, policy_decision and run_aborted audit events.',
  },
  {
    area: 'Policy detail',
    status: 'resolved',
    text: 'The engine emits a policy_decision audit event (action, action_allowed, operator_approved, approved) in addition to the .policy booleans.',
  },
  {
    area: 'Live event stream',
    status: 'open',
    text: 'No SSE or WebSocket endpoint. The topology replays the stages of the synchronous run response, labelled as a replay.',
  },
  {
    area: 'Plan dispatch',
    status: 'resolved',
    text: 'OrchestratorPrime.create_plan() builds an intent-aware plan; the engine executes it through a bounded loop (max 3 iterations, 1 retry per step) that inspects results, revises the plan once, and aborts safely on repeated failure or budget exhaustion.',
  },
  {
    area: 'Speech privacy',
    status: 'open',
    text: 'Browser SpeechRecognition sends audio to the browser vendor\u2019s speech service. Wispr Flow dictation uses its own pipeline. The API itself never receives audio \u2014 only text.',
  },
  {
    area: 'Fault differentiation',
    status: 'open',
    text: 'The fault label is recorded in the diagnosis evidence, but the simulation path is identical for every label.',
  },
  {
    area: 'History durability',
    status: 'open',
    text: 'Run history is in-memory, capped at 50 runs, and resets when the backend process restarts.',
  },
  {
    area: 'Orchestrator wiring',
    status: 'resolved',
    text: 'OrchestratorPrime.create_plan() is now called by run_incident(); previously the plan text was hardcoded in the engine and the agent was dead code.',
  },
  {
    area: 'Stage measurements',
    status: 'resolved',
    text: 'The engine now records each lifecycle stage with perf_counter timings in .stages[] so the console reports measured values instead of estimates.',
  },
  {
    area: 'Run history API',
    status: 'resolved',
    text: 'GET /api/incidents and GET /api/incidents/{id} expose the recorded runs that back the audit trail and verification ledger.',
  },
]

export function SettingsPage() {
  const { health, healthError, connection, config, clearSession, refresh } =
    useConsole()
  const [apiBase, setApiBaseState] = useState(getApiBase())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 1600)
    return () => window.clearTimeout(timer)
  }, [saved])

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Connection, local session controls and the honest integration ledger for
            this build.
          </p>
        </div>
      </div>

      <div className="grid">
        <div className="col-6 stack">
          <Panel title="Backend connection">
            <div className="stack">
              <div className="field">
                <label htmlFor="api-base">API base URL</label>
                <input
                  id="api-base"
                  className="input"
                  placeholder="(empty = same origin via dev proxy)"
                  value={apiBase}
                  onChange={(event) => setApiBaseState(event.target.value)}
                />
                <span className="help">
                  Leave empty when running <code>npm run dev</code>; Vite proxies{' '}
                  <code>/api</code> to <code>http://127.0.0.1:8000</code>. Set an
                  absolute URL to point at another backend.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setApiBase(apiBase)
                    setSaved(true)
                    refresh()
                  }}
                >
                  Save & re-probe
                </button>
                <button className="btn btn-ghost" onClick={refresh}>
                  Probe now
                </button>
                {saved ? (
                  <span className="pill tone-emerald">
                    <span className="dot" />
                    Saved
                  </span>
                ) : null}
              </div>

              <dl className="kv">
                <dt>Status</dt>
                <dd>
                  <StatusPill
                    tone={
                      connection === 'online'
                        ? 'emerald'
                        : connection === 'offline'
                          ? 'red'
                          : 'amber'
                    }
                    label={connection}
                  />
                </dd>
                <dt>Health payload</dt>
                <dd style={{ fontSize: 11 }}>
                  {health ? JSON.stringify(health) : (healthError ?? 'unavailable')}
                </dd>
                <dt>Run config</dt>
                <dd style={{ fontSize: 11 }}>
                  fault={config.fault} approve={String(config.approve)}
                </dd>
              </dl>
            </div>
          </Panel>

          <Panel title="Local session">
            <div className="stack">
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                The most recent run response is cached in this browser so a refresh
                does not wipe the topology. Run configuration is persisted too.
                Nothing is sent anywhere except the configured backend.
              </p>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={clearSession}>
                  Clear cached run
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="col-6 stack">
          <Panel
            title="Integration ledger"
            hint="what is real, what is missing"
            flush
          >
            {LEDGER.map((item) => (
              <div className="ledger-row" key={item.area}>
                <span
                  className={`pill ${item.status === 'resolved' ? 'tag-resolved' : 'tag-open'}`}
                >
                  <span className="dot" />
                  {item.status === 'resolved' ? 'Resolved' : 'Open'}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--text-1)' }}>{item.area}</strong>
                  <br />
                  {item.text}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  )
}
