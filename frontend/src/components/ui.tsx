import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { STATUS_COLOR, statusLabel, type StageStatus } from '../lib/lifecycle'

export function StatusPill({
  status,
  label,
  tone,
}: {
  status?: StageStatus
  label?: string
  tone?: 'cyan' | 'ice' | 'violet' | 'emerald' | 'amber' | 'red' | 'neutral'
}) {
  const text = label ?? (status ? statusLabel(status) : '')
  const style = tone
    ? undefined
    : { color: status ? STATUS_COLOR[status] : undefined }
  return (
    <span className={`pill${tone ? ` tone-${tone}` : ''}`} style={style}>
      <span className="dot" />
      {text}
    </span>
  )
}

export function Panel({
  title,
  hint,
  actions,
  children,
  flush,
}: {
  title: string
  hint?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {actions}
        {hint ? <span className="panel-hint">{hint}</span> : null}
      </header>
      <div className={`panel-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <Inbox size={26} strokeWidth={1.4} />
      <p className="empty-title">{title}</p>
      <p className="empty-sub">{children}</p>
      {action}
    </div>
  )
}
