import { ArrowRight, SkipForward } from 'lucide-react'
import {
  AGENT_BY_NAME,
  ALL_PARTICIPANTS,
  TONE_HEX,
  type AgentDef,
} from '../lib/agents'
import { formatMs, relative, shortId } from '../lib/format'
import {
  STATUS_COLOR,
  statusLabel,
  type AgentActivityMap,
  type LifecycleStage,
} from '../lib/lifecycle'
import type { RunResponse } from '../lib/types'
import type { Selection } from '../store/console'

const CHIP = { y: 40, h: 70, w: 130 } as const
const CHIP_X = [96, 240, 384, 528, 672, 816, 960, 1104] as const
const ROW_A = 190
const ROW_B = 330
const NODE_H = 104

interface NodeLayout {
  cx: number
  y: number
  w: number
}

const NODE_LAYOUT: Record<string, NodeLayout> = {
  voice: { cx: 96, y: ROW_B, w: 134 },
  orchestrator: { cx: 240, y: ROW_A, w: 196 },
  chaos: { cx: 384, y: ROW_B, w: 196 },
  aegis: { cx: 528, y: ROW_A, w: 196 },
  patcher: { cx: 672, y: ROW_B, w: 196 },
  policy: { cx: 816, y: ROW_A, w: 140 },
  nexus: { cx: 1000, y: ROW_A, w: 196 },
}

/** NexusDeployer also owns the execution stage, which sits under another column. */
const EXTRA_LINKS: { agent: string; stageIndex: number }[] = [
  { agent: 'NexusDeployer', stageIndex: 6 },
]

function participantLayout(name: string | null): { agent: AgentDef; layout: NodeLayout } | null {
  if (!name) return null
  const agent = AGENT_BY_NAME[name]
  if (!agent) return null
  const layout = NODE_LAYOUT[agent.id]
  if (!layout) return null
  return { agent, layout }
}

interface TopologyProps {
  stages: LifecycleStage[]
  agentStates: AgentActivityMap
  selection: Selection | null
  onSelect: (selection: Selection | null) => void
  revealIndex: number
  revealing: boolean
  onSkip: () => void
  run: RunResponse | null
  restoredFrom: string | null
}

