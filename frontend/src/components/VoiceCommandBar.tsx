import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Square } from 'lucide-react'
import {
  createDeferredSubmit,
  shouldAutoSubmit,
  type DeferredSubmit,
} from '../lib/dispatch'
import { previewIntent } from '../lib/intent'
import { useSpeechRecognition } from '../lib/useSpeechRecognition'
import { useConsole } from '../store/console'

const NOTICE_MS = 2500

/**
 * Voice-first command surface: hands-free by default — text submitted by
 * browser recognition OR filled by Wispr Flow auto-dispatches the autonomous
 * run with no clicks, through the existing safe dispatch function (duplicate
 * guard, running guard, intent preview, approval only from the Lab toggle).
 * Listening pauses while a run executes. Dispatch / Run Simulation remain as
 * manual fallbacks. Voice text can never grant policy approval.
 */
export function VoiceCommandBar() {
  const { dispatchCommand, running, connection, config } = useConsole()
  const [draft, setDraft] = useState('')
  const [handsFree, setHandsFree] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const handsFreeRef = useRef(handsFree)
  const dispatchRef = useRef(dispatchCommand)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const deferredRef = useRef<DeferredSubmit | null>(null)

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  useEffect(() => {
    dispatchRef.current = dispatchCommand
  }, [dispatchCommand])

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), [])

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  const submit = useCallback(
    async (text: string) => {
      // Any explicit/auto submit supersedes a pending debounced one.
      deferredRef.current?.cancel()
      const result = await dispatchRef.current(text)
      if (result.ok) {
        showNotice('Command dispatched — autonomous run started.')
        return
      }
      showNotice(
        result.reason === 'duplicate'
          ? 'Duplicate command ignored — already dispatched.'
          : result.reason === 'running'
            ? 'Run in progress — submission refused, listening stays paused.'
            : 'Nothing to dispatch.',
      )
    },
    [showNotice],
  )

  // Debounced auto-submit for text that lands in the field (Wispr Flow,
  // system dictation, typing) — connects "voice text submitted" to the safe
  // dispatch function without requiring the Dispatch button.
  useEffect(() => {
    const deferred = createDeferredSubmit((text) => {
      if (shouldAutoSubmit(text, handsFreeRef.current)) void submit(text)
    })
    deferredRef.current = deferred
    return () => {
      deferred.cancel()
      deferredRef.current = null
    }
  }, [submit])

  const onDictated = useCallback((text: string) => {
    setDraft(text)
  }, [])

  // Auto-submit only when a session ends NATURALLY with a complete final
  // command and hands-free mode is on (manual stop never submits).
  const onComplete = useCallback(
    (text: string) => {
      if (shouldAutoSubmit(text, handsFreeRef.current)) void submit(text)
    },
    [submit],
  )

  const {
    supported,
    listening,
    error: dictationError,
    start,
    stop,
  } = useSpeechRecognition(onDictated, { onComplete })

  // Stop listening while a command is executing; never arm a pending
  // auto-submit for text that arrives mid-run.
  useEffect(() => {
    if (running) {
      deferredRef.current?.cancel()
      if (listening) stop()
    }
  }, [running, listening, stop])

  const toggleMic = () => {
    if (listening) {
      stop()
      return
    }
    setDraft('')
    start('')
  }

  const handleFieldChange = (value: string) => {
    setDraft(value)
    deferredRef.current?.schedule(value)
  }

  const toggleHandsFree = () => {
    setHandsFree((value) => {
      const next = !value
      if (!next) deferredRef.current?.cancel()
      return next
    })
  }

  const preview = previewIntent(draft)
  const statusText = running
    ? 'Executing autonomous run — listening paused.'
    : listening
      ? handsFree
        ? 'Listening — speak a complete command; it dispatches automatically.'
        : 'Listening — recognized text fills the field; press Dispatch to submit.'
      : notice ??
        (supported
          ? handsFree
            ? 'Hands-free on: spoken or Wispr-filled commands start the run automatically.'
            : 'Hands-free off: speak or type, then press Dispatch.'
          : 'Speech recognition unavailable — Wispr Flow or typed text still auto-dispatches (hands-free).')

  return (
    <div className="command-bar">
      <div className="command-row">
        <button
          type="button"
          className={`mic-btn command-mic${listening ? ' listening' : ''}`}
          onClick={toggleMic}
          disabled={!supported || running}
          aria-pressed={listening}
          aria-label={
            listening ? 'Stop listening' : running
              ? 'Listening paused while a run executes'
              : 'Start voice command'
          }
          title={
            !supported
              ? 'Speech recognition is not supported in this browser'
              : running
                ? 'Listening is paused while a run executes'
                : listening
                  ? 'Stop listening'
                  : 'Speak a command'
          }
        >
          {listening ? <Square size={12} /> : <Mic size={14} />}
        </button>

        <label className="sr-only" htmlFor="voice-command">
          Voice command
        </label>
        <input
          id="voice-command"
          className="input command-input"
          maxLength={500}
          placeholder="e.g. checkout is under memory pressure, restore capacity"
          value={draft}
          onChange={(event) => handleFieldChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.repeat) {
              event.preventDefault()
              void submit(draft)
            }
          }}
        />

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submit(draft)}
          disabled={running || connection === 'offline' || !draft.trim()}
          aria-label="Dispatch command and start autonomous run (manual fallback)"
          title="Manual fallback: start the autonomous run for this field. Policy approval still follows the Incident Lab toggle."
        >
          <Send size={13} /> Dispatch
        </button>

        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={handsFree}
          aria-label="Hands-free mode: auto-dispatch submitted commands"
          title="On by default: browser recognition completion or text filled into this field (e.g. Wispr Flow) auto-dispatches the run after a short pause. Turn off to review text before Dispatch."
          onClick={toggleHandsFree}
        />
        <span className="command-auto-label" aria-hidden="true">
          Hands-free
        </span>
      </div>

      <div className="command-meta">
        <span className="command-status" role="status" aria-live="polite">
          {!supported && !listening ? (
            <MicOff size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />
          ) : null}
          {statusText}
        </span>
        {dictationError ? (
          <span className="command-error" role="alert">
            {dictationError}
          </span>
        ) : null}
        {preview.chips.length > 0 ? (
          <span className="command-chips">
            {preview.chips.map((chip) => (
              <span key={chip} className="pill command-chip">
                {chip}
              </span>
            ))}
          </span>
        ) : null}
        <span className="command-hint">
          Voice never grants approval
          {config.approve ? ' (Lab toggle is ON)' : ' (Lab toggle is OFF)'} · simulation only
        </span>
      </div>
    </div>
  )
}
