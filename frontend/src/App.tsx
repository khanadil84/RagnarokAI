import { useEffect, useState } from 'react'
import { Sidebar, NAV } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { VoiceCommandBar } from './components/VoiceCommandBar'
import { AgentNetworkPage } from './pages/AgentNetwork'
import { AuditTrailPage } from './pages/AuditTrail'
import { IncidentLabPage } from './pages/IncidentLab'
import { OverviewPage } from './pages/Overview'
import { RecoveryEvidencePage } from './pages/RecoveryEvidence'
import { SettingsPage } from './pages/Settings'
import { ConsoleProvider, useConsole } from './store/console'

const DEFAULT_ROUTE = '/overview'

function readRoute(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash || DEFAULT_ROUTE
}

function useRoute(): string {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

function Workspace() {
  const rawRoute = useRoute()
  const known = NAV.some((item) => item.path === rawRoute)
  const route = known ? rawRoute : DEFAULT_ROUTE
  const { startRun } = useConsole()

  useEffect(() => {
    if (!known) window.location.hash = `#${DEFAULT_ROUTE}`
  }, [known])

  const onRun = async () => {
    await startRun()
    if (route !== DEFAULT_ROUTE) window.location.hash = `#${DEFAULT_ROUTE}`
  }

  return (
    <div className="app">
      <Sidebar route={route} />
      <div className="main">
        <TopBar route={route} onRun={() => void onRun()} />
        <VoiceCommandBar />
        <main className="workspace">
          {route === '/overview' ? <OverviewPage /> : null}
          {route === '/agents' ? <AgentNetworkPage /> : null}
          {route === '/lab' ? <IncidentLabPage /> : null}
          {route === '/evidence' ? <RecoveryEvidencePage /> : null}
          {route === '/audit' ? <AuditTrailPage /> : null}
          {route === '/settings' ? <SettingsPage /> : null}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ConsoleProvider>
      <Workspace />
    </ConsoleProvider>
  )
}
