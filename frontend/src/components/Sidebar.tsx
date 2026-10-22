import {
  BadgeCheck,
  FlaskConical,
  LayoutDashboard,
  ScrollText,
  Settings2,
  Share2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavDestination {
  id: string
  label: string
  path: string
  icon: LucideIcon
  title: string
}

export const NAV: NavDestination[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: LayoutDashboard, title: 'Overview' },
  { id: 'agents', label: 'Agent Network', path: '/agents', icon: Share2, title: 'Agent Network' },
  { id: 'lab', label: 'Incident Lab', path: '/lab', icon: FlaskConical, title: 'Incident Lab' },
  { id: 'evidence', label: 'Recovery Evidence', path: '/evidence', icon: BadgeCheck, title: 'Recovery Evidence' },
  { id: 'audit', label: 'Audit Trail', path: '/audit', icon: ScrollText, title: 'Audit Trail' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings2, title: 'Settings' },
]

export function Sidebar({ route }: { route: string }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <ShieldCheck size={19} strokeWidth={1.7} />
        </span>
        <span className="brand-text">
          <div className="brand-name">RAGNAROK AI</div>
          <div className="brand-edition">Infrastructure Intelligence Center</div>
        </span>
      </div>

      <nav className="nav" aria-label="Primary">
        <div className="nav-section eyebrow">Operations</div>
        {NAV.map((item) => {
          const active = route === item.path
          return (
            <a
              key={item.id}
              className="nav-item"
              href={`#${item.path}`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon size={16} strokeWidth={1.7} />
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <span className="tagline">Observe. Reason. Recover. Verify.</span>
        <span>Simulation-only resilience engine.</span>
        <span>No live infrastructure is contacted.</span>
      </div>
    </aside>
  )
}
