import { useRef } from 'react'
import './Composer.css'

const MAX_HEIGHT = 140

export function Composer({ value, onChange, onSubmit, onStop, busy, placeholder }) {
  const ref = useRef(null)

  const handleChange = (e) => {
    onChange(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    if (!value.trim() || busy) return
    onSubmit()
    if (ref.current) ref.current.style.height = 'auto'
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
      <textarea
        ref={ref}
        className="composer__input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={busy && !onStop}
      />
      <div className="composer__row">
        <div className="composer__hint">
          <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline
        </div>
        <div className="composer__grow" />
        {busy ? (
          <button type="button" className="composer__stop" onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop
          </button>
        ) : (
          <button type="submit" className="composer__send" disabled={!value.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
}
