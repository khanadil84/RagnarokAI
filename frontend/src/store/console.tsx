import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, fetchHealth, fetchHistory, fetchIncident, runIncident } from '../lib/api'
import { createDuplicateGuard } from '../lib/dispatch'
import { previewIntent } from '../lib/intent'
import {
  STAGE_COUNT,
  deriveAgentStates,
  deriveLifecycle,
  type AgentActivityMap,
  type LifecycleStage,
} from '../lib/lifecycle'
import type { Connection, HealthResponse, RunResponse, RunSummary } from '../lib/types'

export interface RunConfig {
  fault: string
  approve: boolean
  operatorRequest: string
  simulateFailure: 'none' | 'once' | 'always'
}

const CONFIG_KEY = 'ragnarok.config'
const LAST_RUN_KEY = 'ragnarok.lastRun'
export const REVEAL_STEP_MS = 380

const DEFAULT_CONFIG: RunConfig = {
  fault: 'memory_pressure',
  approve: true,
  operatorRequest: '',
  simulateFailure: 'none',
}

function loadConfig(): RunConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<RunConfig>) }
  } catch {
    return DEFAULT_CONFIG
  }
}

function loadLastRun(): RunResponse | null {
  try {
    const raw = window.localStorage.getItem(LAST_RUN_KEY)
    return raw ? (JSON.parse(raw) as RunResponse) : null
  } catch {
    return null
  }
}

export interface Selection {
  kind: 'stage' | 'agent'
  id: string
}

export interface DispatchResult {
  ok: boolean
  reason?: 'empty' | 'running' | 'duplicate'
}

interface ConsoleValue {
  connection: Connection
  health: HealthResponse | null
  healthError: string | null
  history: RunSummary[]
  historyError: string | null
  config: RunConfig
  run: RunResponse | null
  /** Where the current run came from, or null when it was executed live. */
  restoredFrom: string | null
  revealIndex: number
  revealing: boolean
  running: boolean
  runError: string | null
  selection: Selection | null
  stages: LifecycleStage[]
  agentStates: AgentActivityMap
  select: (selection: Selection | null) => void
  updateConfig: (patch: Partial<RunConfig>) => void
  startRun: (overrides?: Partial<RunConfig>) => Promise<void>
  /** Voice-first entry point: intent-aware config update + automatic start. */
  dispatchCommand: (text: string) => Promise<DispatchResult>
  skipReveal: () => void
  refresh: () => void
  openRun: (run: RunResponse) => void
  clearSession: () => void
}

