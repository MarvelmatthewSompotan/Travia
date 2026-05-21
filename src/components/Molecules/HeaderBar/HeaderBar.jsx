import { StatusDot } from '../../Atoms/StatusDot/StatusDot'
import './HeaderBar.css'

export function HeaderBar({ label, onNewChat }) {
  return (
    <div className="header-bar">
      <div className="header-bar__pill">
        <StatusDot tone="mint" />
        <span>{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      <div className="header-bar__spacer" />
      {onNewChat && (
        <button className="header-bar__ghost" type="button" onClick={onNewChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          New chat
        </button>
      )}
    </div>
  )
}
