import { Loader2, Play, RotateCw } from 'lucide-react'
import { shortId } from '../lib/format'
import { useConsole } from '../store/console'
import { NAV } from './Sidebar'

interface TopBarProps {
  route: string
  onRun: () => void
}

export function TopBar({ route, onRun }: TopBarProps) {
  const { connection, health, config, run, running, runError, refresh } = useConsole()
  const destination = NAV.find((item) => item.path === route) ?? NAV[0]!

  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumbs-path">
          Ragnarok AI / Infrastructure Intelligence Center
        </span>
        <span className="crumbs-title">{destination.title}</span>
      </div>

      <div className="topbar-spacer" />

      <div className="topbar-cluster">
        <button
          className="btn btn-ghost btn-sm"
          onClick={refresh}
          title="Re-probe the backend"
          aria-label="Re-probe the backend"
        >
          <RotateCw size={13} />
        </button>

        <span
          className={`conn ${connection}`}
          title={health ? `GET /api/health → ${health.status}` : 'Backend unreachable'}
        >
          <span className="dot" />
          {connection === 'online'
            ? 'Backend online'
            : connection === 'checking'
              ? 'Probing'
              : 'Backend offline'}
        </span>

        <span
          className="sim-badge"
          title="Every action in this product is simulated. No real infrastructure is touched."
        >
          Simulation mode
        </span>

        {run ? (
          <span className="incident-chip" title={`Full id: ${run.incident_id}`}>
            <span className="label">Incident</span>
            {shortId(run.incident_id, 12)}
          </span>
        ) : null}

        <button
          className="btn btn-primary"
          onClick={onRun}
          disabled={running || connection === 'offline'}
          title={
            connection === 'offline'
              ? 'Backend unreachable — start it with: uvicorn backend.main:app --reload'
              : `POST /api/incidents/run · fault=${config.fault} · approve=${config.approve}`
          }
        >
          {running ? (
            <>
              <Loader2 size={14} className="spinner" /> Running
            </>
          ) : (
            <>
              <Play size={14} /> Run simulation
            </>
          )}
        </button>
      </div>

      {runError ? (
        <span className="pill tone-red" style={{ marginLeft: 8 }}>
          <span className="dot" />
          {runError}
        </span>
      ) : null}
    </header>
  )
}