const ConsoleContext = createContext<ConsoleValue | null>(null)

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection>('checking')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [history, setHistory] = useState<RunSummary[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [config, setConfig] = useState<RunConfig>(loadConfig)
  const [run, setRun] = useState<RunResponse | null>(loadLastRun)
  const [restoredFrom, setRestoredFrom] = useState<string | null>(() =>
    loadLastRun() ? 'browser cache' : null,
  )
  const [revealIndex, setRevealIndex] = useState<number>(() =>
    loadLastRun() ? STAGE_COUNT : 0,
  )
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [tick, setTick] = useState(0)
  const mounted = useRef(true)
  const runRef = useRef<RunResponse | null>(run)
  const runningRef = useRef(false)
  const duplicateGuardRef = useRef(createDuplicateGuard())

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }, [config])

  // Backend connectivity probe.
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined
    const probe = async () => {
      try {
        const next = await fetchHealth(controller.signal)
        if (!mounted.current) return
        setHealth(next)
        setHealthError(null)
        setConnection(next.status === 'ok' ? 'online' : 'offline')
      } catch (error) {
        if (!mounted.current || controller.signal.aborted) return
        setHealth(null)
        setHealthError(error instanceof ApiError ? error.message : 'Unknown error')
        setConnection('offline')
      } finally {
        if (mounted.current && !controller.signal.aborted) {
          timer = window.setTimeout(probe, 8000)
        }
      }
    }
    void probe()
    return () => {
      controller.abort()
      if (timer) window.clearTimeout(timer)
    }
  }, [tick])

  // Recorded run history (in-memory on the backend).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { items } = await fetchHistory(25)
        if (!cancelled && mounted.current) {
          setHistory(items)
          setHistoryError(null)
          // Cold start: surface the most recent recorded run instead of an
          // empty console. It is a real backend record, so nothing is invented.
          if (!runRef.current && items[0]) {
            try {
              const full = await fetchIncident(items[0].incident_id)
              if (cancelled || !mounted.current || runRef.current) return
              setRun(full)
              setRestoredFrom('backend history')
              setRevealIndex(STAGE_COUNT)
              window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify(full))
            } catch {
              /* offline already reported by the health probe */
            }
          }
        }
      } catch (error) {
        if (!cancelled && mounted.current) {
          setHistoryError(error instanceof ApiError ? error.message : 'Unknown error')
        }
      }
    }
    void load()
    const timer = window.setInterval(load, 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [tick, running])

  // Progressive reveal of the recorded lifecycle.
  useEffect(() => {
    if (!run || revealIndex >= STAGE_COUNT) return
    const timer = window.setTimeout(() => {
      if (mounted.current) setRevealIndex((value) => Math.min(value + 1, STAGE_COUNT))
    }, REVEAL_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [run, revealIndex])

  const updateConfig = useCallback((patch: Partial<RunConfig>) => {
    setConfig((current) => ({ ...current, ...patch }))
  }, [])

  const startRun = useCallback(
    async (overrides?: Partial<RunConfig>) => {
      const effective: RunConfig = { ...config, ...overrides }
      setRunning(true)
      setRunError(null)
      try {
        const response = await runIncident({
          fault: effective.fault,
          approve_recovery: effective.approve,
          operator_request: effective.operatorRequest,
          simulate_failure: effective.simulateFailure,
        })
        if (!mounted.current) return
        setRun(response)
        setRestoredFrom(null)
        setRevealIndex(0)
        window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify(response))
        setHistory((items) => [
          {
            incident_id: response.incident_id,
            started_at: response.started_at,
            service: response.service,
            fault: response.fault,
            operator_request: response.operator_request,
            duration_ms: response.duration_ms,
            event_count: response.events.length,
            outcome: response.verification.verified
              ? 'verified'
              : response.recovery.type === 'recovery_blocked'
                ? 'blocked'
                : 'unverified',
            approved: response.policy.approved,
            verified: response.verification.verified,
            simulation_only: response.simulation_only,
          },
          ...items,
        ])
      } catch (error) {
        if (!mounted.current) return
        setRunError(error instanceof ApiError ? error.message : 'Unknown error')
        setConnection('offline')
      } finally {
        if (mounted.current) setRunning(false)
      }
    },
    [config],
  )

  const dispatchCommand = useCallback(
    async (text: string): Promise<DispatchResult> => {
      const trimmed = text.trim()
      if (!trimmed) return { ok: false, reason: 'empty' }
      // Execution in flight: overlapping submissions are refused outright.
      if (runningRef.current) return { ok: false, reason: 'running' }
      // Same command inside the duplicate window: refused (double finals,
      // double clicks, accidental re-speak).
      if (duplicateGuardRef.current.isDuplicate(trimmed)) {
        return { ok: false, reason: 'duplicate' }
      }
      duplicateGuardRef.current.record(trimmed)
      const preview = previewIntent(trimmed)
      updateConfig({
        operatorRequest: trimmed,
        ...(preview.fault ? { fault: preview.fault } : {}),
      })
      // Voice text never grants approval: only config.approve (the explicit
      // Lab toggle) is sent as approve_recovery.
      await startRun({
        operatorRequest: trimmed,
        fault: preview.fault ?? config.fault,
      })
      return { ok: true }
    },
    [config.fault, startRun, updateConfig],
  )

  const openRun = useCallback((next: RunResponse) => {
    setRun(next)
    setRestoredFrom(null)
    setRevealIndex(0)
    setRunError(null)
    window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify(next))
  }, [])

  const clearSession = useCallback(() => {
    setRun(null)
    setRestoredFrom(null)
    setRevealIndex(0)
    setRunError(null)
    setSelection(null)
    window.localStorage.removeItem(LAST_RUN_KEY)
  }, [])

  const skipReveal = useCallback(() => setRevealIndex(STAGE_COUNT), [])

  const stages = useMemo(() => deriveLifecycle(run), [run])
  const agentStates = useMemo(
    () => deriveAgentStates(run, connection),
    [run, connection],
  )

  const value = useMemo<ConsoleValue>(
    () => ({
      connection,
      health,
      healthError,
      history,
      historyError,
      config,
      run,
      restoredFrom,
      revealIndex,
      revealing: run !== null && revealIndex < STAGE_COUNT,
      running,
      runError,
      selection,
      stages,
      agentStates,
      select: setSelection,
      updateConfig,
      startRun,
      dispatchCommand,
      skipReveal,
      refresh,
      openRun,
      clearSession,
    }),
    [
      connection,
      health,
      healthError,
      history,
      historyError,
      config,
      run,
      restoredFrom,
      revealIndex,
      running,
      runError,
      selection,
      stages,
      agentStates,
      updateConfig,
      startRun,
      dispatchCommand,
      skipReveal,
      refresh,
      openRun,
      clearSession,
    ],
  )


  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>
}

export function useConsole(): ConsoleValue {
  const context = useContext(ConsoleContext)
  if (!context) throw new Error('useConsole must be used inside ConsoleProvider')
  return context
}
