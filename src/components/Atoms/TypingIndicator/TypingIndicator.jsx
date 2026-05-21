import './TypingIndicator.css'

export function TypingIndicator({ label }) {
  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <span className="typing-indicator__avatar" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
        </svg>
      </span>
      <span className="typing-indicator__bubble">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        {label && <span className="typing-indicator__label">{label}</span>}
      </span>
    </div>
  )
}
