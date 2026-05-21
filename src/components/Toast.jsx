export function Toast({ message }) {
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__dot" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="toast__msg">{message}</span>
    </div>
  )
}
