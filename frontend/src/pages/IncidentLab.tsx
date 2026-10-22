import { useCallback, useState } from 'react'
import { Loader2, Mic, MicOff, Play, Square } from 'lucide-react'
import { ApiError, FAULT_OPTIONS, fetchIncident } from '../lib/api'
import { formatMs, formatStamp, shortId } from '../lib/format'
import { previewIntent } from '../lib/intent'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'
import { useConsole, type RunConfig } from '../store/console'
import { EmptyState, Panel } from '../components/ui'

export function IncidentLabPage() {
  const {
    config,
    updateConfig,
    startRun,
    running,
    runError,
    connection,
    run,
    history,
    openRun,
  } = useConsole()
  const [loadError, setLoadError] = useState<string | null>(null)

  const onDictated = useCallback(
    (text: string) => updateConfig({ operatorRequest: text }),
    [updateConfig],
  )
  const {
    supported: dictationSupported,
    listening: dictating,
    error: dictationError,
    start: startDictation,
    stop: stopDictation,
  } = useSpeechRecognition(onDictated)

  const toggleDictation = () => {
    if (dictating) {
      stopDictation()
      return
    }
    // Snapshot of the field contents at recording start; the hook commits
    // (base + transcript).slice(0, 500) back through updateConfig only.
    startDictation(config.operatorRequest)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Incident lab</h1>
          <p className="page-sub">
            Configure a fault, grant or withhold policy approval, then dispatch a
            fully simulated incident against the in-memory engine. The same payload
            is what the topology replays.
          </p>
        </div>
      </div>

      <div className="grid">
        <div className="col-5 stack">
          <Panel title="Run configuration">
            <div className="stack">
              <div className="field">
                <label htmlFor="fault">Simulated fault</label>
                <select
                  id="fault"
                  className="select"
                  value={config.fault}
                  onChange={(event) => updateConfig({ fault: event.target.value })}
                >
                  {FAULT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="help">
                  The engine records the fault label in the diagnosis evidence but
                  does not differentiate simulation behaviour per label yet.
                </span>
              </div>

              <div className="field">
                <label htmlFor="request">Operator request</label>
                <div className="textarea-wrap">
                  <textarea
                    id="request"
                    className={`textarea${dictationSupported ? ' with-mic' : ''}`}
                    maxLength={500}
                    placeholder="e.g. restore checkout capacity"
                    value={config.operatorRequest}
                    onChange={(event) =>
                      updateConfig({ operatorRequest: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className={`mic-btn${dictating ? ' listening' : ''}`}
                    onClick={toggleDictation}
                    disabled={!dictationSupported}
                    aria-pressed={dictating}
                    aria-label={dictating ? 'Stop dictation' : 'Start dictation'}
                    title={
                      dictationSupported
                        ? dictating
                          ? 'Stop dictation'
                          : 'Dictate with the microphone'
                        : 'Speech recognition is not supported in this browser'
                    }
                  >
                    {dictating ? <Square size={12} /> : <Mic size={14} />}
                  </button>
                </div>
                {dictationSupported ? (
                  <span className="help">
                    <Mic
                      size={12}
                      style={{ verticalAlign: '-2px', marginRight: 5 }}
                    />
                    {dictating
                      ? 'Listening — speak now. Recognized words are appended to this field as text.'
                      : 'Microphone dictation runs in your browser via the SpeechRecognition API and writes into this field as text; the API receives text only.'}
                  </span>
                ) : (
                  <span className="help">
                    <MicOff
                      size={12}
                      style={{ verticalAlign: '-2px', marginRight: 5 }}
                    />
                    Voice capture is not available in this browser. This text is
                    sent as <code>operator_request</code> and the backend reports
                    the voice stage as <code>not_integrated</code> unless text is
                    provided.
                  </span>
                )}
                {dictationError ? (
                  <div className="note warn" style={{ marginTop: 6 }}>
                    {dictationError}
                  </div>
                ) : null}
                {(() => {
                  const preview = previewIntent(config.operatorRequest)
                  if (preview.chips.length === 0) return null
                  return (
                    <div
                      className="command-chips"
                      style={{ marginTop: 6 }}
                      aria-label="Parsed intent preview"
                    >
                      {preview.chips.map((chip) => (
                        <span key={chip} className="pill command-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div className="field">
                <label htmlFor="failure-demo">Failure demo (bounded loop)</label>
                <select
                  id="failure-demo"
                  className="select"
                  value={config.simulateFailure}
                  onChange={(event) =>
                    updateConfig({
                      simulateFailure: event.target
                        .value as RunConfig['simulateFailure'],
                    })
                  }
                >
                  <option value="none">none — recovery succeeds first try</option>
                  <option value="once">once — first attempt fails, retry succeeds</option>
                  <option value="always">always — retries exhaust, safe abort</option>
                </select>
                <span className="help">
                  Deterministic simulated step failure for demonstrating the
                  bounded agent loop (retry once, then abort safely). Never
                  touches real infrastructure.
                </span>
              </div>

              <div className="switch-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    Policy approval
                  </div>
                  <div className="help">
                    Withhold it to watch the pipeline block at the approval gate and
                    fail verification.
                  </div>
                </div>
                <button
                  className="switch"
                  role="switch"
                  aria-checked={config.approve}
                  aria-label="Approve recovery"
                  onClick={() => updateConfig({ approve: !config.approve })}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={() => void startRun()}
                disabled={running || connection === 'offline'}
              >
                {running ? (
                  <>
                    <Loader2 size={14} className="spinner" /> Dispatching
                  </>
                ) : (
                  <>
                    <Play size={14} /> Run simulation
                  </>
                )}
              </button>

              {runError ? (
                <div className="note warn">
                  Run failed: {runError}. Start the API with{' '}
                  <code>uvicorn backend.main:app --reload</code> from the repository
                  root.
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel title="Endpoint contract">
            <div className="stack" style={{ gap: 'var(--sp-3)', fontSize: 12.5 }}>
              <div className="mono" style={{ color: 'var(--ice)', fontSize: 11.5 }}>
                POST /api/incidents/run
              </div>
              <div className="mono json-block" style={{ maxHeight: 180 }}>
{`{
  "fault": "${config.fault}",
  "approve_recovery": ${config.approve},
  "operator_request": ${JSON.stringify(config.operatorRequest)}
}`}
              </div>
              <p className="muted" style={{ fontSize: 11.5 }}>
                Responses are stored server-side and readable via GET /api/incidents
                and GET /api/incidents/{'{id}'}.
              </p>
            </div>
          </Panel>
        </div>

        <div className="col-7 stack">
          <Panel title="Current response" hint={run ? shortId(run.incident_id, 12) : 'no run yet'}>
            {run ? (
              <div className="stack" style={{ gap: 'var(--sp-3)' }}>
                <div className="stat-strip">
                  <div className="stat">
                    <span className="stat-label">Started</span>
                    <span className="stat-value" style={{ fontSize: 14 }}>
                      {formatStamp(run.started_at)}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Engine time</span>
                    <span className="stat-value" style={{ fontSize: 14 }}>
                      {formatMs(run.duration_ms)}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Events</span>
                    <span className="stat-value" style={{ fontSize: 14 }}>
                      {run.events.length}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Approved</span>
                    <span
                      className="stat-value"
                      style={{
                        fontSize: 14,
                        color: run.policy.approved
                          ? 'var(--emerald)'
                          : 'var(--amber)',
                      }}
                    >
                      {String(run.policy.approved)}
                    </span>
                  </div>
                </div>
                <pre className="json-block">{JSON.stringify(run, null, 2)}</pre>
              </div>
            ) : (
              <EmptyState title="No response yet">
                Dispatch a simulation to inspect the complete, unedited JSON the
                backend returns.
              </EmptyState>
            )}
          </Panel>

          <Panel title="Backend run history" hint={`${history.length} recorded`}>
            {history.length === 0 ? (
              <EmptyState title="History is empty">
                Runs are kept in backend memory (last 50) and reset when the process
                restarts.
              </EmptyState>
            ) : (
              <div className="panel-body flush">
                {history.map((item) => (
                  <button
                    key={item.incident_id}
                    className={`history-item${run?.incident_id === item.incident_id ? ' active' : ''}`}
                    onClick={() => void loadIntoConsole(item.incident_id)}
                  >
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {shortId(item.incident_id, 12)}
                    </span>
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      {formatStamp(item.started_at)}
                    </span>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {item.service}/{item.fault}
                    </span>
                    <span
                      className="pill"
                      style={{
                        marginLeft: 'auto',
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
                  </button>
                ))}
              </div>
            )}
            {loadError ? (
              <div className="note warn" style={{ marginTop: 'var(--sp-4)' }}>
                {loadError}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  )

  async function loadIntoConsole(id: string) {
    try {
      openRun(await fetchIncident(id))
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Unknown error')
    }
  }
}
