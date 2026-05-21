import './StatusDot.css'

export function StatusDot({ tone = 'mint' }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />
}