export function Topology({
  stages,
  agentStates,
  selection,
  onSelect,
  revealIndex,
  revealing,
  onSkip,
  run,
  restoredFrom,
}: TopologyProps) {
  const revealedCount = revealing ? revealIndex : stages.length

  const stageFor = (index: number) => stages[index]

  return (
    <div>
      <div className="topology-wrap">
        <svg
          className="topology-svg"
          viewBox="0 0 1200 458"
          role="img"
          aria-label="Incident recovery lifecycle topology"
        >

          {/* rail between lifecycle stages */}
          {stages.slice(0, -1).map((stage, index) => {
            const x1 = CHIP_X[index]! + CHIP.w / 2
            const x2 = CHIP_X[index + 1]! - CHIP.w / 2
            const done =
              index < revealedCount &&
              stage.status === 'completed' &&
              stageFor(index + 1)?.status !== 'idle'
            const active = revealing && revealIndex === index + 1
            return (
              <g key={`rail-${stage.id}`}>
                <line
                  className={`flow-line${done ? ' done' : ''}`}
                  x1={x1}
                  y1={75}
                  x2={x2}
                  y2={75}
                />
                {active ? (
                  <line
                    className="flow-dash"
                    x1={x1}
                    y1={75}
                    x2={x2}
                    y2={75}
                  />
                ) : null}
                <path
                  className={`flow-chevron${done ? ' done' : ''}`}
                  d={`M ${x2 - 6} 70 L ${x2 - 1} 75 L ${x2 - 6} 80 Z`}
                />
              </g>
            )
          })}

          {/* participant → stage ownership links */}
          {stages.map((stage, index) => {
            const chipX = CHIP_X[index]!
            const participant = participantLayout(stage.participant)
            if (!participant) return null
            const { agent, layout } = participant
            const isPending = revealing && index >= revealIndex
            const active =
              !isPending && stage.status !== 'idle' && stage.status !== 'unavailable'
            return (
              <line
                key={`link-${stage.id}`}
                className={`owner-link${active ? ' active' : ''}`}
                x1={layout.cx}
                y1={layout.y}
                x2={chipX}
                y2={CHIP.y + CHIP.h}
                stroke={active ? TONE_HEX[agent.tone] : '#6f829b'}
              />
            )
          })}
          {EXTRA_LINKS.map(({ agent: name, stageIndex }) => {
            const stage = stages[stageIndex]
            const layout = NODE_LAYOUT[
              AGENT_BY_NAME[name]?.id ?? ''
            ]
            if (!stage || !layout) return null
            const chipX = CHIP_X[stageIndex]!
            const active =
              stageIndex < revealedCount && stage.status === 'completed'
            const tone = TONE_HEX[AGENT_BY_NAME[name]?.tone ?? 'neutral']
            return (
              <path
                key={`extra-${name}-${stageIndex}`}
                className={`owner-link${active ? ' active' : ''}`}
                d={`M ${layout.cx} ${layout.y} C ${layout.cx} ${layout.y - 34}, ${chipX} ${layout.y - 10}, ${chipX} ${CHIP.y + CHIP.h}`}
                stroke={active ? tone : '#6f829b'}
              />
            )
          })}

          {/* lifecycle stage chips */}
          {stages.map((stage, index) => {
            const cx = CHIP_X[index]!
            const isPending = revealing && index >= revealIndex
            const isActive = revealing && index === revealIndex
            const color = STATUS_COLOR[stage.status]
            const selected =
              selection?.kind === 'stage' && selection.id === stage.id
            const lines = stage.railLabel
            const labelY = lines.length > 1 ? [64, 77] : [71]
            return (
              <g
                key={stage.id}
                className={[
                  'stage-chip',
                  isPending ? 'pending' : '',
                  selected ? 'selected' : '',
                  stage.status === 'completed' ? 'is-completed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  onSelect(selected ? null : { kind: 'stage', id: stage.id })
                }
                role="button"
                tabIndex={0}
                aria-label={`${stage.title}: ${statusLabel(stage.status)}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(selected ? null : { kind: 'stage', id: stage.id })
                  }
                }}
              >
                {isActive ? (
                  <rect
                    className="pulse-ring"
                    x={cx - CHIP.w / 2 - 3}
                    y={CHIP.y - 3}
                    width={CHIP.w + 6}
                    height={CHIP.h + 6}
                    rx={12}
                  />
                ) : null}
                <rect
                  className="chip-body"
                  x={cx - CHIP.w / 2}
                  y={CHIP.y}
                  width={CHIP.w}
                  height={CHIP.h}
                  rx={10}
                  fill={
                    stage.status === 'idle'
                      ? '#0d1524'
                      : selected
                        ? '#152238'
                        : '#101b2e'
                  }
                  stroke={
                    selected
                      ? color
                      : stage.status === 'idle'
                        ? 'rgba(148,163,184,0.16)'
                        : color
                  }
                  strokeOpacity={stage.status === 'idle' ? 1 : 0.55}
                />
                <text className="chip-index" x={cx - CHIP.w / 2 + 10} y={CHIP.y + 17}>
                  {String(index + 1).padStart(2, '0')}
                </text>
                <circle cx={cx + CHIP.w / 2 - 13} cy={CHIP.y + 14} r={4} fill={color} />
                {lines.map((line, lineIndex) => (
                  <text
                    key={line}
                    className="chip-label"
                    x={cx}
                    y={CHIP.y + (labelY[lineIndex] ?? 71)}
                    textAnchor="middle"
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}

          {/* participant nodes */}
          {ALL_PARTICIPANTS.map((agent) => {
            const layout = NODE_LAYOUT[agent.id]
            if (!layout) return null
            const status = agentStates[agent.id]
            const color = agent.gate ? '#6f829b' : TONE_HEX[agent.tone]
            const stateColor = STATUS_COLOR[status]
            const selected =
              selection?.kind === 'agent' && selection.id === agent.id
            const ownsStage = stages.find((stage) => stage.participant === agent.name)
            const isPending = revealing && ownsStage
              ? ownsStage.index >= revealIndex
              : false
            const Icon = agent.icon
            const x = layout.cx - layout.w / 2
            return (
              <g
                key={agent.id}
                className={[
                  'node-card',
                  agent.gate ? 'is-gate' : '',
                  isPending ? 'pending' : '',
                  selected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  onSelect(selected ? null : { kind: 'agent', id: agent.id })
                }
                role="button"
                tabIndex={0}
                aria-label={`${agent.name}: ${statusLabel(status)}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(selected ? null : { kind: 'agent', id: agent.id })
                  }
                }}
              >
                <rect
                  className="node-body"
                  x={x}
                  y={layout.y}
                  width={layout.w}
                  height={NODE_H}
                  rx={12}
                  stroke={selected ? color : undefined}
                />
                <g transform={`translate(${x + 12}, ${layout.y + 12})`}>
                  <Icon size={18} strokeWidth={1.6} color={color} />
                </g>
                <text className="node-name" x={x + 38} y={layout.y + 26}>
                  {agent.name}
                </text>
                <text className="node-role" x={x + 12} y={layout.y + 52}>
                  {agent.role}
                </text>
                <text
                  className="node-state"
                  x={x + 12}
                  y={layout.y + 82}
                  fill={stateColor}
                >
                  {statusLabel(status)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="topo-caption">
        {revealing ? (
          <>
            <span>
              Replaying recorded run {shortId(run?.incident_id ?? '')} — stage{' '}
              {Math.min(revealIndex + 1, stages.length)} of {stages.length}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={onSkip}>
              <SkipForward size={13} /> Skip replay
            </button>
          </>
        ) : run ? (
          <span>
            Recorded run {shortId(run.incident_id)} · {run.service} ·             {run.fault} ·{' '}
            {formatMs(run.duration_ms)} engine time · captured {relative(run.started_at)}
            {restoredFrom ? ` · restored from ${restoredFrom}` : ''}
          </span>
        ) : (
          <span>
            Eight lifecycle stages, five agents and two gates. States are derived from
            backend responses only — nothing is shown as running until the API reports it.
          </span>
        )}
        <span className="topo-legend">
          {(
            [
              ['completed', 'Completed'],
              ['blocked', 'Blocked'],
              ['failed', 'Failed'],
              ['idle', 'Idle'],
              ['unavailable', 'Not integrated'],
            ] as const
          ).map(([status, label]) => (
            <span className="legend-item" key={status}>
              <span
                className="legend-swatch"
                style={{ background: STATUS_COLOR[status] }}
              />
              {label}
            </span>
          ))}
        </span>
      </div>

      <TopologyDetail
        stages={stages}
        agentStates={agentStates}
        selection={selection}
        run={run}
      />
    </div>
  )
}

function TopologyDetail({
  stages,
  agentStates,
  selection,
  run,
}: {
  stages: LifecycleStage[]
  agentStates: AgentActivityMap
  selection: Selection | null
  run: RunResponse | null
}) {
  if (selection?.kind === 'stage') {
    const stage = stages.find((item) => item.id === selection.id)
    if (!stage) return null
    return (
      <div className="topo-detail">
        <div>
          <div className="topo-detail-title">
            <span className="mono muted">
              {String(stage.index + 1).padStart(2, '0')}
            </span>
            {stage.title}
            <span
              className="pill"
              style={{ color: STATUS_COLOR[stage.status] }}
            >
              <span className="dot" />
              {stage.summary}
            </span>
          </div>
          <p className="topo-detail-body">{stage.detail}</p>
        </div>
        <div className="topo-detail-meta">
          <span>
            <span className="k">Owner</span>
            <br />
            {stage.participant ?? 'No agent — gate logic'}
          </span>
          <span>
            <span className="k">Data source</span>
            <br />
            <span className="mono">{stage.source}</span>
          </span>
          <span>
            <span className="k">Measured</span>
            <br />
            <span className="mono">{formatMs(stage.durationMs)}</span>
          </span>
        </div>
      </div>
    )
  }

  if (selection?.kind === 'agent') {
    const agent = ALL_PARTICIPANTS.find((item) => item.id === selection.id)
    if (!agent) return null
    const status = agentStates[agent.id]
    const owned = stages.filter((stage) => stage.participant === agent.name)
    return (
      <div className="topo-detail">
        <div>
          <div className="topo-detail-title">
            <agent.icon size={17} color={TONE_HEX[agent.tone]} />
            {agent.name}
            <span className="pill" style={{ color: STATUS_COLOR[status] }}>
              <span className="dot" />
              {statusLabel(status)}
            </span>
          </div>
          <p className="topo-detail-body">{agent.description}</p>
        </div>
        <div className="topo-detail-meta">
          <span>
            <span className="k">Responsibility</span>
            <br />
            {agent.role}
          </span>
          <span>
            <span className="k">Backend module</span>
            <br />
            <span className="mono">{agent.module}</span>
          </span>
          <span>
            <span className="k">Owns stages</span>
            <br />
            {owned.map((stage) => stage.title).join(', ') || '—'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="topo-detail">
      <div>
        <div className="topo-detail-title">
          Incident topology
          <ArrowRight size={15} className="muted" />
          <span className="muted" style={{ fontWeight: 500 }}>
            select a stage or an agent
          </span>
        </div>
        <p className="topo-detail-body">
          {run
            ? 'Each stage reports the exact response field it was derived from. Click any node to inspect provenance, the honest description and the measured engine time.'
            : 'This view renders only what the backend has actually reported. Run a simulation to populate the lifecycle; until then every stage stays idle.'}
        </p>
      </div>
      <div className="topo-detail-meta">
        <span>
          <span className="k">Backend contract</span>
          <br />
          <span className="mono">GET /api/lifecycle</span>
        </span>
        <span>
          <span className="k">Run endpoint</span>
          <br />
          <span className="mono">POST /api/incidents/run</span>
        </span>
      </div>
    </div>
  )
}
